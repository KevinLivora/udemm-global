'use client';

import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const ROLES_GESTION = ['SECRETARIA_ACADEMICA', 'DECANO', 'RECTORADO', 'ADMINISTRADOR_SISTEMA'];

interface CategoriaConConteo {
  id: string;
  nombre: string;
  cantidad: number;
}

interface AuditLog {
  id: string;
  fecha: string;
  usuarioId: string | null;
  usuarioNombre: string | null;
  accion: string;
  normativaId: string | null;
  normativaTitulo: string | null;
  normativaNumero: string | null;
  normativaAnio: number | null;
  detalle: Record<string, any> | null;
  ipOrigen: string | null;
}

const ACCIONES_AUDIT = [
  { value: '', label: 'Todas las acciones' },
  { value: 'CARGA',              label: 'CARGA' },
  { value: 'EDICION',            label: 'EDICIÓN' },
  { value: 'CAMBIO_ESTADO',      label: 'CAMBIO DE ESTADO' },
  { value: 'ELIMINACION_LOGICA', label: 'ELIMINACIÓN LÓGICA' },
  { value: 'VER_DOCUMENTO',      label: 'VER DOCUMENTO' },
  { value: 'DESCARGA_PDF',       label: 'DESCARGA PDF' },
  { value: 'EXPORTACION',        label: 'EXPORTACIÓN' },
  { value: 'ACCESO_DENEGADO',    label: 'ACCESO DENEGADO' },
];

function accionColor(accion: string): string {
  switch (accion) {
    case 'CARGA':              return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'EDICION':            return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'CAMBIO_ESTADO':      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'ELIMINACION_LOGICA': return 'bg-red-100 text-red-800 border-red-200';
    case 'VER_DOCUMENTO':      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'DESCARGA_PDF':       return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'EXPORTACION':        return 'bg-teal-100 text-teal-800 border-teal-200';
    case 'ACCESO_DENEGADO':    return 'bg-rose-100 text-rose-800 border-rose-200';
    default:                   return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function accionLabel(accion: string): string {
  return ACCIONES_AUDIT.find(a => a.value === accion)?.label ?? accion;
}

function fmtFechaHora(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso);
  return {
    fecha: d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora:  d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

// ── Iconos ───────────────────────────────────────────────────────────────────

const IcEstatuto = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1M4.22 4.22l.707.707m12.02 12.02.707.707M1 12h2m18 0h2M4.22 19.78l.707-.707M18.95 5.05l.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
  </svg>
);

const IcNormativaInst = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
  </svg>
);

const IcConvenio = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899l4-4a4 4 0 115.656 5.656l-1.1 1.1" />
  </svg>
);

const IcAdmision = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const IcBeca = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
  </svg>
);

const IcCarrera = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const IcDocDefault = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IcUpload = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const IcAudit = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const IcSearch = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

type Seccion = 'consultar' | 'auditoria';

const PALETA = [
  { gradient: 'from-[#0f4c81] to-[#1a5ea8]', light: 'bg-blue-50',   text: 'text-[#0f4c81]',   border: 'border-blue-100'   },
  { gradient: 'from-violet-600 to-purple-700', light: 'bg-violet-50', text: 'text-violet-700',   border: 'border-violet-100' },
  { gradient: 'from-teal-500 to-emerald-600',  light: 'bg-teal-50',   text: 'text-teal-700',     border: 'border-teal-100'   },
  { gradient: 'from-amber-500 to-orange-600',  light: 'bg-amber-50',  text: 'text-amber-700',    border: 'border-amber-100'  },
  { gradient: 'from-indigo-500 to-indigo-700', light: 'bg-indigo-50', text: 'text-indigo-700',   border: 'border-indigo-100' },
  { gradient: 'from-slate-500 to-slate-700',   light: 'bg-slate-100', text: 'text-slate-700',    border: 'border-slate-200'  },
];

const DESCRIPCIONES: Record<string, string> = {
  'ESTATUTO Y ORGANIGRAMA':    'Estatuto universitario, organigrama institucional y normativa fundacional.',
  'NORMATIVA INSTITUCIONAL':   'Resoluciones, ordenanzas y disposiciones de carácter general.',
  'CONVENIOS':                 'Acuerdos y convenios con instituciones nacionales e internacionales.',
  'REQUISITOS DE ADMISIÓN':    'Condiciones y requisitos para el ingreso a las distintas carreras.',
  'BECAS':                     'Programas de becas, ayudas económicas y beneficios estudiantiles.',
  'NORMATIVAS DE CARRERA':     'Reglamentos y normativas específicas de cada carrera académica.',
};

