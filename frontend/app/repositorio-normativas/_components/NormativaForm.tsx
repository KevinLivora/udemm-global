'use client';

import React, { useEffect, useRef, useState } from 'react';
import { apiFetch, mensajeErrorHttp } from '@/lib/api';
import { normalizarMayusculas } from '@/lib/normalizarMayusculas';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const VIGENCIAS = ['VIGENTE', 'DEROGADA', 'SUSPENDIDA', 'REEMPLAZADA'] as const;
const MAX_MB    = 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const HOY_ISO   = new Date().toISOString().slice(0, 10);

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface TipoOpcion { id: string; nombre: string }

interface FormValues {
  titulo: string;
  tipoNormativaId: string;
  fechaEmision: string;
  areaEmisora: string;
  numeroNorma: string;
  anio: string;
  vigencia: string;
}

interface FormErrors {
  titulo?: string;
  tipoNormativaId?: string;
  fechaEmision?: string;
  areaEmisora?: string;
  numeroNorma?: string;
  anio?: string;
}

export interface ArchivoActual {
  nombre: string | null;
  tamanio: number | null;
}

export interface NormativaFormProps {
  modo: 'crear' | 'editar';
  normativaId?: string;
  volverHref: string;
  valoresIniciales?: Partial<FormValues & { palabrasClave?: string }>;
  archivoActual?: ArchivoActual;
  onSuccess: (data: { tipoId: string; tipoNombre: string }) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function campo(label: string, required: boolean, error?: string, children?: React.ReactNode) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

// ── Componente ────────────────────────────────────────────────────────────────

export function NormativaForm({
  modo,
  normativaId,
  volverHref,
  valoresIniciales,
  archivoActual,
  onSuccess,
}: NormativaFormProps) {
  const esEditar = modo === 'editar';

  // ── Opciones ────────────────────────────────────────────────────────────────
  const [tipos, setTipos]               = useState<TipoOpcion[]>([]);
  const [areasEmisoras, setAreasEmisoras] = useState<TipoOpcion[]>([]);
  const [cargandoOpciones, setCargandoOpciones] = useState(true);

  // ── Form ────────────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormValues>({
    titulo:          valoresIniciales?.titulo ?? '',
    tipoNormativaId: valoresIniciales?.tipoNormativaId ?? '',
    fechaEmision:    valoresIniciales?.fechaEmision ?? '',
    areaEmisora:     valoresIniciales?.areaEmisora ?? '',
    numeroNorma:     valoresIniciales?.numeroNorma ?? '',
    anio:            valoresIniciales?.anio ?? String(new Date().getFullYear()).slice(-2),
    vigencia:        valoresIniciales?.vigencia ?? 'VIGENTE',
  });
  const [errors, setErrors]     = useState<FormErrors>({});
  const [tags, setTags]         = useState<string[]>(() => {
    const raw = valoresIniciales?.palabrasClave ?? '';
    return raw ? raw.split(',').map(t => t.trim()).filter(Boolean) : [];
  });
  const [tagInput, setTagInput] = useState('');

  // ── Archivo ─────────────────────────────────────────────────────────────────
  const [archivo, setArchivo]               = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo]     = useState('');
  const [reemplazando, setReemplazando]     = useState(false);
  const [viendoPdfActual, setViendoPdfActual] = useState(false);
  const [isDragging, setIsDragging]         = useState(false);

  // ── Estado UI ───────────────────────────────────────────────────────────────
  const [guardando, setGuardando]         = useState(false);
  const [exito, setExito]                 = useState('');
  const [errorGeneral, setErrorGeneral]   = useState('');

  const tagRef          = useRef<HTMLInputElement>(null);
  const archivoRef      = useRef<HTMLInputElement>(null);
  const dragCounterRef  = useRef(0);

  // ── Cargar tipos y áreas ────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      apiFetch(`${API}/normativas/tipos`).then(r => r.ok ? r.json() : []),
      apiFetch(`${API}/configuracion/tablas-maestras/tipos-area-emisora/activos`).then(r => r.ok ? r.json() : []),
    ])
      .then(([t, a]) => {
        setTipos(Array.isArray(t) ? t : []);
        setAreasEmisoras(Array.isArray(a) ? a : []);
      })
      .catch(() => {})
      .finally(() => setCargandoOpciones(false));
  }, []);

  // ── Handlers form ───────────────────────────────────────────────────────────
  function handleChange(field: keyof FormValues, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) setErrors(prev => ({ ...prev, [field]: undefined }));
    setErrorGeneral('');
  }

  // ── Tags ────────────────────────────────────────────────────────────────────
  function addTag() {
    const val = tagInput.trim().toUpperCase();
    if (!val) return;
    if (!tags.includes(val)) setTags(prev => [...prev, val]);
    setTagInput('');
    tagRef.current?.focus();
  }
  function removeTag(tag: string) { setTags(prev => prev.filter(t => t !== tag)); }
  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) setTags(prev => prev.slice(0, -1));
  }

  // ── Archivo nuevo ───────────────────────────────────────────────────────────

  // Validación y estado compartidos entre click e input y drag & drop
  function procesarArchivo(file: File | null) {
    setErrorArchivo('');
    setErrorGeneral('');
    if (!file) { setArchivo(null); return; }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorArchivo('ERROR: EL FORMATO DE ARCHIVO NO ES VÁLIDO. SOLO SE PERMITEN DOCUMENTOS PDF.');
      setArchivo(null);
      if (archivoRef.current) archivoRef.current.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      setErrorArchivo(`ERROR: EL ARCHIVO EXCEDE EL TAMAÑO MÁXIMO PERMITIDO (${MAX_MB} MB).`);
      setArchivo(null);
      if (archivoRef.current) archivoRef.current.value = '';
      return;
    }
    setArchivo(file);
  }

  function handleArchivoChange(e: React.ChangeEvent<HTMLInputElement>) {
    procesarArchivo(e.target.files?.[0] ?? null);
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  function handleDragEnter(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  }

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    procesarArchivo(e.dataTransfer.files?.[0] ?? null);
  }

  function quitarArchivoNuevo() {
    setArchivo(null);
    setErrorArchivo('');
    if (archivoRef.current) archivoRef.current.value = '';
  }

  function cancelarReemplazo() {
    setReemplazando(false);
    quitarArchivoNuevo();
  }

  // ── Ver PDF actual (editar) — fetch→blob→window.open ────────────────────────
  async function verPdfActual() {
    if (!normativaId) return;
    setViendoPdfActual(true);
    try {
      const res = await apiFetch(`${API}/normativas/${normativaId}/archivo`);
      if (!res.ok) {
        alert('No se pudo obtener el documento PDF.');
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Revocar después de dar tiempo al navegador a cargar la pestaña
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      alert('Error de conexión al intentar abrir el documento.');
    } finally {
      setViendoPdfActual(false);
    }
  }

  // ── Validación ──────────────────────────────────────────────────────────────
  function validar(): FormErrors {
    const e: FormErrors = {};
    if (!form.titulo.trim())                         e.titulo          = 'El título es obligatorio';
    else if (form.titulo.trim().length > 200)        e.titulo          = 'Máximo 200 caracteres';
    if (!form.tipoNormativaId)                       e.tipoNormativaId = 'El tipo de normativa es obligatorio';
    if (!form.fechaEmision)                          e.fechaEmision    = 'La fecha de emisión es obligatoria';
    else if (form.fechaEmision > HOY_ISO)            e.fechaEmision    = 'La fecha no puede ser futura';
    if (!form.areaEmisora)                           e.areaEmisora     = 'El área emisora es obligatoria';
    if (!form.numeroNorma.trim())                                          e.numeroNorma = 'El N° de norma es obligatorio';
    else if (!/^[A-Za-z0-9][A-Za-z0-9\-\/]*$/.test(form.numeroNorma.trim())) e.numeroNorma = 'Solo letras, números, guiones y barras (ej: 002, RES-123, ORD-045/2026)';
    if (!form.anio)                                  e.anio            = 'El año es obligatorio';
    else if (!/^\d{2}$/.test(form.anio))             e.anio            = 'Debe tener exactamente 2 dígitos (ej: 26)';
    return e;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const errs = validar();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    // Crear: PDF obligatorio. Editar: PDF opcional (solo si se eligió reemplazar)
    if (!esEditar && !archivo) {
      setErrorArchivo('ERROR: EL ARCHIVO PDF ES OBLIGATORIO.');
      return;
    }

    setGuardando(true);
    setErrorGeneral('');

    const fd = new FormData();
    fd.append('titulo',          form.titulo.trim().toUpperCase());
    fd.append('tipoNormativaId', form.tipoNormativaId);
    fd.append('fechaEmision',    form.fechaEmision);
    fd.append('areaEmisora',     form.areaEmisora);
    fd.append('numeroNorma',     form.numeroNorma.trim());
    fd.append('anio',            String(parseInt(form.anio, 10)));
    fd.append('vigencia',        form.vigencia);
    if (tags.length > 0) fd.append('palabrasClave', tags.join(','));
    if (archivo) fd.append('archivo', archivo);

    const url    = esEditar ? `${API}/normativas/${normativaId}` : `${API}/normativas`;
    const method = esEditar ? 'PATCH' : 'POST';

    try {
      const res = await apiFetch(url, {
        method,
        body: fd,
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        setErrorGeneral('ERROR: YA EXISTE UNA NORMA REGISTRADA CON ESE NÚMERO Y AÑO.');
        return;
      }
      if (!res.ok) {
        const msg = mensajeErrorHttp(res, data, esEditar ? 'Error al actualizar la normativa' : 'Error al registrar la normativa');
        const esErrorArchivo = res.status !== 403 && typeof msg === 'string' && (
          msg.includes('FORMATO') || msg.includes('EXCEDE') || msg.includes('PDF ES OBLIGATORIO')
        );
        if (esErrorArchivo) setErrorArchivo(msg);
        else setErrorGeneral(msg);
        return;
      }

      const mensajeExito = esEditar ? 'CAMBIOS GUARDADOS CORRECTAMENTE.' : 'NORMATIVA REGISTRADA CORRECTAMENTE.';
      setExito(mensajeExito);
      const tipoId  = data.tipoNormativa?.id     ?? form.tipoNormativaId;
      const tipoNom = data.tipoNormativa?.nombre  ?? '';
      setTimeout(() => onSuccess({ tipoId, tipoNombre: tipoNom }), 900);
    } catch {
      setErrorGeneral('Error de conexión. Verificá que el servidor esté disponible.');
    } finally {
      setGuardando(false);
    }
  }

  // ── Estilos ─────────────────────────────────────────────────────────────────
  const inputCls = (err?: string) =>
    `w-full px-3 py-2.5 rounded-lg border text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/30 focus:border-[#0f4c81] ${
      err ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300'
    }`;

  const disabled = guardando || !!exito;

  // ── Título del botón submit ──────────────────────────────────────────────────
  const labelSubmit = esEditar
    ? (guardando ? 'GUARDANDO...' : 'GUARDAR CAMBIOS')
    : (guardando ? 'REGISTRANDO...' : 'REGISTRAR NORMATIVA');

  return (
    <>
      {/* ── Éxito ─────────────────────────────────────────────────────────── */}
      {exito && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 rounded-xl flex items-center gap-2 font-medium">
          <svg className="w-4 h-4 flex-shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {exito}
        </div>
      )}

      {/* ── Error general ──────────────────────────────────────────────────── */}
      {errorGeneral && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errorGeneral}
        </div>
      )}

      {/* ── Formulario ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

        {/* INFORMACIÓN PRINCIPAL */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">INFORMACIÓN PRINCIPAL</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          {campo('Título', true, errors.titulo,
            <input
              type="text"
              data-no-uppercase="true"
              className={inputCls(errors.titulo)}
              placeholder="Ej: REGLAMENTO DE GESTIÓN ACADÉMICA"
              value={form.titulo}
              onChange={e => handleChange('titulo', normalizarMayusculas(e.target.value))}
              disabled={disabled}
              maxLength={200}
            />
          )}
          {campo('Tipo de normativa', true, errors.tipoNormativaId,
            <select
              className={inputCls(errors.tipoNormativaId)}
              value={form.tipoNormativaId}
              onChange={e => handleChange('tipoNormativaId', e.target.value)}
              disabled={disabled || cargandoOpciones}
              data-no-uppercase="true"
            >
              <option value="">{cargandoOpciones ? 'Cargando...' : '— Seleccionar tipo —'}</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          )}
        </div>

        {/* IDENTIFICACIÓN */}
        <div className="px-6 py-4 border-t border-b border-slate-100 bg-slate-50">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">IDENTIFICACIÓN</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {campo('N° de norma', true, errors.numeroNorma,
              <input
                type="text"
                className={inputCls(errors.numeroNorma)}
                placeholder="Ej: 002, RES-123, ORD-045/2026"
                value={form.numeroNorma}
                onChange={e => handleChange('numeroNorma', e.target.value)}
                disabled={disabled} data-no-uppercase="true"
              />
            )}
            {campo('Año (2 dígitos)', true, errors.anio,
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                className={inputCls(errors.anio)}
                placeholder="Ej: 26"
                value={form.anio}
                onChange={e => handleChange('anio', e.target.value.replace(/\D/g, '').slice(0, 2))}
                disabled={disabled} maxLength={2} data-no-uppercase="true"
              />
            )}
          </div>
          {campo('Fecha de emisión', true, errors.fechaEmision,
            <input
              type="date" className={inputCls(errors.fechaEmision)}
              value={form.fechaEmision} max={HOY_ISO}
              onChange={e => handleChange('fechaEmision', e.target.value)}
              disabled={disabled} data-no-uppercase="true"
            />
          )}
          {campo('Área emisora', true, errors.areaEmisora,
            <select
              className={inputCls(errors.areaEmisora)}
              value={form.areaEmisora}
              onChange={e => handleChange('areaEmisora', e.target.value)}
              disabled={disabled || cargandoOpciones} data-no-uppercase="true"
            >
              <option value="">{cargandoOpciones ? 'Cargando...' : '— Seleccionar área emisora —'}</option>
              {areasEmisoras.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
            </select>
          )}
          {campo('Vigencia', true, undefined,
            <select
              className={inputCls()} value={form.vigencia}
              onChange={e => handleChange('vigencia', e.target.value)}
              disabled={disabled} data-no-uppercase="true"
            >
              {VIGENCIAS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
        </div>

        {/* PALABRAS CLAVE */}
        <div className="px-6 py-4 border-t border-b border-slate-100 bg-slate-50">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">PALABRAS CLAVE</h2>
        </div>
        <div className="px-6 py-5">
          <div className="min-h-[56px] px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 bg-white transition-colors flex flex-wrap gap-2 items-center focus-within:ring-2 focus-within:ring-[#0f4c81]/30 focus-within:border-[#0f4c81]">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0f4c81]/10 text-[#0f4c81] text-xs font-semibold">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} disabled={disabled}
                  className="ml-0.5 hover:text-red-600 transition-colors leading-none" aria-label={`Eliminar ${tag}`}>
                  ×
                </button>
              </span>
            ))}
            <input
              ref={tagRef} type="text"
              className="flex-1 min-w-[120px] text-sm bg-transparent outline-none placeholder-slate-400"
              placeholder={tags.length === 0 ? 'Escribir y presionar Enter para agregar...' : 'Agregar más...'}
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={addTag}
              disabled={disabled} data-no-uppercase="true"
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Presioná Enter o coma para agregar cada etiqueta. Backspace elimina la última.
          </p>
        </div>

        {/* ARCHIVO PDF */}
        <div className="px-6 py-4 border-t border-b border-slate-100 bg-slate-50">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            ARCHIVO PDF{!esEditar && <span className="text-red-500 ml-1">*</span>}
          </h2>
        </div>
        <div className="px-6 py-5 space-y-3">

          {/* ── Modo editar: documento actual ─────────────────────────────── */}
          {esEditar && archivoActual?.nombre && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">DOCUMENTO ACTUAL</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{archivoActual.nombre}</p>
                  {archivoActual.tamanio != null && (
                    <p className="text-xs text-slate-500">{formatBytes(archivoActual.tamanio)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={verPdfActual}
                  disabled={viendoPdfActual || disabled}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0f4c81]/20 bg-[#0f4c81]/5 text-[#0f4c81] text-xs font-semibold hover:bg-[#0f4c81] hover:text-white hover:border-[#0f4c81] transition-all disabled:opacity-50"
                >
                  {viendoPdfActual ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                  VER DOCUMENTO
                </button>
              </div>

              {/* Toggle reemplazar */}
              {!reemplazando ? (
                <button
                  type="button"
                  onClick={() => setReemplazando(true)}
                  disabled={disabled}
                  className="mt-1 text-xs font-semibold text-[#0f4c81] hover:underline disabled:opacity-50"
                >
                  + Reemplazar archivo PDF
                </button>
              ) : (
                <button
                  type="button"
                  onClick={cancelarReemplazo}
                  disabled={disabled}
                  className="mt-1 text-xs font-semibold text-slate-500 hover:underline disabled:opacity-50"
                >
                  × Cancelar reemplazo
                </button>
              )}
            </div>
          )}

          {/* Modo editar sin archivo actual */}
          {esEditar && !archivoActual?.nombre && !reemplazando && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">DOCUMENTO ACTUAL</p>
              <p className="text-sm text-slate-500">Esta normativa no tiene un documento PDF asociado.</p>
              <button
                type="button"
                onClick={() => setReemplazando(true)}
                disabled={disabled}
                className="mt-2 text-xs font-semibold text-[#0f4c81] hover:underline disabled:opacity-50"
              >
                + Adjuntar archivo PDF
              </button>
            </div>
          )}

          {/* Zona de carga (crear siempre / editar solo cuando reemplazando) */}
          {(!esEditar || reemplazando) && (
            <>
              {!archivo ? (
                <label
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-all cursor-pointer px-6 py-8 ${
                    isDragging
                      ? 'border-[#0f4c81] bg-blue-50 scale-[1.01] shadow-sm'
                      : errorArchivo
                        ? 'border-red-300 bg-red-50 hover:border-red-400'
                        : 'border-slate-200 bg-slate-50 hover:border-[#0f4c81]/40 hover:bg-blue-50/30'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onDragEnter={disabled ? undefined : handleDragEnter}
                  onDragOver={disabled ? undefined : handleDragOver}
                  onDragLeave={disabled ? undefined : handleDragLeave}
                  onDrop={disabled ? undefined : handleDrop}
                >
                  <input
                    ref={archivoRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleArchivoChange}
                    disabled={disabled}
                  />
                  {isDragging ? (
                    <>
                      <svg className="w-10 h-10 text-[#0f4c81]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <div className="text-center">
                        <p className="text-sm font-bold text-[#0f4c81] tracking-wide">SOLTAR PDF AQUÍ</p>
                        <p className="text-xs text-[#0f4c81]/60 mt-0.5">Suelta el archivo para cargarlo</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <svg className={`w-10 h-10 ${errorArchivo ? 'text-red-400' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-slate-700">
                          {esEditar ? 'Seleccioná el nuevo archivo PDF' : 'Hacé clic para seleccionar el archivo PDF'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Arrastrá aquí o hacé clic — solo .pdf, máximo {MAX_MB} MB
                        </p>
                      </div>
                    </>
                  )}
                </label>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{archivo.name}</p>
                    <p className="text-xs text-slate-500">{formatBytes(archivo.size)}</p>
                  </div>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={quitarArchivoNuevo}
                      className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Quitar archivo"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Error de archivo */}
          {errorArchivo && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-red-700 font-medium leading-relaxed">{errorArchivo}</p>
            </div>
          )}
        </div>

        {/* PIE */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] text-slate-400 font-medium">
            Los campos marcados con * son obligatorios
          </p>
          <div className="flex items-center gap-3">
            <a
              href={volverHref}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all"
            >
              CANCELAR
            </a>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={disabled}
              className="px-5 py-2 rounded-lg bg-[#0f4c81] hover:bg-[#0d3f6d] text-white text-sm font-bold tracking-wide transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {guardando && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {labelSubmit}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
