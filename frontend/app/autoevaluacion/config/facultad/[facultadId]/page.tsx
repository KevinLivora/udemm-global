'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, mensajeErrorHttp } from '@/lib/api';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface ConfigFacultad {
  id: string;
  facultadId: string;
  p01TopeH: number;
  p02BajaH: number;
  p03MaxMat: number;
  updatedAt: string;
  updatedBy?: string | null;
}

type CampoFacultad = 'p01TopeH' | 'p02BajaH' | 'p03MaxMat';

// ── Metadatos de los tres parámetros ────────────────────────────────────────

interface ParamMeta {
  campo: CampoFacultad;
  codigo: string;
  nombre: string;
  descripcion: string;
  unidad: string;
  min: number;
  max?: number;
}

const PARAMETROS: ParamMeta[] = [
  {
    campo: 'p01TopeH',
    codigo: 'P-01',
    nombre: 'Tope semanal de horas docentes',
    descripcion: 'Máximo de horas semanales admitido por docente. Será utilizado por R-03 (indicador diferido).',
    unidad: 'h/sem',
    min: 1,
    max: 168,
  },
  {
    campo: 'p02BajaH',
    codigo: 'P-02',
    nombre: 'Umbral de baja dedicación',
    descripcion: 'Docentes con horas semanales por debajo de este umbral se consideran de baja dedicación. Debe ser estrictamente menor que P-01. Será utilizado por R-10 (indicador diferido).',
    unidad: 'h/sem',
    min: 1,
  },
  {
    campo: 'p03MaxMat',
    codigo: 'P-03',
    nombre: 'Máximo de materias por docente',
    descripcion: 'Límite de materias activas que puede tener un docente simultáneamente. Utilizado actualmente por R-07.',
    unidad: 'materias',
    min: 1,
    max: 20,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const IcSpinner = ({ sm }: { sm?: boolean }) => (
  <span className={`inline-block rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin flex-shrink-0 ${sm ? 'w-3.5 h-3.5' : 'w-5 h-5'}`} />
);

const IcRefresh = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── Validaciones ─────────────────────────────────────────────────────────────

function validarP01(v: string): string | null {
  if (v === '') return 'Campo requerido';
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return 'Debe ser un entero ≥ 1';
  if (n > 168) return 'Máximo 168 h/sem';
  return null;
}

function validarP02(v: string, p01: string): string | null {
  if (v === '') return 'Campo requerido';
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return 'Debe ser un entero ≥ 1';
  const n01 = Number(p01);
  if (p01 !== '' && Number.isInteger(n01) && n01 >= 1 && n >= n01) {
    return `Debe ser menor que P-01 (${n01} h/sem)`;
  }
  return null;
}

function validarP03(v: string): string | null {
  if (v === '') return 'Campo requerido';
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return 'Debe ser un entero ≥ 1';
  if (n > 20) return 'Máximo 20 materias';
  return null;
}

// ── Componente interno ────────────────────────────────────────────────────────

function ConfigFacultadInner() {
  const { usuario } = useAuth();
  const params      = useParams<{ facultadId: string }>();
  const facultadId  = params.facultadId;

  const esAdmin = usuario?.rol?.nombre === 'ADMINISTRADOR_SISTEMA';

  const [cargando,      setCargando]      = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [config,        setConfig]        = useState<ConfigFacultad | null>(null);
  const [sinConfigurar, setSinConfigurar] = useState(false);

  const [form, setForm] = useState<Record<CampoFacultad, string>>({
    p01TopeH: '',
    p02BajaH: '',
    p03MaxMat: '',
  });
  const snapshotRef = useRef<Record<CampoFacultad, string>>({
    p01TopeH: '',
    p02BajaH: '',
    p03MaxMat: '',
  });

  const [guardando,     setGuardando]     = useState(false);
  const [exito,         setExito]         = useState(false);
  const [errorGuardar,  setErrorGuardar]  = useState<string | null>(null);

  // Evita que respuestas de solicitudes previas sobrescriban el estado si cambia facultadId
  const generacionRef = useRef(0);

  // ── Carga ────────────────────────────────────────────────────────────────

  async function cargar() {
    setCargando(true);
    setError(null);
    setExito(false);
    setErrorGuardar(null);
    const miGeneracion = ++generacionRef.current;

    try {
      const res  = await apiFetch(`/autoevaluacion/config/facultad/${facultadId}`);
      const data = await res.json().catch(() => null);

      if (miGeneracion !== generacionRef.current) return;

      if (!res.ok) {
        if (res.status === 403) throw new Error('No tenés acceso a la configuración de esta facultad.');
        if (res.status === 404) throw new Error('La facultad indicada no existe.');
        throw new Error(mensajeErrorHttp(res, data, 'Error al cargar la configuración'));
      }

      if (data === null) {
        // La facultad existe pero no tiene config aún — no es un error
        setSinConfigurar(true);
        setConfig(null);
        setForm({ p01TopeH: '', p02BajaH: '', p03MaxMat: '' });
        snapshotRef.current = { p01TopeH: '', p02BajaH: '', p03MaxMat: '' };
      } else {
        const cfg = data as ConfigFacultad;
        setSinConfigurar(false);
        setConfig(cfg);
        const valores: Record<CampoFacultad, string> = {
          p01TopeH: String(cfg.p01TopeH),
          p02BajaH: String(cfg.p02BajaH),
          p03MaxMat: String(cfg.p03MaxMat),
        };
        setForm(valores);
        snapshotRef.current = { ...valores };
      }
    } catch (e) {
      if (miGeneracion !== generacionRef.current) return;
      setError((e as Error).message);
    } finally {
      if (miGeneracion === generacionRef.current) setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [facultadId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Validación ───────────────────────────────────────────────────────────

  const errP01 = validarP01(form.p01TopeH);
  const errP02 = validarP02(form.p02BajaH, form.p01TopeH);
  const errP03 = validarP03(form.p03MaxMat);
  const hayErrores = !!(errP01 || errP02 || errP03);

  const erroresPorCampo: Record<CampoFacultad, string | null> = {
    p01TopeH: errP01,
    p02BajaH: errP02,
    p03MaxMat: errP03,
  };

  const campos: CampoFacultad[] = ['p01TopeH', 'p02BajaH', 'p03MaxMat'];
  const hayModificaciones = sinConfigurar
    ? campos.some(c => form[c] !== '')
    : campos.some(c => form[c] !== snapshotRef.current[c]);

  // ── Guardar ──────────────────────────────────────────────────────────────

  async function guardar() {
    if (!esAdmin || guardando || hayErrores || !hayModificaciones) return;

    setGuardando(true);
    setExito(false);
    setErrorGuardar(null);

    let payload: Record<string, number>;

    if (sinConfigurar) {
      // Creación: los tres campos son obligatorios (M-01)
      payload = {
        p01TopeH: Number(form.p01TopeH),
        p02BajaH: Number(form.p02BajaH),
        p03MaxMat: Number(form.p03MaxMat),
      };
    } else {
      // Actualización parcial: solo los campos modificados
      payload = {};
      for (const campo of campos) {
        if (form[campo] !== snapshotRef.current[campo]) {
          payload[campo] = Number(form[campo]);
        }
      }
    }

    try {
      const res  = await apiFetch(`/autoevaluacion/config/facultad/${facultadId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al guardar la configuración'));

      const cfg = data as ConfigFacultad;
      const nuevosValores: Record<CampoFacultad, string> = {
        p01TopeH: String(cfg.p01TopeH),
        p02BajaH: String(cfg.p02BajaH),
        p03MaxMat: String(cfg.p03MaxMat),
      };
      setConfig(cfg);
      setSinConfigurar(false);
      setForm(nuevosValores);
      snapshotRef.current = { ...nuevosValores };
      setExito(true);
    } catch (e) {
      setErrorGuardar((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const mostrarFormulario = !cargando && !error && (config !== null || sinConfigurar);

  return (
    <div className="max-w-2xl mx-auto">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <Link href="/autoevaluacion" className="hover:text-slate-600 transition-colors">Autoevaluación</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">Parámetros de facultad</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
            MOD-AUT · Configuración de facultad
          </p>
          <h1 className="text-xl font-bold text-slate-800">
            Parámetros de autoevaluación por facultad
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/autoevaluacion"
            className="text-xs font-semibold text-slate-500 hover:text-[#0f4c81] hover:bg-[#0f4c81]/5 px-3 py-2 rounded-lg border border-slate-200 transition-colors"
          >
            ← Volver
          </Link>
          <button
            onClick={cargar}
            disabled={cargando}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/8 active:bg-[#0f4c81]/15 px-3 py-2 rounded-lg border border-[#0f4c81]/15 transition-colors disabled:opacity-50"
          >
            {cargando ? <IcSpinner sm /> : <IcRefresh />}
            Recargar
          </button>
        </div>
      </div>

      {/* Modo lectura para roles no administradores */}
      {!esAdmin && !cargando && !error && (
        <div className="mb-4 p-3 rounded-lg bg-sky-50 border border-sky-200">
          <p className="text-xs text-sky-700">
            <span className="font-semibold">Modo lectura.</span>{' '}
            Solo el Administrador del Sistema puede modificar los parámetros de facultad.
          </p>
        </div>
      )}

      {/* Cargando */}
      {cargando && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex items-center justify-center gap-3">
          <IcSpinner />
          <span className="text-sm text-slate-500">Cargando configuración...</span>
        </div>
      )}

      {/* Error de carga */}
      {!cargando && error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Aviso de facultad sin configurar */}
      {!cargando && !error && sinConfigurar && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm font-semibold text-amber-800 mb-1">Sin configurar</p>
          <p className="text-xs text-amber-700">
            {esAdmin
              ? 'Esta facultad no tiene parámetros configurados aún. Completá los tres campos para crear la configuración inicial.'
              : 'Esta facultad no tiene parámetros configurados aún. El Administrador del Sistema debe realizar la configuración inicial.'}
          </p>
        </div>
      )}

      {/* Formulario / vista de parámetros */}
      {mostrarFormulario && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Cabecera de la tarjeta */}
          <div className="px-5 py-4 border-b border-slate-100 bg-[#0f4c81]/3">
            <p className="text-xs font-semibold text-[#0f4c81]">Parámetros P-01, P-02 y P-03</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Estos parámetros aplican a todos los docentes de la facultad y son compartidos por todas sus carreras.
              {esAdmin && sinConfigurar && ' Los tres campos son requeridos para la configuración inicial.'}
            </p>
          </div>

          {/* Filas de parámetros */}
          <div className="divide-y divide-slate-50">
            {PARAMETROS.map(({ campo, codigo, nombre, descripcion, unidad, min, max }) => {
              const errCampo   = erroresPorCampo[campo];
              const modificado = esAdmin && !sinConfigurar && form[campo] !== snapshotRef.current[campo];
              const valorActual = config ? (config[campo] as number) : null;

              return (
                <div key={campo} className="px-5 py-4 flex items-start gap-4">
                  {/* Código + nombre */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/10">
                        {codigo}
                      </span>
                      {modificado && (
                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          modificado
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-700 leading-snug">{nombre}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{descripcion}</p>
                    {errCampo && esAdmin && (
                      <p className="text-[11px] text-red-600 mt-1">{errCampo}</p>
                    )}
                  </div>

                  {/* Control de valor */}
                  <div className="flex-shrink-0 w-40">
                    {esAdmin ? (
                      <div>
                        <input
                          type="number"
                          min={min}
                          max={max}
                          step={1}
                          value={form[campo]}
                          onChange={e => {
                            setExito(false);
                            setErrorGuardar(null);
                            setForm(prev => ({ ...prev, [campo]: e.target.value }));
                          }}
                          placeholder="—"
                          className={`w-full text-xs border rounded-lg px-3 py-2 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] ${
                            errCampo
                              ? 'border-red-300 bg-red-50'
                              : modificado
                              ? 'border-amber-300 bg-amber-50'
                              : 'border-slate-200 bg-white'
                          }`}
                        />
                        <p className="text-[10px] text-slate-400 text-right mt-0.5">{unidad}</p>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold tabular-nums text-right text-slate-700">
                        {valorActual !== null
                          ? <>{valorActual} <span className="text-xs font-normal text-slate-400">{unidad}</span></>
                          : <span className="text-slate-400 font-normal text-xs">Sin configurar</span>
                        }
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Última actualización */}
          {config?.updatedAt && (
            <div className="px-5 py-2.5 bg-slate-50/60 border-t border-slate-100">
              <p className="text-[11px] text-slate-400">
                Última actualización: {formatFecha(config.updatedAt)}
                {config.updatedBy ? ` · por ${config.updatedBy}` : ''}
              </p>
            </div>
          )}

          {/* Pie del formulario — solo administrador */}
          {esAdmin && (
            <div className="px-5 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="min-h-[1.5rem]">
                {exito && !errorGuardar && (
                  <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                    <span className="text-emerald-500">✓</span>
                    Configuración guardada correctamente.
                  </p>
                )}
                {errorGuardar && (
                  <p className="text-xs text-red-700">{errorGuardar}</p>
                )}
              </div>
              <button
                onClick={guardar}
                disabled={guardando || hayErrores || !hayModificaciones}
                className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-[#0f4c81] text-white hover:bg-[#0a3d6e] active:bg-[#082f55] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {guardando ? <><IcSpinner sm />Guardando...</> : 'Guardar parámetros'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Nota informativa */}
      {!cargando && !error && (
        <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
          Cambiar P-03 afecta la próxima evaluación de R-07.
          P-01 y P-02 se almacenan para uso futuro de R-03 y R-10, indicadores actualmente diferidos.
        </p>
      )}
    </div>
  );
}

// ── Exportación con Suspense (patrón defensivo para App Router de Next.js 14) ─

export default function ConfigFacultadPage() {
  return (
    <Suspense fallback={null}>
      <ConfigFacultadInner />
    </Suspense>
  );
}