function getIcono(nombre: string): React.ReactNode {
  const n = nombre.toUpperCase();
  if (n.includes('ESTATUTO') || n.includes('ORGANIGRAMA')) return <IcEstatuto />;
  if (n.includes('CONVENIO'))                               return <IcConvenio />;
  if (n.includes('ADMIS'))                                  return <IcAdmision />;
  if (n.includes('BECA'))                                   return <IcBeca />;
  if (n.includes('CARRERA'))                                return <IcCarrera />;
  if (n.includes('INSTITUCIONAL') || n.includes('NORMATIVA')) return <IcNormativaInst />;
  return <IcDocDefault />;
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function RepositorioNormativasPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [categorias, setCategorias] = useState<CategoriaConConteo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seccion, setSeccion] = useState<Seccion>('consultar');

  // Auditoría
  const [auditForm, setAuditForm]           = useState({ busqueda: '', accion: '', fechaDesde: '', fechaHasta: '' });
  const [auditFiltros, setAuditFiltros]     = useState({ busqueda: '', accion: '', fechaDesde: '', fechaHasta: '' });
  const [auditData, setAuditData]           = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal]         = useState(0);
  const [auditPagina, setAuditPagina]       = useState(1);
  const [auditTotalPags, setAuditTotalPags] = useState(0);
  const [auditCargando, setAuditCargando]   = useState(false);
  const [auditError, setAuditError]         = useState('');
  const [auditDetalle, setAuditDetalle]     = useState<AuditLog | null>(null);

  const rol = usuario?.rol?.nombre ?? '';
  const puedeGestionar = ROLES_GESTION.includes(rol);

  useEffect(() => {
    apiFetch(`${API}/normativas/conteo-por-tipo`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setCategorias(Array.isArray(d) ? d : []))
      .catch(() => setError('No se pudieron cargar las categorías.'))
      .finally(() => setCargando(false));
  }, []);

  const cargarAuditoria = useCallback(() => {
    if (!puedeGestionar) return;
    setAuditCargando(true);
    setAuditError('');
    const params = new URLSearchParams();
    if (auditFiltros.accion)     params.set('accion',     auditFiltros.accion);
    if (auditFiltros.busqueda)   params.set('busqueda',   auditFiltros.busqueda);
    if (auditFiltros.fechaDesde) params.set('fechaDesde', auditFiltros.fechaDesde);
    if (auditFiltros.fechaHasta) params.set('fechaHasta', auditFiltros.fechaHasta);
    params.set('page',  String(auditPagina));
    params.set('limit', '10');
    apiFetch(`${API}/normativas/auditoria?${params}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => {
        setAuditData(d.data ?? []);
        setAuditTotal(d.total ?? 0);
        setAuditTotalPags(d.totalPaginas ?? 0);
      })
      .catch(() => setAuditError('No se pudo cargar el log de auditoría.'))
      .finally(() => setAuditCargando(false));
  }, [puedeGestionar, auditFiltros, auditPagina]);

  useEffect(() => {
    if (seccion === 'auditoria') cargarAuditoria();
  }, [seccion, cargarAuditoria]);

  function buscarAuditoria() {
    setAuditPagina(1);
    setAuditFiltros({ ...auditForm });
  }

  function limpiarAuditoria() {
    const vacío = { busqueda: '', accion: '', fechaDesde: '', fechaHasta: '' };
    setAuditForm(vacío);
    setAuditFiltros(vacío);
    setAuditPagina(1);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
            REPOSITORIO DE NORMATIVAS
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-medium tracking-wide">
            BIBLIOTECA DIGITAL DE NORMATIVAS INSTITUCIONALES
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0f4c81] to-[#1a5ea8] flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Navegación de secciones ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-1 p-1.5">
          <button
            onClick={() => setSeccion('consultar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              seccion === 'consultar'
                ? 'bg-[#0f4c81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <IcSearch />
            CONSULTAR NORMATIVAS
          </button>

          {puedeGestionar && (
            <button
              onClick={() => router.push('/repositorio-normativas/nueva')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all text-slate-600 hover:bg-slate-50 hover:text-slate-800"
            >
              <IcUpload />
              CARGAR NORMATIVA
            </button>
          )}

          {puedeGestionar && (
            <button
              onClick={() => setSeccion('auditoria')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                seccion === 'auditoria'
                  ? 'bg-[#0f4c81] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <IcAudit />
              LOG DE AUDITORÍA
            </button>
          )}
        </div>
      </div>

      {/* ── Contenido por sección ────────────────────────────────────────────── */}

      {seccion === 'consultar' && (
        <>
          {/* Sub-encabezado */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Seleccioná una categoría para consultar las normativas disponibles.
            </p>
            {!cargando && !error && (
              <span className="text-xs text-slate-400 font-medium">
                {categorias.length} {categorias.length === 1 ? 'categoría' : 'categorías'}
              </span>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Skeleton */}
          {cargando && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-white border border-slate-200 shadow-sm p-5 animate-pulse">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-200 flex-shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3 bg-slate-200 rounded w-3/4" />
                      <div className="h-2.5 bg-slate-100 rounded w-full" />
                    </div>
                  </div>
                  <div className="h-px bg-slate-100 mb-3" />
                  <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                </div>
              ))}
            </div>
          )}

          {/* Grilla de categorías */}
          {!cargando && !error && categorias.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600">No hay categorías configuradas.</p>
              <p className="text-xs text-slate-400 mt-1">Configure los tipos de normativa en Tablas Maestras.</p>
            </div>
          )}

          {!cargando && !error && categorias.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categorias.map((cat, idx) => {
                const color = PALETA[idx % PALETA.length];
                const desc = DESCRIPCIONES[cat.nombre] ?? 'Normativas de esta categoría.';
                return (
                  <Link
                    key={cat.id}
                    href={`/repositorio-normativas/${cat.id}?nombre=${encodeURIComponent(cat.nombre)}`}
                    className="group relative rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-[#0f4c81]/20 transition-all duration-200 overflow-hidden flex flex-col"
                  >
                    {/* Barra de acento superior */}
                    <div className={`h-[3px] bg-gradient-to-r ${color.gradient}`} />

                    <div className="p-5 flex flex-col gap-3 flex-1">
                      {/* Icono + nombre */}
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color.gradient} flex items-center justify-center text-white flex-shrink-0 shadow-sm`}>
                          {getIcono(cat.nombre)}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <h3 className={`text-sm font-bold ${color.text} group-hover:text-[#0f4c81] transition-colors leading-snug`}>
                            {cat.nombre}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                            {desc}
                          </p>
                        </div>
                      </div>

                      {/* Separador */}
                      <div className="border-t border-slate-100" />

                      {/* Contador + CTA */}
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${color.light} ${color.text} ${color.border} border`}>
                          <span className="text-sm font-bold">{cat.cantidad}</span>
                          {cat.cantidad === 1 ? 'NORMATIVA' : 'NORMATIVAS'}
                        </span>
                        <span className={`text-xs font-semibold ${color.text} flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                          Ver
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {seccion === 'auditoria' && (
        <div className="space-y-4">

          {/* Filtros */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">FILTROS DE BÚSQUEDA</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Buscar por usuario o normativa..."
                value={auditForm.busqueda}
                onChange={e => setAuditForm(p => ({ ...p, busqueda: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && buscarAuditoria()}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/30 focus:border-[#0f4c81]"
              />
              <select
                value={auditForm.accion}
                onChange={e => setAuditForm(p => ({ ...p, accion: e.target.value }))}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/30 focus:border-[#0f4c81] bg-white"
              >
                {ACCIONES_AUDIT.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Desde</label>
                <input
                  type="date"
                  value={auditForm.fechaDesde}
                  onChange={e => setAuditForm(p => ({ ...p, fechaDesde: e.target.value }))}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/30 focus:border-[#0f4c81]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Hasta</label>
                <input
                  type="date"
                  value={auditForm.fechaHasta}
                  onChange={e => setAuditForm(p => ({ ...p, fechaHasta: e.target.value }))}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/30 focus:border-[#0f4c81]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={buscarAuditoria}
                disabled={auditCargando}
                className="px-4 py-2 bg-[#0f4c81] hover:bg-[#0d3d6b] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                BUSCAR
              </button>
              <button
                onClick={limpiarAuditoria}
                disabled={auditCargando}
                className="px-4 py-2 border border-slate-200 bg-white text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                LIMPIAR
              </button>
              {!auditCargando && (
                <span className="text-xs text-slate-400 ml-2">
                  {auditTotal} {auditTotal === 1 ? 'registro' : 'registros'}
                </span>
              )}
            </div>
          </div>

          {/* Error */}
          {auditError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {auditError}
            </div>
          )}

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {auditCargando ? (
              <div className="p-8 text-center">
                <div className="inline-block w-6 h-6 border-2 border-[#0f4c81] border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-sm text-slate-500">Cargando registros...</p>
              </div>
            ) : auditData.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <IcAudit />
                </div>
                <p className="text-sm font-medium text-slate-600">No se encontraron registros de auditoría.</p>
                <p className="text-xs text-slate-400 mt-1">Probá ajustando los filtros de búsqueda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Fecha / Hora</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Usuario</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Acción</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Normativa</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 hidden lg:table-cell">IP Origen</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">Ver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditData.map(log => {
                      const { fecha, hora } = fmtFechaHora(log.fecha);
                      return (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-xs font-semibold text-slate-700 tabular-nums">{fecha}</p>
                            <p className="text-[11px] text-slate-400 tabular-nums">{hora}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium text-slate-700 truncate max-w-[160px]">
                              {log.usuarioNombre ?? <span className="text-slate-400 italic">Sistema</span>}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${accionColor(log.accion)}`}>
                              {accionLabel(log.accion)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {log.normativaTitulo ? (
                              <>
                                <p className="text-xs text-slate-700 truncate max-w-[200px]" title={log.normativaTitulo}>
                                  {log.normativaTitulo}
                                </p>
                                {log.normativaNumero && (
                                  <p className="text-[11px] text-slate-400 tabular-nums">
                                    N° {log.normativaNumero} / {log.normativaAnio}
                                  </p>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-[11px] text-slate-400 font-mono">
                              {log.ipOrigen ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => setAuditDetalle(log)}
                              className="text-[#0f4c81] hover:text-[#0d3d6b] text-xs font-semibold underline underline-offset-2 transition-colors"
                            >
                              VER
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Paginación */}
          {auditTotalPags > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Página {auditPagina} de {auditTotalPags} — {auditTotal} registros
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setAuditPagina(p => Math.max(1, p - 1))}
                  disabled={auditPagina <= 1 || auditCargando}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  ← Anterior
                </button>
                {Array.from({ length: Math.min(5, auditTotalPags) }, (_, i) => {
                  const half = 2;
                  let start = Math.max(1, auditPagina - half);
                  const end = Math.min(auditTotalPags, start + 4);
                  start = Math.max(1, end - 4);
                  const p = start + i;
                  if (p > auditTotalPags) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setAuditPagina(p)}
                      disabled={auditCargando}
                      className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                        p === auditPagina
                          ? 'bg-[#0f4c81] text-white'
                          : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setAuditPagina(p => Math.min(auditTotalPags, p + 1))}
                  disabled={auditPagina >= auditTotalPags || auditCargando}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de detalle de auditoría */}
      {auditDetalle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={e => { if (e.target === e.currentTarget) setAuditDetalle(null); }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded border ${accionColor(auditDetalle.accion)}`}>
                  {accionLabel(auditDetalle.accion)}
                </span>
                <div>
                  {(() => { const { fecha, hora } = fmtFechaHora(auditDetalle.fecha); return (
                    <p className="text-xs text-slate-500 tabular-nums">{fecha} — {hora}</p>
                  ); })()}
                </div>
              </div>
              <button
                onClick={() => setAuditDetalle(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

              {/* Info general */}
              <div className="rounded-xl bg-slate-50 border border-slate-100 divide-y divide-slate-100">
                {auditDetalle.usuarioNombre && (
                  <div className="px-4 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Usuario</p>
                    <p className="text-sm font-semibold text-slate-700">{auditDetalle.usuarioNombre}</p>
                  </div>
                )}
                {auditDetalle.normativaTitulo && (
                  <div className="px-4 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Normativa</p>
                    <p className="text-sm font-semibold text-slate-700">{auditDetalle.normativaTitulo}</p>
                    {auditDetalle.normativaNumero && (
                      <p className="text-xs text-slate-400 tabular-nums mt-0.5">
                        N° {auditDetalle.normativaNumero} / {auditDetalle.normativaAnio}
                      </p>
                    )}
                  </div>
                )}
                {auditDetalle.ipOrigen && (
                  <div className="px-4 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">IP Origen</p>
                    <p className="text-xs font-mono text-slate-600">{auditDetalle.ipOrigen}</p>
                  </div>
                )}
              </div>

              {/* Detalle específico por acción */}
              {auditDetalle.detalle && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Detalle del evento</p>

                  {/* EDICION: tabla de cambios */}
                  {auditDetalle.accion === 'EDICION' && Array.isArray(auditDetalle.detalle.cambios) ? (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                            <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-slate-400 text-[10px]">Campo</th>
                            <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-slate-400 text-[10px]">Anterior</th>
                            <th className="px-3 py-2 text-left font-bold uppercase tracking-widest text-slate-400 text-[10px]">Nuevo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {auditDetalle.detalle.cambios.map((c: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">{c.campo}</td>
                              <td className="px-3 py-2 text-slate-500 break-words max-w-[120px]">{c.anterior ?? '—'}</td>
                              <td className="px-3 py-2 text-slate-800 font-medium break-words max-w-[120px]">{c.nuevo ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : auditDetalle.accion === 'EXPORTACION' ? (
                    /* EXPORTACION: formato + filtros estructurados */
                    <div className="space-y-3">
                      <div className="rounded-xl bg-slate-50 border border-slate-100 divide-y divide-slate-100">
                        <div className="px-4 py-2.5 flex items-start justify-between gap-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex-shrink-0 mt-0.5">FORMATO</p>
                          <p className="text-xs font-medium text-slate-700">{auditDetalle.detalle.formato ?? '—'}</p>
                        </div>
                        {auditDetalle.detalle.tipoNombre && (
                          <div className="px-4 py-2.5 flex items-start justify-between gap-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex-shrink-0 mt-0.5">CATEGORÍA</p>
                            <p className="text-xs font-medium text-slate-700">{auditDetalle.detalle.tipoNombre}</p>
                          </div>
                        )}
                        <div className="px-4 py-2.5 flex items-start justify-between gap-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex-shrink-0 mt-0.5">TOTAL REGISTROS</p>
                          <p className="text-xs font-semibold text-slate-700 tabular-nums">{auditDetalle.detalle.totalRegistros ?? 0}</p>
                        </div>
                      </div>
                      {auditDetalle.detalle.filtros && Object.values(auditDetalle.detalle.filtros).some((v: any) => v && v !== 'ACTIVAS') && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Filtros aplicados</p>
                          <div className="rounded-xl bg-slate-50 border border-slate-100 divide-y divide-slate-100">
                            {Object.entries(auditDetalle.detalle.filtros as Record<string, string>)
                              .filter(([, v]) => v && v !== 'ACTIVAS')
                              .map(([k, v]) => (
                                <div key={k} className="px-4 py-2 flex items-start justify-between gap-4">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex-shrink-0 mt-0.5">
                                    {k.replace(/([A-Z])/g, ' $1').toUpperCase().trim()}
                                  </p>
                                  <p className="text-xs font-medium text-slate-700 text-right">{v}</p>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Otros: lista clave-valor */
                    <div className="rounded-xl bg-slate-50 border border-slate-100 divide-y divide-slate-100">
                      {Object.entries(auditDetalle.detalle)
                        .filter(([, v]) => v !== null && v !== undefined && v !== false && !Array.isArray(v) && typeof v !== 'object')
                        .map(([k, v]) => (
                          <div key={k} className="px-4 py-2.5 flex items-start justify-between gap-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex-shrink-0 mt-0.5">
                              {k.replace(/([A-Z])/g, ' $1').toUpperCase().trim()}
                            </p>
                            <p className="text-xs font-medium text-slate-700 text-right">{String(v)}</p>
                          </div>
                        ))
                      }
                      {auditDetalle.detalle.pdfMovidoACuarentena === true && (
                        <div className="px-4 py-2.5 flex items-start justify-between gap-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex-shrink-0 mt-0.5">PDF MOVIDO A CUARENTENA</p>
                          <p className="text-xs font-medium text-emerald-700 text-right">SÍ</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setAuditDetalle(null)}
                className="px-5 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
