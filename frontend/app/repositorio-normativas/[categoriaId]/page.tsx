'use client';

import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CambiarEstadoModal } from '../_components/CambiarEstadoModal';
import { EliminarNormativaModal } from '../_components/EliminarNormativaModal';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const ROLES_GESTION = ['SECRETARIA_ACADEMICA', 'DECANO', 'RECTORADO', 'ADMINISTRADOR_SISTEMA'];

// ── Tipos ─────────────────────────────────────────────────────────────────────

type EstadoRegistro = 'ACTIVAS' | 'ELIMINADAS' | 'TODAS';

interface NormativaItem {
  id: string;
  titulo: string;
  areaEmisora: string;
  numeroNorma: string;
  anio: number;
  fechaEmision: string;
  vigencia: string;
  tipoNormativa: { id: string; nombre: string };
  // Campos de baja lógica (presentes cuando estadoRegistro ≠ ACTIVAS)
  eliminado?: boolean;
  motivoEliminacion?: string | null;
  fechaEliminacion?: string | null;
  eliminadoPorNombre?: string | null;
}

interface ListadoResponse {
  data: NormativaItem[];
  total: number;
  paginaActual: number;
  limite: number;
  totalPaginas: number;
}

interface KpiData {
  vigentes: number;
  derogadas: number;
  suspendidas: number;
  total: number;
}

interface Filtros {
  busqueda: string;
  areaEmisora: string;
  vigencia: string;
  fechaDesde: string;
  fechaHasta: string;
}

const FILTROS_VACIOS: Filtros = {
  busqueda: '', areaEmisora: '', vigencia: '', fechaDesde: '', fechaHasta: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function vigenciaBadge(v: string) {
  switch (v) {
    case 'VIGENTE':     return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'DEROGADA':    return 'bg-red-50 text-red-700 border border-red-200';
    case 'SUSPENDIDA':  return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'REEMPLAZADA': return 'bg-slate-100 text-slate-600 border border-slate-200';
    default:            return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

function formatFecha(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
}

// ── Iconos ────────────────────────────────────────────────────────────────────

const IcFilter = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
  </svg>
);

const IcEye = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const IcEdit = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const IcState = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const IcTrash = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IcPdf = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
);

const IcExcel = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M3 3h18v18H3z" />
  </svg>
);

// ── Página ────────────────────────────────────────────────────────────────────

