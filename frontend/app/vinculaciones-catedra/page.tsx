'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { normalizarMayusculas } from '@/lib/normalizarMayusculas';
import { FormularioVinculacion } from './_components/FormularioVinculacion';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Vinculacion {
  id: string;
  estado: string;
  fechaCreacion: string;
  horasSemana?: number | null;
  anioInicio?: number | null;
  facultad:    { nombre: string };
  carrera:     { nombre: string };
  planEstudio: { nombre: string; codigo?: string };
  materia:     { nombre: string; codigo?: string };
  docente:     { nombre: string; apellido: string };
  catedra:     { nombre: string };
  cargo:       { nombre: string };
  modalidad:   { nombre: string };
  designacion: { nombre: string };
  usuarioSolicitante: { nombre: string; apellido: string };
  observaciones?: string;
  // Aprobación / rechazo
  aprobador?: { nombre: string; apellido: string } | null;
  fechaAprobacion?: string | null;
  motivoRechazo?: string | null;
  // Desvinculación
  desvinculador?: { nombre: string; apellido: string } | null;
  fechaDesvinculacion?: string | null;
  motivoDesvinculacion?: string | null;
  fechaRegistroDesvinculacion?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

function badgeEstado(estado: string) {
  switch (estado) {
    case 'PENDIENTE_DE_APROBACION':
      return <span className="inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Pendiente</span>;
    case 'APROBADA':
      return <span className="inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Aprobada</span>;
    case 'RECHAZADA':
      return <span className="inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Rechazada</span>;
    case 'DESVINCULADA':
      return <span className="inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Desvinculada</span>;
    default:
      return <span className="inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">{estado}</span>;
  }
}

function formatFecha(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IcPlus = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const IcSearch = () => (
  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const IcSpinner = () => (
  <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-[#0f4c81] animate-spin" />
);
const IcEmpty = () => (
  <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899l4-4a4 4 0 115.656 5.656l-1.1 1.1" />
  </svg>
);
const IcX = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ── CampoDetalle — campo de solo lectura para el modal Ver ───────────────────

function CampoDetalle({
  label,
  valor,
  sub,
  largo = false,
}: {
  label: string;
  valor?: string | null;
  sub?: string | null;
  largo?: boolean;
}) {
  return (
    <div className={largo ? '' : ''}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">{label}</dt>
      <dd className={`text-sm text-slate-800 ${largo ? 'whitespace-pre-wrap break-words leading-relaxed' : 'font-medium'}`}>
        {valor ?? <span className="text-slate-400 font-normal italic text-xs">—</span>}
        {sub && <span className="block text-xs text-slate-400 font-normal">{sub}</span>}
      </dd>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VinculacionesCatedraPage() {
  const [items, setItems]           = useState<Vinculacion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [buscar, setBuscar]         = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [formulario, setFormulario] = useState(false);
  const [exito, setExito]           = useState<string | null>(null);

  const [pagina, setPagina] = useState(1);
  const [paginacion, setPaginacion] = useState<{
    total: number; pagina: number; limite: number; totalPaginas: number;
  } | null>(null);

  // Ver detalle
  const [verTarget, setVerTarget] = useState<Vinculacion | null>(null);

  // Desvincular
  const [desvinculandoTarget, setDesvinculandoTarget] = useState<Vinculacion | null>(null);
  const [formDesvincular, setFormDesvincular] = useState({ fecha: '', motivo: '' });
  const [desvinculando, setDesvinculando]     = useState(false);
  const [errorDesvincular, setErrorDesvincular] = useState<string | null>(null);

  // Refs para evitar closures stale en cargar (no disparan re-renders)
  const buscarRef       = useRef('');
  const filtroEstadoRef = useRef('');
  const paginaRef       = useRef(1);
  const abortRef        = useRef<AbortController | null>(null);
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  function abrirDesvincular(v: Vinculacion) {
    setDesvinculandoTarget(v);
    setFormDesvincular({ fecha: new Date().toISOString().split('T')[0], motivo: '' });
    setErrorDesvincular(null);
  }

  function cerrarDesvincular() {
    setDesvinculandoTarget(null);
    setErrorDesvincular(null);
  }

  // ── Carga de datos ─────────────────────────────────────────────────────────
  // cargar recibe todos los parámetros explícitamente — no captura nada por closure.
  // Esto elimina el bug de "último carácter no aplicado" causado por:
  //   1. UppercaseInputGuard: muta element.value en capture phase antes de React onChange
  //   2. useCallback([buscar, filtroEstado, pagina]): valores stale en closure async
  const cargar = useCallback(async (pg: number, termino: string, estado: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    paginaRef.current = pg;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (termino.trim()) params.set('buscar', termino.trim());
      if (estado)         params.set('estado', estado);
      params.set('page',  String(pg));
      params.set('limit', '10');
      const r = await apiFetch(`${API}/vinculaciones-catedra?${params}`, { signal } as RequestInit);
      if (signal.aborted) return;
      if (!r.ok) throw new Error('Error al cargar las vinculaciones');
      const resp = await r.json();
      setItems(resp.data);
      setPaginacion({ total: resp.total, pagina: resp.pagina, limite: resp.limite, totalPaginas: resp.totalPaginas });
      setPagina(pg);
    } catch (e: unknown) {
      if (signal.aborted) return;
      setError((e as Error).message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []); // deps vacíos — lee de params explícitos y refs; nunca stale

  // Carga inicial; cargar es estable (deps vacíos), este effect solo corre al montar
  useEffect(() => {
    cargar(1, '', '');
    return () => { abortRef.current?.abort(); };
  }, [cargar]);

  // ── Handlers de filtros ────────────────────────────────────────────────────

  function handleBuscarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = normalizarMayusculas(e.target.value);
    // Actualizar ref PRIMERO (sincrónico) — cargar siempre leerá el valor actual
    buscarRef.current = value;
    setBuscar(value);
    // Debounce en el handler mismo, no en un useEffect, para evitar cascadas async
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      cargar(1, buscarRef.current, filtroEstadoRef.current);
    }, 350);
  }

  function handleFiltroEstadoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    filtroEstadoRef.current = value;
    setFiltroEstado(value);
    cargar(1, buscarRef.current, value);
  }

  // ── Acciones ───────────────────────────────────────────────────────────────

  async function confirmarDesvincular() {
    if (!desvinculandoTarget) return;
    setDesvinculando(true);
    setErrorDesvincular(null);
    try {
      const r = await apiFetch(`${API}/vinculaciones-catedra/${desvinculandoTarget.id}/desvincular`, {
        method: 'PATCH',
        body: JSON.stringify({
          fechaDesvinculacion:  formDesvincular.fecha,
          motivoDesvinculacion: formDesvincular.motivo,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message ?? `Error ${r.status}`);
      }
      cerrarDesvincular();
      setExito(`Vinculación de ${desvinculandoTarget.docente.apellido}, ${desvinculandoTarget.docente.nombre} finalizada correctamente.`);
      setTimeout(() => setExito(null), 6000);
      cargar(paginaRef.current, buscarRef.current, filtroEstadoRef.current);
    } catch (e) {
      setErrorDesvincular((e as Error).message);
    } finally {
      setDesvinculando(false);
    }
  }

  function onGuardado() {
    setFormulario(false);
    setExito('Vinculación creada correctamente. Quedó en estado Pendiente de Aprobación.');
    setTimeout(() => setExito(null), 5000);
    cargar(1, buscarRef.current, filtroEstadoRef.current);
  }

  return (
    <div className="p-6 sm:p-8">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Gestión Académica</p>
          <h1 className="text-xl font-bold text-slate-800">Vinculación a Cátedra</h1>
          <p className="mt-1 text-sm text-slate-500">
            Registrá la asignación de docentes a cátedras de asignaturas. Las vinculaciones quedan pendientes de aprobación.
          </p>
        </div>
        <button
          onClick={() => setFormulario(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0f4c81] text-white text-sm font-semibold rounded-xl hover:bg-[#0d3e6b] transition-colors shadow-sm flex-shrink-0"
        >
          <IcPlus />
          Nueva Vinculación
        </button>
      </div>

      {/* Toast éxito */}
      {exito && (
        <div className="mb-4 flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {exito}
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2"><IcSearch /></span>
          {/*
            data-no-uppercase="true" evita que UppercaseInputGuard (listener global en
            fase capture) mute element.value antes de que React procese el evento,
            lo que causaba el bug de "último carácter no aplicado".
          */}
          <input
            data-no-uppercase="true"
            value={buscar}
            onChange={handleBuscarChange}
            placeholder="Buscar por docente, asignatura o carrera…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/15 transition"
          />
        </div>
        <select
          value={filtroEstado}
          onChange={handleFiltroEstadoChange}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/15 transition min-w-[180px]"
        >
          <option value="">Todos los estados</option>
          <option value="PENDIENTE_DE_APROBACION">Pendiente de aprobación</option>
          <option value="APROBADA">Aprobada</option>
          <option value="RECHAZADA">Rechazada</option>
          <option value="DESVINCULADA">Desvinculada</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/*
          overflow-x-auto sobre el contenedor de la tabla garantiza scroll horizontal
          en resoluciones menores. Se eliminaron las clases hidden XX:table-cell que
          antes ocultaban columnas en pantallas chicas.
        */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Docente</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Asignatura</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Carrera / Plan</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Cátedra · Cargo</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Modalidad · Designación</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">H/SEM · Año</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Estado</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Fecha</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                      <IcSpinner />
                      Cargando…
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <IcEmpty />
                      <div>
                        <p className="text-sm font-semibold text-slate-600 mb-1">Sin vinculaciones</p>
                        <p className="text-xs text-slate-400">
                          {buscar || filtroEstado
                            ? 'No hay resultados para los filtros aplicados.'
                            : 'Aún no se registraron vinculaciones. Hacé clic en "Nueva Vinculación" para comenzar.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : items.map(v => (
                <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="block font-medium text-slate-800">{v.docente.apellido},</span>
                    <span className="block font-medium text-slate-800">{v.docente.nombre}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-slate-700">{v.materia.nombre}</span>
                    {v.materia.codigo && <span className="block text-xs text-slate-400">{v.materia.codigo}</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-slate-700">{v.carrera.nombre}</span>
                    <span className="block text-xs text-slate-400">{v.planEstudio.nombre}</span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="text-slate-700">{v.catedra.nombre}</span>
                    <span className="block text-xs text-slate-400">{v.cargo.nombre}</span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="text-slate-700">{v.modalidad.nombre}</span>
                    <span className="block text-xs text-slate-400">{v.designacion.nombre}</span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="text-slate-700 font-medium">
                      {v.horasSemana != null ? `${v.horasSemana} h/sem` : <span className="text-slate-400 text-xs italic">—</span>}
                    </span>
                    <span className="block text-xs text-slate-400">{v.anioInicio ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3.5">{badgeEstado(v.estado)}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                    {formatFecha(v.fechaCreacion)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setVerTarget(v)}
                        className="text-[11px] font-semibold text-slate-600 border border-slate-200 bg-white px-2.5 py-1 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        Ver
                      </button>
                      {v.estado === 'APROBADA' && (
                        <button
                          onClick={() => abrirDesvincular(v)}
                          className="text-[11px] font-semibold text-red-600 border border-red-200 bg-red-50 px-2.5 py-1 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap"
                        >
                          Desvincular
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && paginacion && paginacion.total > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex-wrap gap-2">
            <span className="text-xs text-slate-400">
              Mostrando {(paginacion.pagina - 1) * paginacion.limite + 1}–{Math.min(paginacion.pagina * paginacion.limite, paginacion.total)} de {paginacion.total} vinculación{paginacion.total !== 1 ? 'es' : ''}
            </span>
            {paginacion.totalPaginas > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { const p = Math.max(1, pagina - 1); cargar(p, buscarRef.current, filtroEstadoRef.current); }}
                  disabled={paginacion.pagina <= 1}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap px-1">
                  Página {paginacion.pagina} de {paginacion.totalPaginas}
                </span>
                <button
                  onClick={() => { const p = Math.min(paginacion.totalPaginas, pagina + 1); cargar(p, buscarRef.current, filtroEstadoRef.current); }}
                  disabled={paginacion.pagina >= paginacion.totalPaginas}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer formulario */}
      {formulario && (
        <FormularioVinculacion
          onGuardado={onGuardado}
          onCerrar={() => setFormulario(false)}
        />
      )}

      {/* Modal Ver — detalle solo lectura */}
      {verTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-800">Detalle de Vinculación</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {verTarget.docente.apellido}, {verTarget.docente.nombre} · {verTarget.materia.nombre}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {badgeEstado(verTarget.estado)}
                <button
                  onClick={() => setVerTarget(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors ml-1"
                >
                  <IcX />
                </button>
              </div>
            </div>

            {/* Body scrollable */}
            <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">

              {/* Sección: Asignación Académica */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Asignación Académica</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  <CampoDetalle label="Facultad"       valor={verTarget.facultad.nombre} />
                  <CampoDetalle label="Carrera"        valor={verTarget.carrera.nombre} />
                  <CampoDetalle label="Plan de Estudios" valor={verTarget.planEstudio.nombre} sub={verTarget.planEstudio.codigo} />
                  <CampoDetalle label="Asignatura"     valor={verTarget.materia.nombre} sub={verTarget.materia.codigo} />
                </dl>
              </section>

              <hr className="border-slate-100" />

              {/* Sección: Docente */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Docente y Cátedra</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  <CampoDetalle label="Docente"    valor={`${verTarget.docente.apellido}, ${verTarget.docente.nombre}`} />
                  <CampoDetalle label="Cátedra"    valor={verTarget.catedra.nombre} />
                  <CampoDetalle label="Cargo"      valor={verTarget.cargo.nombre} />
                  <CampoDetalle label="Modalidad"  valor={verTarget.modalidad.nombre} />
                  <CampoDetalle label="Designación" valor={verTarget.designacion.nombre} />
                  <CampoDetalle label="Horas semanales" valor={verTarget.horasSemana != null ? `${verTarget.horasSemana} h/sem` : null} />
                  <CampoDetalle label="Año inicio" valor={verTarget.anioInicio?.toString() ?? null} />
                  {verTarget.observaciones && (
                    <div className="sm:col-span-2">
                      <CampoDetalle label="Observaciones" valor={verTarget.observaciones} largo />
                    </div>
                  )}
                </dl>
              </section>

              <hr className="border-slate-100" />

              {/* Sección: Trazabilidad */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Estado y Trazabilidad</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  <CampoDetalle label="Estado" valor={
                    verTarget.estado === 'PENDIENTE_DE_APROBACION' ? 'Pendiente de aprobación'
                    : verTarget.estado === 'APROBADA'              ? 'Aprobada'
                    : verTarget.estado === 'RECHAZADA'             ? 'Rechazada'
                    : verTarget.estado === 'DESVINCULADA'          ? 'Desvinculada'
                    : verTarget.estado
                  } />
                  <CampoDetalle label="Fecha de solicitud"   valor={formatFecha(verTarget.fechaCreacion)} />
                  <CampoDetalle label="Usuario solicitante"  valor={`${verTarget.usuarioSolicitante.apellido}, ${verTarget.usuarioSolicitante.nombre}`} />
                  {verTarget.aprobador && (
                    <CampoDetalle label="Usuario aprobador" valor={`${verTarget.aprobador.apellido}, ${verTarget.aprobador.nombre}`} />
                  )}
                  {verTarget.fechaAprobacion && (
                    <CampoDetalle label="Fecha de aprobación" valor={formatFecha(verTarget.fechaAprobacion)} />
                  )}
                  {verTarget.motivoRechazo && (
                    <div className="sm:col-span-2">
                      <CampoDetalle label="Motivo de rechazo" valor={verTarget.motivoRechazo} largo />
                    </div>
                  )}
                </dl>
              </section>

              {/* Sección: Desvinculación — solo si corresponde */}
              {verTarget.estado === 'DESVINCULADA' && (
                <>
                  <hr className="border-slate-100" />
                  <section>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Desvinculación</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      <CampoDetalle label="Fecha de desvinculación" valor={formatFecha(verTarget.fechaDesvinculacion)} />
                      {verTarget.desvinculador && (
                        <CampoDetalle label="Registrado por" valor={`${verTarget.desvinculador.apellido}, ${verTarget.desvinculador.nombre}`} />
                      )}
                      {verTarget.fechaRegistroDesvinculacion && (
                        <CampoDetalle label="Fecha de registro" valor={formatFecha(verTarget.fechaRegistroDesvinculacion)} />
                      )}
                      {verTarget.motivoDesvinculacion && (
                        <div className="sm:col-span-2">
                          <CampoDetalle label="Motivo de desvinculación" valor={verTarget.motivoDesvinculacion} largo />
                        </div>
                      )}
                    </dl>
                  </section>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <button
                onClick={() => setVerTarget(null)}
                className="px-5 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal desvincular */}
      {desvinculandoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-800">Finalizar Vinculación</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {desvinculandoTarget.docente.apellido}, {desvinculandoTarget.docente.nombre}
                </p>
              </div>
              <button
                onClick={cerrarDesvincular}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <IcX />
              </button>
            </div>

            {/* Resumen */}
            <div className="px-6 pt-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 space-y-1">
                <p><strong>Asignatura:</strong> {desvinculandoTarget.materia.nombre}</p>
                <p><strong>Carrera:</strong> {desvinculandoTarget.carrera.nombre} · {desvinculandoTarget.planEstudio.nombre}</p>
                <p><strong>Cátedra:</strong> {desvinculandoTarget.catedra.nombre} · <strong>Cargo:</strong> {desvinculandoTarget.cargo.nombre}</p>
                <p className="text-amber-700 pt-1 border-t border-amber-200 mt-2">
                  Esta acción no elimina la vinculación. Cambia su estado a <strong>Desvinculada</strong> y notifica al docente.
                </p>
              </div>
            </div>

            {/* Formulario */}
            <div className="px-6 pt-4 pb-2 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fecha de desvinculación <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formDesvincular.fecha}
                  onChange={e => setFormDesvincular(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/15 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo de desvinculación <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formDesvincular.motivo}
                  onChange={e => setFormDesvincular(f => ({ ...f, motivo: normalizarMayusculas(e.target.value) }))}
                  rows={4}
                  maxLength={2000}
                  placeholder="Describa el motivo de la finalización de la vinculación…"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/15 transition resize-none"
                />
                <p className="text-[11px] text-slate-400 mt-0.5 text-right">
                  {formDesvincular.motivo.length}/2000 · mínimo 10 caracteres
                </p>
              </div>

              {errorDesvincular && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                  {errorDesvincular}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={cerrarDesvincular}
                disabled={desvinculando}
                className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarDesvincular}
                disabled={desvinculando || !formDesvincular.fecha || formDesvincular.motivo.trim().length < 10}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {desvinculando ? 'Procesando…' : 'Confirmar desvinculación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