export default function CategoriaDetallePage() {
  const { usuario } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();

  const categoriaId = params?.categoriaId as string;
  const categoriaNombre = searchParams?.get('nombre') ?? 'Categoría';

  const rol = usuario?.rol?.nombre ?? '';
  const esDocente = rol === 'DOCENTE';
  const puedeGestionar = ROLES_GESTION.includes(rol);

  // ── Estado ──────────────────────────────────────────────────────────────────
  const [normativas, setNormativas] = useState<NormativaItem[]>([]);
  const [kpi, setKpi] = useState<KpiData>({ vigentes: 0, derogadas: 0, suspendidas: 0, total: 0 });
  const [cargando, setCargando] = useState(true);
  const [cargandoKpi, setCargandoKpi] = useState(true);
  const [error, setError] = useState('');
  const [pagina, setPagina] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [limite, setLimite] = useState(10);

  const [form, setForm] = useState<Filtros>(FILTROS_VACIOS);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [errorFiltros, setErrorFiltros] = useState('');

  const [estadoRegistro, setEstadoRegistro] = useState<EstadoRegistro>('ACTIVAS');
  const [totalEliminadas, setTotalEliminadas] = useState(0);

  const [exportando, setExportando]     = useState<'pdf' | 'excel' | null>(null);
  const [exportError, setExportError]   = useState('');

  const [triggerRefresh, setTriggerRefresh] = useState(0);
  const [normativaParaCambiarEstado, setNormativaParaCambiarEstado] = useState<NormativaItem | null>(null);
  const [normativaParaEliminar, setNormativaParaEliminar] = useState<NormativaItem | null>(null);
  const [mensajeExito, setMensajeExito] = useState('');

  const [areasEmisoras, setAreasEmisoras] = useState<{ id: string; nombre: string }[]>([]);
  const [cargandoAreas, setCargandoAreas] = useState(true);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!categoriaId) return;
    setCargandoKpi(true);
    const base = `${API}/normativas?tipoId=${categoriaId}&limit=1`;

    if (esDocente) {
      apiFetch(`${base}&vigencia=VIGENTE`)
        .then(r => r.ok ? r.json() : { total: 0 })
        .then(d => setKpi({ vigentes: d.total ?? 0, derogadas: 0, suspendidas: 0, total: d.total ?? 0 }))
        .catch(() => {})
        .finally(() => setCargandoKpi(false));
    } else {
      const kpiPromises: Promise<{ total: number }>[] = [
        apiFetch(`${base}&vigencia=VIGENTE`).then(r => r.ok ? r.json() : { total: 0 }),
        apiFetch(`${base}&vigencia=DEROGADA`).then(r => r.ok ? r.json() : { total: 0 }),
        apiFetch(`${base}&vigencia=SUSPENDIDA`).then(r => r.ok ? r.json() : { total: 0 }),
        apiFetch(`${API}/normativas?tipoId=${categoriaId}&limit=1`).then(r => r.ok ? r.json() : { total: 0 }),
      ];
      if (puedeGestionar) {
        kpiPromises.push(
          apiFetch(`${API}/normativas?tipoId=${categoriaId}&estadoRegistro=ELIMINADAS&limit=1`).then(r => r.ok ? r.json() : { total: 0 }),
        );
      }
      Promise.all(kpiPromises)
        .then(results => {
          setKpi({
            vigentes:    results[0].total ?? 0,
            derogadas:   results[1].total ?? 0,
            suspendidas: results[2].total ?? 0,
            total:       results[3].total ?? 0,
          });
          if (puedeGestionar && results[4]) setTotalEliminadas(results[4].total ?? 0);
        })
        .catch(() => {})
        .finally(() => setCargandoKpi(false));
    }
  }, [categoriaId, esDocente, puedeGestionar, triggerRefresh]);

  // ── Áreas emisoras ──────────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch(`${API}/configuracion/tablas-maestras/tipos-area-emisora/activos`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setAreasEmisoras(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setCargandoAreas(false));
  }, []);

  // ── Listado ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!categoriaId) return;
    setCargando(true);
    setError('');

    const url = new URL(`${API}/normativas`);
    url.searchParams.set('tipoId', categoriaId);
    url.searchParams.set('page', String(pagina));
    url.searchParams.set('limit', '10');
    if (filtros.busqueda)    url.searchParams.set('busqueda',    filtros.busqueda);
    if (filtros.areaEmisora) url.searchParams.set('areaEmisora', filtros.areaEmisora);
    if (filtros.vigencia)    url.searchParams.set('vigencia',    filtros.vigencia);
    if (filtros.fechaDesde)  url.searchParams.set('fechaDesde',  filtros.fechaDesde);
    if (filtros.fechaHasta)  url.searchParams.set('fechaHasta',  filtros.fechaHasta);
    // El backend solo aplica estadoRegistro si el rol lo permite
    if (puedeGestionar && estadoRegistro !== 'ACTIVAS') {
      url.searchParams.set('estadoRegistro', estadoRegistro);
    }

    apiFetch(url.toString())
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: ListadoResponse) => {
        setNormativas(Array.isArray(d.data) ? d.data : []);
        setTotalRegistros(d.total ?? 0);
        setTotalPaginas(d.totalPaginas ?? 1);
        setLimite(d.limite ?? 10);
      })
      .catch(() => setError('No se pudieron cargar las normativas.'))
      .finally(() => setCargando(false));
  }, [categoriaId, pagina, filtros, estadoRegistro, puedeGestionar, triggerRefresh]);

  // ── Handlers filtros ────────────────────────────────────────────────────────
  function handleBuscar() {
    if (form.fechaDesde && form.fechaHasta && form.fechaDesde > form.fechaHasta) {
      setErrorFiltros('LOS FILTROS APLICADOS NO SON VÁLIDOS. La fecha desde no puede ser posterior a la fecha hasta.');
      return;
    }
    setErrorFiltros('');
    setFiltros({ ...form });
    setPagina(1);
  }

  function handleLimpiar() {
    setForm(FILTROS_VACIOS);
    setFiltros(FILTROS_VACIOS);
    setPagina(1);
    setErrorFiltros('');
  }

  function handleEstadoRegistroChange(nuevo: EstadoRegistro) {
    setEstadoRegistro(nuevo);
    setPagina(1);
    // Vigencia no aplica sobre eliminadas — limpiar para evitar filtros contradictorios
    if (nuevo === 'ELIMINADAS') {
      setForm(prev => ({ ...prev, vigencia: '' }));
      setFiltros(prev => ({ ...prev, vigencia: '' }));
    }
  }

  const hayFiltrosActivos = Object.values(filtros).some(v => v !== '');

  // ── Exportación ──────────────────────────────────────────────────────────────
  async function handleExportar(formato: 'pdf' | 'excel') {
    setExportando(formato);
    setExportError('');
    try {
      const url = new URL(`${API}/normativas/exportar/${formato}`);
      url.searchParams.set('tipoId', categoriaId);
      if (filtros.busqueda)    url.searchParams.set('busqueda',    filtros.busqueda);
      if (filtros.areaEmisora) url.searchParams.set('areaEmisora', filtros.areaEmisora);
      if (filtros.vigencia)    url.searchParams.set('vigencia',    filtros.vigencia);
      if (filtros.fechaDesde)  url.searchParams.set('fechaDesde',  filtros.fechaDesde);
      if (filtros.fechaHasta)  url.searchParams.set('fechaHasta',  filtros.fechaHasta);
      if (puedeGestionar && estadoRegistro !== 'ACTIVAS') {
        url.searchParams.set('estadoRegistro', estadoRegistro);
      }

      const res = await apiFetch(url.toString());
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error((msg as any)?.message ?? 'Error al generar la exportación.');
      }

      const blob = await res.blob();
      const ext  = formato === 'pdf' ? 'pdf' : 'xlsx';
      const dia  = new Date().toISOString().slice(0, 10);
      const nombre = `normativas-${categoriaNombre.replace(/\s+/g, '-').toLowerCase()}-${dia}.${ext}`;

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      setExportError('No se pudo generar la exportación. Intentá nuevamente.');
      setTimeout(() => setExportError(''), 5000);
    } finally {
      setExportando(null);
    }
  }

  // ── Handlers cambio de estado ───────────────────────────────────────────────
  function handleEstadoConfirmado() {
    setNormativaParaCambiarEstado(null);
    setTriggerRefresh(n => n + 1);
    setMensajeExito('ESTADO ACTUALIZADO CORRECTAMENTE.');
    setTimeout(() => setMensajeExito(''), 5000);
  }

  function handleEliminacionConfirmada() {
    setNormativaParaEliminar(null);
    setTriggerRefresh(n => n + 1);
    setMensajeExito('LA NORMATIVA FUE DADA DE BAJA CORRECTAMENTE.');
    setTimeout(() => setMensajeExito(''), 6000);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <Link href="/repositorio-normativas" className="text-xs text-[#0f4c81] hover:underline font-medium flex items-center gap-1 whitespace-nowrap">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Repositorio de Normativas
            </Link>
            <span className="text-slate-300 text-xs">/</span>
            <span className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-none">{categoriaNombre}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">{categoriaNombre}</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium tracking-wide">REPOSITORIO DE NORMATIVAS</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {puedeGestionar && (
            <Link
              href={`/repositorio-normativas/nueva?tipoId=${categoriaId}&nombre=${encodeURIComponent(categoriaNombre)}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0f4c81] hover:bg-[#0d3f6d] text-white text-sm font-bold tracking-wide transition-all shadow-sm whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              CARGAR NORMATIVA
            </Link>
          )}
          <Link
            href="/repositorio-normativas"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </Link>
        </div>
      </div>

      {/* ── Banner éxito ─────────────────────────────────────────────────────── */}
      {mensajeExito && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">
          <svg className="w-4 h-4 flex-shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {mensajeExito}
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      {estadoRegistro === 'ELIMINADAS' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">TOTAL ELIMINADAS</p>
            {cargandoKpi
              ? <div className="mt-1.5 h-7 w-10 bg-slate-200 rounded animate-pulse" />
              : <p className="mt-1 text-2xl font-bold text-slate-600 tabular-nums">{totalEliminadas}</p>
            }
          </div>
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-start gap-2.5">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-red-700 font-medium leading-relaxed">
              Vista administrativa de bajas lógicas. Los registros no están disponibles operativamente.
            </p>
          </div>
        </div>
      ) : (
        <div className={`grid gap-3 ${estadoRegistro === 'TODAS' ? 'grid-cols-2 sm:grid-cols-5' : (esDocente ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}`}>
          {[
            { label: 'VIGENTES',    valor: kpi.vigentes,    color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', mostrar: true      },
            { label: 'DEROGADAS',   valor: kpi.derogadas,   color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-100',     mostrar: !esDocente },
            { label: 'SUSPENDIDAS', valor: kpi.suspendidas, color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-100',   mostrar: !esDocente },
            { label: 'TOTAL',       valor: kpi.total,       color: 'text-[#0f4c81]',   bg: 'bg-blue-50',    border: 'border-blue-100',    mostrar: true      },
          ].filter(k => k.mostrar).map(({ label, valor, color, bg, border }) => (
            <div key={label} className={`rounded-xl ${bg} border ${border} px-4 py-3`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
              {cargandoKpi
                ? <div className="mt-1.5 h-7 w-10 bg-slate-200 rounded animate-pulse" />
                : <p className={`mt-1 text-2xl font-bold ${color} tabular-nums`}>{valor}</p>
              }
            </div>
          ))}
          {estadoRegistro === 'TODAS' && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">ELIMINADAS</p>
              {cargandoKpi
                ? <div className="mt-1.5 h-7 w-10 bg-slate-200 rounded animate-pulse" />
                : <p className="mt-1 text-2xl font-bold text-slate-600 tabular-nums">{totalEliminadas}</p>
              }
            </div>
          )}
        </div>
      )}

      {/* ── Filtros ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <IcFilter />
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600">FILTROS</h3>
          {hayFiltrosActivos && (
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#0f4c81]/10 text-[#0f4c81]">
              Filtros activos
            </span>
          )}
        </div>
        <div className="p-5">

          {/* ESTADO DEL REGISTRO — solo para roles de gestión */}
          {puedeGestionar && (
            <div className="mb-4 pb-3 border-b border-slate-100">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Estado del registro</p>
              <div className="flex flex-wrap items-center gap-2">
                {(['ACTIVAS', 'ELIMINADAS', 'TODAS'] as EstadoRegistro[]).map(opcion => (
                  <button
                    key={opcion}
                    type="button"
                    onClick={() => handleEstadoRegistroChange(opcion)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all ${
                      estadoRegistro === opcion
                        ? opcion === 'ELIMINADAS'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-[#0f4c81] text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opcion === 'ELIMINADAS' ? 'ELIMINADAS (BAJAS LÓGICAS)' : opcion}
                  </button>
                ))}
              </div>
              {estadoRegistro === 'ELIMINADAS' && (
                <p className="mt-1.5 text-[10px] text-red-600 font-medium">
                  Mostrando exclusivamente registros dados de baja. No disponibles para usuarios operativos.
                </p>
              )}
              {estadoRegistro === 'TODAS' && (
                <p className="mt-1.5 text-[10px] text-slate-400 font-medium">
                  Mostrando normativas activas y dadas de baja.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Búsqueda general */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Buscar</label>
              <input
                type="text"
                value={form.busqueda}
                onChange={e => setForm(prev => ({ ...prev, busqueda: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleBuscar()}
                placeholder="Busque por título, palabras clave o área emisora..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-[#0f4c81] focus:outline-none focus:ring-1 focus:ring-[#0f4c81]/20 transition-colors"
              />
            </div>

            {/* Área emisora */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Área emisora</label>
              <select
                value={form.areaEmisora}
                onChange={e => setForm(prev => ({ ...prev, areaEmisora: e.target.value }))}
                disabled={cargandoAreas}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#0f4c81] focus:outline-none focus:ring-1 focus:ring-[#0f4c81]/20 transition-colors disabled:opacity-60"
              >
                <option value="">{cargandoAreas ? 'Cargando...' : 'TODAS LAS ÁREAS'}</option>
                {areasEmisoras.map(a => (
                  <option key={a.id} value={a.nombre}>{a.nombre}</option>
                ))}
              </select>
            </div>

            {/* Vigencia — oculto para DOCENTE y en modo ELIMINADAS */}
            {!esDocente && estadoRegistro !== 'ELIMINADAS' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Vigencia</label>
                <select
                  value={form.vigencia}
                  onChange={e => setForm(prev => ({ ...prev, vigencia: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#0f4c81] focus:outline-none focus:ring-1 focus:ring-[#0f4c81]/20 transition-colors"
                >
                  <option value="">Todas</option>
                  <option value="VIGENTE">VIGENTE</option>
                  <option value="DEROGADA">DEROGADA</option>
                  <option value="SUSPENDIDA">SUSPENDIDA</option>
                  <option value="REEMPLAZADA">REEMPLAZADA</option>
                </select>
              </div>
            )}

            {/* Fecha desde */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Fecha desde</label>
              <input
                type="date"
                value={form.fechaDesde}
                onChange={e => setForm(prev => ({ ...prev, fechaDesde: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#0f4c81] focus:outline-none focus:ring-1 focus:ring-[#0f4c81]/20 transition-colors"
              />
            </div>

            {/* Fecha hasta */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Fecha hasta</label>
              <input
                type="date"
                value={form.fechaHasta}
                onChange={e => setForm(prev => ({ ...prev, fechaHasta: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#0f4c81] focus:outline-none focus:ring-1 focus:ring-[#0f4c81]/20 transition-colors"
              />
            </div>
          </div>

          {/* Error de validación de fechas */}
          {errorFiltros && (
            <p className="mt-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorFiltros}
            </p>
          )}

          {/* Botones */}
          <div className="mt-4 flex items-center gap-2 justify-end">
            <button
              onClick={handleLimpiar}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              LIMPIAR
            </button>
            <button
              onClick={handleBuscar}
              className="px-5 py-2 rounded-lg bg-[#0f4c81] text-white text-sm font-semibold hover:bg-[#0d3f6e] transition-colors shadow-sm"
            >
              BUSCAR
            </button>
          </div>
        </div>
      </div>

      {/* ── Banner error exportación ───────────────────────────────────────────── */}
      {exportError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {exportError}
        </div>
      )}

      {/* ── Grilla de normativas ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              {estadoRegistro === 'ELIMINADAS' ? 'NORMATIVAS DADAS DE BAJA'
                : estadoRegistro === 'TODAS'   ? 'NORMATIVAS (ACTIVAS Y DADAS DE BAJA)'
                : 'NORMATIVAS'}
            </h2>
            {!cargando && !error && (
              <p className="text-xs text-slate-400 mt-0.5">
                {totalRegistros === 0
                  ? 'Sin resultados'
                  : `${totalRegistros} ${totalRegistros === 1 ? 'normativa encontrada' : 'normativas encontradas'}`}
              </p>
            )}
          </div>
          {/* Botones de exportación */}
          {!cargando && !error && totalRegistros > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleExportar('pdf')}
                disabled={exportando !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Exportar resultados completos en PDF"
              >
                <IcPdf />
                {exportando === 'pdf' ? 'GENERANDO...' : 'EXPORTAR PDF'}
              </button>
              <button
                onClick={() => handleExportar('excel')}
                disabled={exportando !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 hover:border-emerald-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Exportar resultados completos en Excel"
              >
                <IcExcel />
                {exportando === 'excel' ? 'GENERANDO...' : 'EXPORTAR EXCEL'}
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 py-4">
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          </div>
        )}

        {/* Skeleton */}
        {cargando && !error && (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex gap-4 animate-pulse">
                <div className="flex-1 h-3 bg-slate-100 rounded" />
                <div className="w-28 h-3 bg-slate-100 rounded" />
                <div className="w-20 h-3 bg-slate-100 rounded" />
                <div className="w-24 h-3 bg-slate-100 rounded" />
                <div className="w-16 h-3 bg-slate-100 rounded" />
                <div className="w-10 h-3 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Vacío */}
        {!cargando && !error && normativas.length === 0 && (
          <div className="text-center py-14 px-6">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {hayFiltrosActivos
                ? 'NO SE ENCONTRARON RESULTADOS PARA LOS FILTROS APLICADOS.'
                : estadoRegistro === 'ELIMINADAS'
                  ? 'NO SE ENCONTRARON NORMATIVAS DADAS DE BAJA EN ESTA CATEGORÍA.'
                  : 'NO SE ENCONTRARON NORMATIVAS REGISTRADAS PARA ESTA CATEGORÍA.'}
            </p>
            {hayFiltrosActivos && (
              <button onClick={handleLimpiar} className="mt-3 text-xs text-[#0f4c81] hover:underline font-medium">
                Limpiar filtros y ver todas
              </button>
            )}
          </div>
        )}

        {/* Tabla */}
        {!cargando && !error && normativas.length > 0 && (
          <div className="overflow-x-auto">
            {estadoRegistro === 'ELIMINADAS' ? (
              /* ── Tabla para registros dados de baja ────────────────────── */
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-red-50/60 border-b border-red-100">
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Título</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Tipo</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Área emisora</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">N.° / Año</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Vigencia</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Fecha de baja</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Dado de baja por</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {normativas.map(n => (
                    <tr key={n.id} className="hover:bg-red-50/30 transition-colors bg-slate-50/20">
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-slate-500 leading-snug line-clamp-2">{n.titulo}</span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap text-xs">{n.tipoNormativa?.nombre}</td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{n.areaEmisora}</td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap tabular-nums">
                        {n.numeroNorma} / {n.anio}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full opacity-70 ${vigenciaBadge(n.vigencia)}`}>
                          {n.vigencia}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {n.fechaEliminacion ? formatFecha(n.fechaEliminacion) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs">
                        {n.eliminadoPorNombre ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Link
                          href={`/repositorio-normativas/${categoriaId}/${n.id}?nombre=${encodeURIComponent(categoriaNombre)}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
                          title="Ver detalle de la baja"
                        >
                          <IcEye />
                          VER
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              /* ── Tabla normal (ACTIVAS / TODAS) ─────────────────────────── */
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Título</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Área emisora</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">N.° / Año</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Fecha emisión</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Vigencia</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {normativas.map(n => {
                    const esEliminada = n.eliminado === true;
                    return (
                      <tr key={n.id} className={`hover:bg-slate-50/60 transition-colors group ${esEliminada ? 'opacity-60 bg-slate-50/40' : ''}`}>
                        <td className="px-5 py-3.5">
                          <span className="font-medium text-slate-800 leading-snug line-clamp-2">{n.titulo}</span>
                          {esEliminada && (
                            <span className="ml-2 inline-flex items-center text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">BAJA</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{n.areaEmisora}</td>
                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap tabular-nums">
                          {n.numeroNorma} / {n.anio}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{formatFecha(n.fechaEmision)}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${vigenciaBadge(n.vigencia)}`}>
                            {n.vigencia}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="inline-flex items-center gap-2">
                            <Link
                              href={`/repositorio-normativas/${categoriaId}/${n.id}?nombre=${encodeURIComponent(categoriaNombre)}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0f4c81]/20 bg-[#0f4c81]/5 text-[#0f4c81] text-xs font-semibold hover:bg-[#0f4c81] hover:text-white hover:border-[#0f4c81] transition-all"
                              title="Ver detalle"
                            >
                              <IcEye />
                              VER
                            </Link>
                            {puedeGestionar && !esEliminada && (
                              <>
                                <Link
                                  href={`/repositorio-normativas/editar/${n.id}?tipoNombre=${encodeURIComponent(categoriaNombre)}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-100 hover:border-slate-300 transition-all"
                                  title="Editar normativa"
                                >
                                  <IcEdit />
                                  EDITAR
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => setNormativaParaCambiarEstado(n)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-100 hover:border-slate-300 transition-all"
                                  title="Cambiar estado"
                                >
                                  <IcState />
                                  ESTADO
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNormativaParaEliminar(n)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 text-xs font-semibold hover:bg-red-50 hover:border-red-300 transition-all"
                                  title="Dar de baja"
                                >
                                  <IcTrash />
                                  ELIMINAR
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Paginación */}
        {!cargando && !error && totalRegistros > 0 && (
          <div className="px-5 py-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {totalRegistros === 0 ? 'Sin resultados' : (
                <>
                  Mostrando{' '}
                  <span className="font-semibold text-slate-700">
                    {((pagina - 1) * limite) + 1}–{Math.min(pagina * limite, totalRegistros)}
                  </span>
                  {' '}de{' '}
                  <span className="font-semibold text-slate-700">{totalRegistros}</span>
                  {' '}normativas
                </>
              )}
            </p>
            {totalPaginas > 1 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={pagina === 1}
                  onClick={() => setPagina(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  Página <span className="font-semibold text-slate-700">{pagina}</span> de{' '}
                  <span className="font-semibold text-slate-700">{totalPaginas}</span>
                </span>
                <button
                  disabled={pagina === totalPaginas}
                  onClick={() => setPagina(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal cambio de estado ────────────────────────────────────────────── */}
      {normativaParaCambiarEstado && (
        <CambiarEstadoModal
          normativa={normativaParaCambiarEstado}
          onConfirmado={handleEstadoConfirmado}
          onCancelar={() => setNormativaParaCambiarEstado(null)}
        />
      )}

      {/* ── Modal eliminación lógica ──────────────────────────────────────────── */}
      {normativaParaEliminar && (
        <EliminarNormativaModal
          normativa={{
            ...normativaParaEliminar,
            tipoNormativa: normativaParaEliminar.tipoNormativa,
          }}
          onConfirmado={handleEliminacionConfirmada}
          onCancelar={() => setNormativaParaEliminar(null)}
        />
      )}
    </div>
  );
}
