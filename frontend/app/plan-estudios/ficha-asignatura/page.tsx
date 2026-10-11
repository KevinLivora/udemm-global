'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch as apiFetchBase, mensajeErrorHttp } from '@/lib/api';
import { getPermisosPlanEstudio, getPermisosPrograma, PermisosPrograma } from '@/lib/permisos-plan-estudios';
import { normalizarMayusculas } from '@/lib/normalizarMayusculas';
import { ModalHistorialPrograma } from '@/app/bandeja-aprobaciones/_components/ModalHistorialPrograma';

// ── Constantes ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const NAV_INTERNA = [
  { label: 'Carreras',                         href: '/plan-estudios/carreras' },
  { label: 'Programas de Asignatura',          href: '/plan-estudios/programas-asignatura' },
  { label: 'Información de Planes de Estudio', href: '/plan-estudios/informacion-planes' },
];

const TABS_FICHA = [
  { id: 'general',  label: 'Datos Generales' },
  { id: 'programa', label: 'Programa de Asignatura' },
] as const;

type TabId = typeof TABS_FICHA[number]['id'];

const TIPOS_ASIGNATURA = ['OBLIGATORIA', 'ELECTIVA', 'OPTATIVA'];
const REGIMENES = ['Cuatrimestral', 'Anual', 'Intensivo', 'Bimestral'];

const MODALIDADES_DICTADO = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'VIRTUAL',    label: 'Virtual' },
  { value: 'HÍBRIDA',    label: 'Híbrida' },
];

function labelModalidad(val?: string | null) {
  return MODALIDADES_DICTADO.find(m => m.value === val)?.label ?? '—';
}

function colorModalidadBadge(val?: string | null) {
  if (val === 'VIRTUAL') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (val === 'HÍBRIDA') return 'bg-teal-50 text-teal-700 border-teal-200';
  if (val === 'PRESENCIAL') return 'bg-green-50 text-green-700 border-green-200';
  return '';
}

const BLOQUES_CONOCIMIENTO = [
  { codigo: 'CB', label: 'CB - Ciencias Básicas' },
  { codigo: 'TB', label: 'TB - Tecnologías Básicas' },
  { codigo: 'TA', label: 'TA - Tecnologías Aplicadas' },
  { codigo: 'CX', label: 'CX - Cs. y Tecn. Complementarias' },
  { codigo: 'EL', label: 'EL - Electivas' },
];

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface MateriaResumen {
  id: string;
  codigo: string;
  nombre: string;
  anio?: number;
  cuatrimestre?: number;
  bloqueConocimiento?: string;
  estado: string;
}

interface CorrelativaItem {
  id: string;
  tipo: string;
  correlativa: MateriaResumen;
}

interface EsCorrelativaDeItem {
  id: string;
  tipo: string;
  materia: MateriaResumen;
}

interface HistorialProgramaItem {
  id: string;
  accion: string;
  seccion?: string;
  descripcion?: string;
  fecha: string;
  usuario: { id: string; nombre: string; apellido: string; correoElectronico: string };
}

interface ProgramaAsignatura {
  id: string;
  materiaId: string;
  equipoDocente?: string;
  elaboradoPor?: string;
  anioVigencia?: number;
  objetivosGenerales?: string;
  aportesPerfilTitulo?: string;
  recomendacionesCursado?: string;
  competenciasResultadosJson?: string;
  contenidosGridJson?: string;
  unidadesDidacticasJson?: string;
  formacionPracticaJson?: string;
  actividadesFormacionPractica?: string;
  fundamentacion?: string;
  propositos?: string;
  objetivosEspecificos?: string;
  contenidosSinteticos?: string;
  contenidosTematicos?: string;
  bibliografiaBasica?: string;
  bibliografiaComplementaria?: string;
  recursosDidacticos?: string;
  metodologiaEnsenanza?: string;
  tiposFormacionPractica?: string;
  porcentajeTiempoFormacion?: string;
  actividadesPracticas?: string;
  cronograma?: string;
  modalidadEvaluacion?: string;
  requisitosAprobacion?: string;
  criteriosEvaluacion?: string;
  instrumentosEvaluacion?: string;
  condicionesAprobacion?: string;
  fechaVigenciaPrograma?: number;
  anioAprobacionRevision?: string;
  profesorACargo?: string;
  competenciasVinculadas?: string;
  fechaUltimaActualizacion?: string;
  observacionesGestion?: string;
  estadoPrograma: string;
  estadoFuncional?: string; // devuelto por el backend — INCOMPLETO|COMPLETO|EN_CORRECCION|EN_REVISION|APROBADO
  solicitudActual?: { id: string; estado: string; observaciones?: string | null; aprobador?: { nombre: string; apellido: string } | null } | null;
  fechaAprobacion?: string;
  resolucionAprobacion?: string;
  observacionesGenerales?: string;
  vigenciaDesde?: number;
  vigenciaHasta?: number;
  estadoS1: string; estadoS2: string; estadoS3: string;
  estadoS4: string; estadoS5: string; estadoS6: string;
  historial: HistorialProgramaItem[];
  fechaCreacion: string;
  fechaActualizacion: string;
}

interface HistorialItem {
  id: string;
  accion: string;
  descripcion?: string;
  fecha: string;
  usuario: { id: string; nombre: string; apellido: string; correoElectronico: string };
}

interface HistorialUnificado {
  id: string;
  accion: string;
  seccion?: string;
  descripcion?: string;
  fecha: string;
  fuente: 'materia' | 'programa';
  usuario: { id: string; nombre: string; apellido: string; correoElectronico: string };
}

interface FichaCompleta {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  creditos: number;
  cargaHorariaSemanal?: number;
  cargaHorariaTotal?: number;
  anio?: number;
  cuatrimestre?: number;
  bloqueConocimiento?: string;
  modalidadDictado?: string;
  tipoAsignatura: string;
  regimenCursado?: string;
  estado: string;
  observaciones?: string;
  planEstudioId: string;
  planEstudio: {
    id: string;
    nombre: string;
    version?: string;
    anio?: number;
    carrera: {
      id: string;
      nombre: string;
      facultad: { nombre: string };
    };
  };
  correlativas: CorrelativaItem[];
  esCorrelativaDe: EsCorrelativaDeItem[];
  fechaCreacion: string;
  fechaActualizacion: string;
}

interface Carrera { id: string; nombre: string; _count?: { planes: number } }
interface Plan { id: string; nombre: string; anio?: number; version?: string; estado: string }

type FormEditar = {
  nombre: string; descripcion: string; bloqueConocimiento: string;
  modalidadDictado: string; tipoAsignatura: string; regimenCursado: string;
  anio: string; cuatrimestre: string; observaciones: string; estado: string;
  cargaHorariaSemanal: string; cargaHorariaTotal: string; creditos: string;
};

// ── Iconos ────────────────────────────────────────────────────────────────────

const IcClose = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IcEdit = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const IcPlus = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const IcBack = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);
const IcSpinner = () => (
  <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-[#0f4c81] animate-spin" />
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function formatFechaCorta(iso: string) {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function colorTipo(tipo: string) {
  if (tipo === 'ELECTIVA') return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (tipo === 'OPTATIVA') return 'bg-purple-50 text-purple-700 border border-purple-200';
  return 'bg-slate-100 text-slate-600 border border-slate-200';
}

function colorEstado(estado: string) {
  if (estado === 'ACTIVO') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  return 'bg-red-50 text-red-700 border border-red-200';
}

// ── Componente raíz (con Suspense) ────────────────────────────────────────────

export default function FichaAsignaturaPage() {
  return (
    <Suspense fallback={
      <div className="max-w-6xl flex items-center justify-center py-20">
        <IcSpinner />
      </div>
    }>
      <FichaContent />
    </Suspense>
  );
}

// ── Contenido principal ───────────────────────────────────────────────────────

function FichaContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const materiaId = searchParams.get('id');
  const tabParam  = searchParams.get('tab') as TabId | null;
  const modoVer   = searchParams.get('modo') === 'ver';
  const initialTab: TabId = (TABS_FICHA.map(t => t.id) as string[]).includes(tabParam ?? '')
    ? (tabParam as TabId)
    : 'general';

  const { usuario } = useAuth();
  const permisos = getPermisosPlanEstudio(usuario?.rol?.nombre ?? '');
  const permisosPrograma = getPermisosPrograma(usuario?.rol?.nombre ?? '');
  const [puedeEditarPrograma, setPuedeEditarPrograma] = useState(false);

  useEffect(() => {
    if (!materiaId || usuario?.rol?.nombre !== 'DOCENTE') {
      setPuedeEditarPrograma(false);
      return;
    }
    apiFetch(`${API_URL}/vinculaciones-catedra?estado=APROBADA`)
      .then((data: unknown) => {
        const arr = Array.isArray(data) ? (data as { materia?: { id: string } }[]) : [];
        setPuedeEditarPrograma(arr.some(v => v.materia?.id === materiaId));
      })
      .catch(() => setPuedeEditarPrograma(false));
  }, [materiaId, usuario?.rol?.nombre]);

  // ── API helper ─────────────────────────────────────────────────────────
  async function apiFetch(url: string, opts?: RequestInit) {
    const res = await apiFetchBase(url, opts);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error en la solicitud'));
    return data;
  }

  return (
    <div className="max-w-6xl">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <a href="/plan-estudios" className="hover:text-slate-600 transition-colors">Plan de Estudios</a>
        <span>/</span>
        {materiaId
          ? <><a href="/plan-estudios/ficha-asignatura" className="hover:text-slate-600 transition-colors">Ficha de Asignatura</a><span>/</span><span className="text-slate-600 font-medium">Detalle</span></>
          : <span className="text-slate-600 font-medium">Ficha de Asignatura</span>
        }
      </nav>

      {/* Encabezado */}
      {!materiaId && (
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Plan de Estudios</p>
          <h1 className="text-xl font-bold text-slate-800">Ficha de Asignatura</h1>
          <p className="mt-1 text-sm text-slate-500">
            Seleccioná una asignatura para ver su ficha completa.
          </p>
        </div>
      )}

      {/* Navegación interna */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {NAV_INTERNA.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
              pathname === item.href
                ? 'border-[#0f4c81] text-[#0f4c81]'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Vista de ficha o selector */}
      {materiaId
        ? <FichaView materiaId={materiaId} permisos={permisos} permisosPrograma={permisosPrograma} puedeEditarPrograma={puedeEditarPrograma} apiFetch={apiFetch} usuario={usuario} router={router} initialTab={initialTab} modoVer={modoVer} />
        : <SelectorView apiFetch={apiFetch} usuario={usuario} router={router} />
      }
    </div>
  );
}

// ── Vista: Selector (sin materiaId) ──────────────────────────────────────────

function SelectorView({ apiFetch, usuario, router }: {
  apiFetch: (url: string, opts?: RequestInit) => Promise<any>;
  usuario: unknown;
  router: ReturnType<typeof useRouter>;
}) {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [materias, setMaterias] = useState<MateriaResumen[]>([]);
  const [carreraId, setCarreraId] = useState('');
  const [planId, setPlanId] = useState('');
  const [buscar, setBuscar] = useState('');
  const [cargando, setCargando] = useState(false);
  const [aniosColapsados, setAniosColapsados] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!usuario) return;
    apiFetch(`${API_URL}/plan-estudios/carreras`).then(setCarreras).catch(() => {});
  }, [usuario]);

  useEffect(() => {
    if (!carreraId) { setPlanes([]); setPlanId(''); return; }
    apiFetch(`${API_URL}/plan-estudios?carreraId=${carreraId}`).then(setPlanes).catch(() => {});
  }, [carreraId]);

  useEffect(() => {
    if (!planId) { setMaterias([]); return; }
    setCargando(true);
    apiFetch(`${API_URL}/materias?planEstudioId=${planId}`)
      .then(setMaterias).catch(() => {}).finally(() => setCargando(false));
    setAniosColapsados(new Set());
  }, [planId]);

  function toggleAnioSel(anio: string) {
    setAniosColapsados(prev => {
      const next = new Set(prev);
      if (next.has(anio)) next.delete(anio); else next.add(anio);
      return next;
    });
  }

  const filtradas = useMemo(() => {
    const t = buscar.toLowerCase().trim();
    if (!t) return materias;
    return materias.filter(m =>
      m.nombre.toLowerCase().includes(t) || m.codigo.toLowerCase().includes(t)
    );
  }, [materias, buscar]);

  const materiasAgrupadasPorAnio = useMemo(() => {
    const grouped: Record<string, MateriaResumen[]> = {};
    for (const m of filtradas) {
      const key = m.anio?.toString() ?? '0';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    }
    return grouped;
  }, [filtradas]);

  const aniosDelSelector = Object.keys(materiasAgrupadasPorAnio).sort((a, b) => {
    if (a === '0') return 1;
    if (b === '0') return -1;
    return parseInt(a) - parseInt(b);
  });

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Carrera</label>
            <select
              value={carreraId}
              onChange={e => setCarreraId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
            >
              <option value="">-- Seleccionar carrera --</option>
              {carreras.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Plan de Estudio</label>
            <select
              value={planId}
              onChange={e => setPlanId(e.target.value)}
              disabled={!carreraId}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <option value="">-- Seleccionar plan --</option>
              {planes.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.anio ? ` (${p.anio})` : ''}{p.version ? ` v${p.version}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Listado de asignaturas */}
      {planId && (
        <>
          {cargando ? (
            <div className="flex items-center gap-3 p-6"><IcSpinner /><span className="text-sm text-slate-500">Cargando asignaturas...</span></div>
          ) : materias.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              Este plan no tiene asignaturas registradas.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <input
                  value={buscar}
                  onChange={e => setBuscar(e.target.value)}
                  placeholder="Buscar asignatura..."
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
                />
                <span className="text-xs text-slate-400">{filtradas.length} asignatura{filtradas.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="space-y-2">
                {aniosDelSelector.map(anio => {
                  const isExpanded = !aniosColapsados.has(anio);
                  const mats = materiasAgrupadasPorAnio[anio];
                  return (
                    <div key={anio} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        onClick={() => toggleAnioSel(anio)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70 transition-colors text-left"
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#0f4c81] flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">{anio === '0' ? '?' : anio}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-700">
                          {anio === '0' ? 'Sin año asignado' : `${anio}° Año`}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {mats.length} asignatura{mats.length !== 1 ? 's' : ''}
                        </span>
                        <div className="flex-1" />
                        <svg
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? '' : 'rotate-180'}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-100 overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                                <th className="text-left px-4 py-2 font-semibold text-slate-500 uppercase tracking-wide w-28">Código</th>
                                <th className="text-left px-4 py-2 font-semibold text-slate-500 uppercase tracking-wide">Asignatura</th>
                                <th className="text-left px-4 py-2 font-semibold text-slate-500 uppercase tracking-wide w-24">Duración</th>
                                <th className="text-left px-4 py-2 font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Bloque</th>
                                <th className="px-4 py-2 w-20"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {mats.map(m => (
                                <tr
                                  key={m.id}
                                  onClick={() => router.push(`/plan-estudios/ficha-asignatura?id=${m.id}`)}
                                  className="hover:bg-[#0f4c81]/3 cursor-pointer transition-colors group"
                                >
                                  <td className="px-4 py-2.5">
                                    <span className="text-[11px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/10 whitespace-nowrap">
                                      {m.codigo}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <p className="text-xs font-semibold text-slate-800 group-hover:text-[#0f4c81] transition-colors leading-tight">
                                      {m.nombre}
                                    </p>
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                                    {m.cuatrimestre === 0
                                      ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">Anual</span>
                                      : m.cuatrimestre ? `${m.cuatrimestre}°` : '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">
                                    {m.bloqueConocimiento ?? '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    <span className="text-[11px] text-[#0f4c81] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                      Ver ficha →
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {!planId && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-[#1a5ea8]/8 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-[#1a5ea8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>

          {carreras.length === 0 ? (
            <>
              <p className="text-sm font-medium text-slate-700 mb-1">No hay datos cargados en Plan de Estudios</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                La base de datos no tiene carreras ni planes aún. Para comenzar, ejecutá el seed de datos desde la carpeta <span className="font-mono">backend/</span>:
              </p>
              <code className="inline-block bg-slate-100 text-slate-700 text-xs px-4 py-2 rounded-lg font-mono">
                npx prisma db seed
              </code>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600 mb-1">Seleccioná una asignatura</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Elegí una carrera y un plan para ver el listado de asignaturas, o accedé directamente desde la{' '}
                <Link href="/plan-estudios/malla-curricular" className="text-[#0f4c81] underline underline-offset-2">Malla Curricular</Link>.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vista: Ficha completa ─────────────────────────────────────────────────────

function FichaView({ materiaId, permisos, permisosPrograma, puedeEditarPrograma = false, apiFetch, usuario, router, initialTab, modoVer = false }: {
  materiaId: string;
  permisos: ReturnType<typeof getPermisosPlanEstudio>;
  permisosPrograma: PermisosPrograma;
  puedeEditarPrograma?: boolean;
  apiFetch: (url: string, opts?: RequestInit) => Promise<any>;
  usuario: unknown;
  router: ReturnType<typeof useRouter>;
  initialTab: TabId;
  modoVer?: boolean;
}) {
  const [ficha, setFicha] = useState<FichaCompleta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>(initialTab);
  const [modoEditar, setModoEditar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Edit form
  const [form, setForm] = useState<FormEditar>({
    nombre: '', descripcion: '', bloqueConocimiento: '', modalidadDictado: '',
    tipoAsignatura: 'OBLIGATORIA', regimenCursado: '', anio: '', cuatrimestre: '',
    observaciones: '', estado: 'ACTIVO', cargaHorariaSemanal: '', cargaHorariaTotal: '', creditos: ''
  });

  // Correlativas management
  const [materiasDelPlan, setMateriasDelPlan] = useState<MateriaResumen[]>([]);
  const [corrAgregar, setCorrAgregar] = useState({ correlativaId: '', tipo: 'CURSADO' });
  const [agregandoCorr, setAgregandoCorr] = useState(false);
  const [mostrarFormCorr, setMostrarFormCorr] = useState(false);
  const [corrEditando, setCorrEditando] = useState<{ correlativaId: string; tipo: string } | null>(null);
  const [guardandoCorr, setGuardandoCorr] = useState(false);

  useEffect(() => {
    if (!usuario || !materiaId) return;
    fetchFicha();
  }, [usuario, materiaId]);

  async function fetchFicha() {
    setCargando(true);
    setError(null);
    try {
      const data = await apiFetch(`${API_URL}/materias/${materiaId}/ficha`);
      setFicha(data);
      setForm({
        nombre: data.nombre ?? '',
        descripcion: data.descripcion ?? '',
        bloqueConocimiento: data.bloqueConocimiento ?? '',
        modalidadDictado: data.modalidadDictado ?? '',
        tipoAsignatura: data.tipoAsignatura ?? 'OBLIGATORIA',
        regimenCursado: data.regimenCursado ?? '',
        anio: data.anio?.toString() ?? '',
        cuatrimestre: data.cuatrimestre?.toString() ?? '',
        observaciones: data.observaciones ?? '',
        estado: data.estado ?? 'ACTIVO',
        cargaHorariaSemanal: data.cargaHorariaSemanal?.toString() ?? '',
        cargaHorariaTotal: data.cargaHorariaTotal?.toString() ?? '',
        creditos: data.creditos?.toString() ?? ''
      });
      // Load plan materias for correlativas picker
      const mats = await apiFetch(`${API_URL}/materias?planEstudioId=${data.planEstudioId}`);
      setMateriasDelPlan(mats ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function guardarCambios() {
    setGuardando(true);
    try {
      const payload: Record<string, unknown> = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion || undefined,
        bloqueConocimiento: form.bloqueConocimiento || undefined,
        modalidadDictado: form.modalidadDictado || undefined,
        tipoAsignatura: form.tipoAsignatura,
        regimenCursado: form.regimenCursado || undefined,
        observaciones: form.observaciones || undefined,
        estado: form.estado
      };
      if (form.anio) payload.anio = parseInt(form.anio);
      if (form.cuatrimestre !== '') payload.cuatrimestre = parseInt(form.cuatrimestre);
      if (form.cargaHorariaSemanal) payload.cargaHorariaSemanal = parseInt(form.cargaHorariaSemanal);
      if (form.cargaHorariaTotal) payload.cargaHorariaTotal = parseInt(form.cargaHorariaTotal);
      if (form.creditos) payload.creditos = parseInt(form.creditos);

      await apiFetch(`${API_URL}/materias/${materiaId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setModoEditar(false);
      await fetchFicha();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function agregarCorrelativa() {
    if (!corrAgregar.correlativaId) return;
    setAgregandoCorr(true);
    try {
      await apiFetch(`${API_URL}/materias/${materiaId}/correlativas`, {
        method: 'POST',
        body: JSON.stringify({ correlativaId: corrAgregar.correlativaId, tipo: corrAgregar.tipo })
      });
      setCorrAgregar({ correlativaId: '', tipo: 'CURSADO' });
      setMostrarFormCorr(false);
      await fetchFicha();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAgregandoCorr(false);
    }
  }

  async function modificarCorrelativa() {
    if (!corrEditando) return;
    setGuardandoCorr(true);
    try {
      await apiFetch(`${API_URL}/materias/${materiaId}/correlativas/${corrEditando.correlativaId}`, {
        method: 'PATCH',
        body: JSON.stringify({ tipo: corrEditando.tipo })
      });
      setCorrEditando(null);
      await fetchFicha();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardandoCorr(false);
    }
  }

  async function quitarCorrelativa(correlativaId: string, nombre: string) {
    if (!window.confirm(`¿Eliminar la correlativa "${nombre}"? Se elimina solo la relación, no la asignatura.`)) return;
    try {
      await apiFetch(`${API_URL}/materias/${materiaId}/correlativas/${correlativaId}`, { method: 'DELETE' });
      await fetchFicha();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  function cancelarEdicion() {
    if (!ficha) return;
    setForm({
      nombre: ficha.nombre ?? '',
      descripcion: ficha.descripcion ?? '',
      bloqueConocimiento: ficha.bloqueConocimiento ?? '',
      modalidadDictado: ficha.modalidadDictado ?? '',
      tipoAsignatura: ficha.tipoAsignatura ?? 'OBLIGATORIA',
      regimenCursado: ficha.regimenCursado ?? '',
      anio: ficha.anio?.toString() ?? '',
      cuatrimestre: ficha.cuatrimestre?.toString() ?? '',
      observaciones: ficha.observaciones ?? '',
      estado: ficha.estado ?? 'ACTIVO',
      cargaHorariaSemanal: ficha.cargaHorariaSemanal?.toString() ?? '',
      cargaHorariaTotal: ficha.cargaHorariaTotal?.toString() ?? '',
      creditos: ficha.creditos?.toString() ?? ''
    });
    setModoEditar(false);
    setMostrarFormCorr(false);
    setCorrAgregar({ correlativaId: '', tipo: 'CURSADO' });
    setCorrEditando(null);
  }

  // ── Datos derivados ─────────────────────────────────────────────────────

  const materiasPicker = useMemo(
    () => materiasDelPlan.filter(m =>
      m.id !== materiaId &&
      !ficha?.correlativas.some(c => c.correlativa.id === m.id)
    ),
    [materiasDelPlan, materiaId, ficha]
  );

  // ── Estados de carga ────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-3 py-16">
        <IcSpinner />
        <span className="text-sm text-slate-500">Cargando ficha...</span>
      </div>
    );
  }

  if (error || !ficha) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-sm font-medium text-red-600 mb-2">{error ?? 'Asignatura no encontrada'}</p>
        <button
          onClick={() => router.push('/plan-estudios/ficha-asignatura')}
          className="text-xs text-[#0f4c81] underline"
        >
          Volver al selector
        </button>
      </div>
    );
  }

  return (
    <div>

      {/* Volver */}
      <button
        onClick={() => router.push(modoVer ? '/plan-estudios/programas-asignatura' : '/plan-estudios/ficha-asignatura')}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-4 transition-colors"
      >
        <IcBack />
        {modoVer ? 'Volver a Programas de Asignatura' : 'Volver al selector'}
      </button>

      {/* Header de la ficha */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-bold font-mono bg-[#0f4c81]/10 text-[#0f4c81] px-2.5 py-1 rounded border border-[#0f4c81]/10">
                {ficha.codigo}
              </span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${colorTipo(ficha.tipoAsignatura)}`}>
                {ficha.tipoAsignatura}
              </span>
              {ficha.modalidadDictado && (
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${colorModalidadBadge(ficha.modalidadDictado)}`}>
                  {labelModalidad(ficha.modalidadDictado)}
                </span>
              )}
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${colorEstado(ficha.estado)}`}>
                {ficha.estado}
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight mb-1">{ficha.nombre}</h1>
            <p className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
              <span><strong className="text-slate-600">Plan:</strong> {ficha.planEstudio.nombre}{ficha.planEstudio.version ? ` v${ficha.planEstudio.version}` : ''}</span>
              <span><strong className="text-slate-600">Carrera:</strong> {ficha.planEstudio.carrera.nombre}</span>
              {ficha.anio && <span><strong className="text-slate-600">Año:</strong> {ficha.anio}°</span>}
              {ficha.cuatrimestre != null && (
                <span>
                  <strong className="text-slate-600">Duración:</strong>{' '}
                  {ficha.cuatrimestre === 0 ? 'Anual' : `${ficha.cuatrimestre}° Cuatrimestre`}
                </span>
              )}
            </p>
          </div>

        </div>
      </div>

      {/* Tabs de secciones */}
      <div className="flex items-center gap-0.5 mb-4 border-b border-slate-200">
        {TABS_FICHA.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-[#0f4c81] text-[#0f4c81]'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
        {modoVer && (
          <span className="ml-auto mr-1 text-[10px] font-semibold px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap">
            Solo lectura
          </span>
        )}
      </div>

      {/* Contenido de sección */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

        {/* ── TAB: Datos Generales ─────────────────────────────────────── */}
        {tab === 'general' && (
          <div>

            {/* Barra de acciones */}
            {permisos.editar && !modoVer && (
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/40">
                {!modoEditar ? (
                  <button
                    onClick={() => setModoEditar(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#0f4c81] text-[#0f4c81] rounded-lg hover:bg-[#0f4c81]/5 transition-colors"
                  >
                    <IcEdit />
                    Editar
                  </button>
                ) : (
                  <>
                    <button
                      onClick={cancelarEdicion}
                      className="px-3 py-1.5 text-xs font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={guardarCambios}
                      disabled={guardando}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0f4c81] text-white rounded-lg hover:bg-[#0d3e6b] transition-colors disabled:opacity-60"
                    >
                      {guardando ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* IDENTIFICACIÓN */}
            <SeccionHeader label="Identificación" />
            <div className="divide-y divide-slate-50">
              <CampoFicha label="Código" valor={ficha.codigo} monospace />
              <CampoEditable label="Nombre" valor={ficha.nombre} editar={modoEditar}
                input={<input data-no-uppercase="true" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: normalizarMayusculas(e.target.value) }))}
                  className={inputCls} />} />
              <CampoFicha label="Carrera" valor={ficha.planEstudio.carrera.nombre} />
              <CampoFicha label="Plan de Estudio"
                valor={`${ficha.planEstudio.nombre}${ficha.planEstudio.version ? ` (v${ficha.planEstudio.version})` : ''}`} />
              <CampoEditable label="Bloque de Conocimiento" valor={ficha.bloqueConocimiento ?? '—'} editar={modoEditar}
                input={
                  <select value={form.bloqueConocimiento} onChange={e => setForm(f => ({ ...f, bloqueConocimiento: e.target.value }))} className={inputCls}>
                    <option value="">-- Sin asignar --</option>
                    {BLOQUES_CONOCIMIENTO.map(b => <option key={b.codigo} value={b.label}>{b.label}</option>)}
                  </select>
                } />
              <div className="flex">
                <div className="flex-1 border-r border-slate-50">
                  <CampoEditable label="Año" valor={ficha.anio ? `${ficha.anio}°` : '—'} editar={modoEditar}
                    input={<select value={form.anio} onChange={e => setForm(f => ({ ...f, anio: e.target.value }))} className={inputCls}>
                      <option value="">—</option>
                      {[1,2,3,4,5].map(a => <option key={a} value={a}>{a}°</option>)}
                    </select>} />
                </div>
                <div className="flex-1">
                  <CampoEditable label="Cuatrimestre"
                    valor={ficha.cuatrimestre === 0 ? 'Anual' : ficha.cuatrimestre ? `${ficha.cuatrimestre}° Cuatrimestre` : '—'}
                    editar={modoEditar}
                    input={<select value={form.cuatrimestre} onChange={e => setForm(f => ({ ...f, cuatrimestre: e.target.value }))} className={inputCls}>
                      <option value="">—</option>
                      <option value="1">1° Cuatrimestre</option>
                      <option value="2">2° Cuatrimestre</option>
                      <option value="0">Anual</option>
                    </select>} />
                </div>
              </div>
              <CampoEditable label="Régimen de Cursado" valor={ficha.regimenCursado ?? '—'} editar={modoEditar}
                input={<select value={form.regimenCursado} onChange={e => setForm(f => ({ ...f, regimenCursado: e.target.value }))} className={inputCls}>
                  <option value="">—</option>
                  {REGIMENES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>} />
              <CampoEditable label="Observaciones" valor={ficha.observaciones ?? '—'} editar={modoEditar}
                input={<textarea data-no-uppercase="true" value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: normalizarMayusculas(e.target.value) }))}
                  rows={2} className={`${inputCls} resize-none`} placeholder="Notas adicionales..." />} />
            </div>

            {/* CARGA HORARIA */}
            <SeccionHeader label="Carga Horaria" />
            <div className="divide-y divide-slate-50">
              <CampoEditable label="Horas semanales"
                valor={ficha.cargaHorariaSemanal ? `${ficha.cargaHorariaSemanal} horas` : '—'}
                editar={modoEditar}
                input={<input type="text" inputMode="numeric" value={form.cargaHorariaSemanal}
                  onChange={e => setForm(f => ({ ...f, cargaHorariaSemanal: soloDigitos(e.target.value) }))}
                  className={inputCls} placeholder="0" />} />
              <CampoEditable label="Horas totales"
                valor={ficha.cargaHorariaTotal ? `${ficha.cargaHorariaTotal} horas` : '—'}
                editar={modoEditar}
                input={<input type="text" inputMode="numeric" value={form.cargaHorariaTotal}
                  onChange={e => setForm(f => ({ ...f, cargaHorariaTotal: soloDigitos(e.target.value) }))}
                  className={inputCls} placeholder="0" />} />
              <CampoEditable label="Créditos"
                valor={ficha.creditos > 0 ? `${ficha.creditos} créditos` : '—'}
                editar={modoEditar}
                input={<input type="number" min="0" value={form.creditos}
                  onChange={e => setForm(f => ({ ...f, creditos: e.target.value }))}
                  className={inputCls} placeholder="0" />} />
            </div>

            {/* CORRELATIVIDADES */}
            <SeccionHeader label="Correlatividades" subtitle="Requisito para cursar" />
            <div className="px-5 py-4 space-y-3">
              {ficha.correlativas.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-1">Sin correlativas definidas</p>
              ) : (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                        <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide text-[10px] w-24">Código</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Nombre</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide text-[10px] w-28">Tipo</th>
                        {permisos.editar && !modoVer && <th className="w-24 px-3 py-2" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ficha.correlativas.map(c => {
                        const editandoEstaFila = corrEditando?.correlativaId === c.correlativa.id;
                        return (
                          <tr key={c.id} className={`transition-colors ${editandoEstaFila ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'}`}>
                            <td className="px-3 py-2.5">
                              <span className="text-[10px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/15">
                                {c.correlativa.codigo}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-slate-700">{c.correlativa.nombre}</td>
                            <td className="px-3 py-2.5">
                              {editandoEstaFila ? (
                                <select
                                  value={corrEditando.tipo}
                                  onChange={e => setCorrEditando(v => v ? { ...v, tipo: e.target.value } : v)}
                                  className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#0f4c81]/30"
                                >
                                  <option value="CURSADO">Para cursar</option>
                                  <option value="EXAMEN">Para rendir</option>
                                </select>
                              ) : (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                                  c.tipo === 'EXAMEN'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                  {c.tipo === 'EXAMEN' ? 'Para rendir' : 'Para cursar'}
                                </span>
                              )}
                            </td>
                            {permisos.editar && !modoVer && (
                              <td className="px-3 py-2.5">
                                <div className="flex items-center justify-end gap-1">
                                  {editandoEstaFila ? (
                                    <>
                                      <button
                                        onClick={modificarCorrelativa}
                                        disabled={guardandoCorr}
                                        className="text-[10px] font-semibold px-2 py-1 bg-[#0f4c81] text-white rounded hover:bg-[#0d3e6b] disabled:opacity-50 transition-colors"
                                      >
                                        {guardandoCorr ? '...' : 'Guardar'}
                                      </button>
                                      <button
                                        onClick={() => setCorrEditando(null)}
                                        className="text-[10px] px-2 py-1 border border-slate-200 text-slate-600 rounded hover:bg-slate-50 transition-colors"
                                      >
                                        Cancelar
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => { setCorrEditando({ correlativaId: c.correlativa.id, tipo: c.tipo }); setMostrarFormCorr(false); }}
                                        className="text-slate-400 hover:text-[#0f4c81] transition-colors p-0.5 rounded"
                                        title="Modificar tipo de correlativa"
                                      >
                                        <IcEdit />
                                      </button>
                                      <button
                                        onClick={() => quitarCorrelativa(c.correlativa.id, c.correlativa.nombre)}
                                        className="text-slate-300 hover:text-red-500 transition-colors p-0.5 rounded"
                                        title="Eliminar correlativa"
                                      >
                                        <IcClose />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {permisos.editar && modoEditar && (
                !mostrarFormCorr ? (
                  <button
                    onClick={() => { setMostrarFormCorr(true); setCorrEditando(null); }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/5 px-3 py-2 rounded-lg transition-colors"
                  >
                    <IcPlus />
                    Agregar correlativa
                  </button>
                ) : (
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-700">Nueva correlativa</p>
                    <select
                      value={corrAgregar.correlativaId}
                      onChange={e => setCorrAgregar(c => ({ ...c, correlativaId: e.target.value }))}
                      className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
                    >
                      <option value="">-- Seleccionar asignatura --</option>
                      {materiasPicker.map(m => (
                        <option key={m.id} value={m.id}>
                          [{m.codigo}] {m.nombre}{m.anio ? ` · ${m.anio}°A` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-600 font-medium">Tipo:</span>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="radio" name="tipoCorr" value="CURSADO" checked={corrAgregar.tipo === 'CURSADO'} onChange={() => setCorrAgregar(c => ({ ...c, tipo: 'CURSADO' }))} className="accent-[#0f4c81]" />
                        Para cursar
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="radio" name="tipoCorr" value="EXAMEN" checked={corrAgregar.tipo === 'EXAMEN'} onChange={() => setCorrAgregar(c => ({ ...c, tipo: 'EXAMEN' }))} className="accent-[#0f4c81]" />
                        Para rendir
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={agregarCorrelativa}
                        disabled={!corrAgregar.correlativaId || agregandoCorr}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#0f4c81] text-white rounded-lg hover:bg-[#0d3e6b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {agregandoCorr ? 'Agregando...' : 'Agregar'}
                      </button>
                      <button
                        onClick={() => { setMostrarFormCorr(false); setCorrAgregar({ correlativaId: '', tipo: 'CURSADO' }); }}
                        className="px-3 py-1.5 text-xs font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>

          </div>
        )}

        {/* ── TAB: Programa ────────────────────────────────────────────── */}
        {tab === 'programa' && (
          <ProgramaView
            materiaId={ficha.id}
            ficha={ficha}
            permisosPrograma={permisosPrograma}
            puedeEditarPrograma={puedeEditarPrograma}
            apiFetch={apiFetch}
            onRefreshFicha={fetchFicha}
            modoVer={modoVer}
          />
        )}

      </div>
    </div>
  );
}

// ── Estilos compartidos ───────────────────────────────────────────────────────

const inputCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]';

// ── Sub-componentes ───────────────────────────────────────────────────────────

function SeccionHeader({ label, subtitle }: { label: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50/80 border-y border-slate-100">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
      {subtitle && <span className="text-[10px] text-slate-400">· {subtitle}</span>}
    </div>
  );
}

function CampoFicha({ label, valor, monospace }: { label: string; valor: string; monospace?: boolean }) {
  return (
    <div className="flex items-start px-5 py-3.5 gap-4">
      <span className="w-44 text-xs font-medium text-slate-500 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-slate-800 ${monospace ? 'font-mono' : ''}`}>{valor || '—'}</span>
    </div>
  );
}

function CampoEditable({ label, valor, editar, input }: {
  label: React.ReactNode;
  valor: string;
  editar: boolean;
  input: React.ReactNode;
}) {
  return (
    <div className="flex items-start px-5 py-3 gap-4">
      <span className="w-44 text-xs font-medium text-slate-500 flex-shrink-0 pt-2">{label}</span>
      {editar ? <div className="flex-1 min-w-0">{input}</div> : <span className="text-sm text-slate-800 pt-0.5">{valor || '—'}</span>}
    </div>
  );
}

function CorrelativaRow({ item, tipo, permisos, onQuitar }: {
  item: MateriaResumen;
  tipo: string;
  permisos: ReturnType<typeof getPermisosPlanEstudio>;
  onQuitar: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
      <span className="text-[10px] font-bold font-mono text-[#0f4c81] bg-[#0f4c81]/10 px-1.5 py-0.5 rounded border border-[#0f4c81]/10">
        {item.codigo}
      </span>
      <span className="text-xs text-slate-700 flex-1">{item.nombre}</span>
      {item.anio && (
        <span className="text-[11px] text-slate-400">
          {item.anio}°A{item.cuatrimestre ? ` · ${item.cuatrimestre}°C` : ''}
        </span>
      )}
      {permisos.editar && (
        <button
          onClick={onQuitar}
          className="text-slate-300 hover:text-red-500 transition-colors p-0.5 rounded"
          title="Quitar correlativa"
        >
          <IcClose />
        </button>
      )}
    </div>
  );
}

const ACCION_CONFIG: Record<string, { label: string; cls: string }> = {
  CREACION:              { label: 'Creación',           cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ACTUALIZACION:         { label: 'Actualización',      cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  APROBACION:            { label: 'Aprobación',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  BAJA:                  { label: 'Baja',               cls: 'bg-red-50 text-red-600 border-red-200' },
  CORRELATIVA_AGREGADA:   { label: 'Correlativa +',  cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  CORRELATIVA_MODIFICADA: { label: 'Correlativa ~',  cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  CORRELATIVA_QUITADA:    { label: 'Correlativa −',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
};

function AccionBadge({ accion }: { accion: string }) {
  const cfg = ACCION_CONFIG[accion] ?? { label: accion, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── Programa de Asignatura ────────────────────────────────────────────────────

function duracionLabel(c: number | undefined | null): string {
  if (c === 0) return 'Anual';
  if (c === 1) return '1° Cuatrimestre';
  if (c === 2) return '2° Cuatrimestre';
  return '—';
}

interface CampoConfig {
  key: string;
  label: string;
  tipo: 'text' | 'textarea' | 'number' | 'date' | 'year' | 'select' | 'checkboxgroup';
  placeholder?: string;
  opciones?: string[];
  rows?: number;
  obligatorio?: boolean;
  tieneOtra?: boolean;
  validacion?: 'masDeUnaPalabra';
  digitosExactos?: number;
}

interface SeccionConfig {
  id: string;
  numero: number;
  titulo: string;
  estadoKey: keyof ProgramaAsignatura;
  campos: CampoConfig[];
  renderTipo?: 'grids' | 'unidades' | 'formacion';
}

type CompetenciaFila      = { competencia: string; resultadoAprendizaje: string };
type ContenidoFila        = { conceptuales: string; procedimentales: string; actitudinales: string };
type UnidadDidacticaFila  = { unidad: string; horas: string };
type IntensidadFila       = { intensidad: string; horasClase: number };

function tryParseJson<T>(str: string | undefined | null): T | null {
  if (!str) return null;
  try { return JSON.parse(str) as T; } catch { return null; }
}

// Elimina cualquier carácter que no sea dígito (0-9). Usar en todos los campos de horas.
function soloDigitos(val: string): string {
  return val.replace(/[^0-9]/g, '');
}

function calcEstadoS2(prog: ProgramaAsignatura): string {
  const comps = tryParseJson<CompetenciaFila[]>(prog.competenciasResultadosJson) ?? [];
  const conts = tryParseJson<ContenidoFila[]>(prog.contenidosGridJson) ?? [];
  const hasComp = comps.some(r => r.competencia?.trim().length > 0 && r.resultadoAprendizaje?.trim().length > 0);
  const hasCont = conts.some(r => r.conceptuales?.trim().length > 0 && r.procedimentales?.trim().length > 0 && r.actitudinales?.trim().length > 0);
  return hasComp && hasCont ? 'COMPLETO' : 'PENDIENTE';
}

function calcEstadoS3(prog: ProgramaAsignatura): string {
  const uds = tryParseJson<UnidadDidacticaFila[]>(prog.unidadesDidacticasJson) ?? [];
  return uds.some(r => r.unidad?.trim().length > 0) ? 'COMPLETO' : 'PENDIENTE';
}

function calcEstadoS4(prog: ProgramaAsignatura): string {
  const hasActiv = (prog.actividadesFormacionPractica?.trim().length ?? 0) > 50;
  const filas = tryParseJson<IntensidadFila[]>(prog.formacionPracticaJson) ?? [];
  const hasIntens = filas.some(f =>
    (f.intensidad?.trim().length ?? 0) > 0 &&
    typeof f.horasClase === 'number' && Number.isInteger(f.horasClase) &&
    f.horasClase >= 0 && f.horasClase <= 99
  );
  return hasActiv && hasIntens ? 'COMPLETO' : 'PENDIENTE';
}

const SECCIONES_PROGRAMA: SeccionConfig[] = [
  {
    id: 's1', numero: 1, titulo: 'Objetivos y perfil', estadoKey: 'estadoS1',
    campos: [
      { key: 'objetivosGenerales',    label: 'Objetivos',                                   tipo: 'textarea', rows: 7, obligatorio: true,  placeholder: 'Describa los objetivos generales y específicos de la asignatura. Al finalizar el cursado, el estudiante será capaz de...' },
      { key: 'aportesPerfilTitulo',   label: 'Aportes al perfil del título',                tipo: 'textarea', rows: 7, obligatorio: true,  placeholder: 'Describa cómo contribuye esta asignatura al perfil profesional del egresado de la carrera...' },
      { key: 'recomendacionesCursado',label: 'Recomendaciones para cursar la asignatura',   tipo: 'textarea', rows: 5, obligatorio: false, placeholder: 'Conocimientos previos, habilidades o recomendaciones para cursar la asignatura...' },
    ]
  },
  {
    id: 's2', numero: 2, titulo: 'Competencias y contenidos', estadoKey: 'estadoS2',
    campos: [],
    renderTipo: 'grids',
  },
  {
    id: 's3', numero: 3, titulo: 'Unidades didácticas', estadoKey: 'estadoS3',
    campos: [],
    renderTipo: 'unidades',
  },
  {
    id: 's4', numero: 4, titulo: 'Formación práctica', estadoKey: 'estadoS4',
    campos: [],
    renderTipo: 'formacion',
  },
  {
    id: 's5', numero: 5, titulo: 'Metodología y evaluación', estadoKey: 'estadoS5',
    campos: [
      { key: 'recursosDidacticos',   label: 'Recursos para el dictado de la asignatura', tipo: 'textarea', rows: 5, obligatorio: true,
        placeholder: 'Describa los recursos físicos, tecnológicos, bibliográficos y de laboratorio utilizados durante el dictado de la asignatura...' },
      { key: 'metodologiaEnsenanza', label: 'Metodología de enseñanza', tipo: 'textarea', rows: 5, obligatorio: true,
        placeholder: 'Describa las estrategias didácticas y metodológicas utilizadas para el desarrollo de la asignatura...' },
      { key: 'modalidadEvaluacion',  label: 'Modalidad e instancias de evaluación', tipo: 'textarea', rows: 5, obligatorio: true,
        placeholder: 'Describa las modalidades de evaluación, instrumentos utilizados y las distintas instancias previstas durante el cursado...' },
      { key: 'requisitosAprobacion', label: 'Requisitos para aprobar la materia', tipo: 'textarea', rows: 5, obligatorio: true,
        placeholder: 'Describa las condiciones necesarias para obtener la regularidad, promoción o aprobación de la asignatura...' },
    ]
  },
  {
    id: 's6', numero: 6, titulo: 'Bibliografía y gestión', estadoKey: 'estadoS6',
    campos: [
      { key: 'bibliografiaBasica',         label: 'Bibliografía obligatoria',        tipo: 'textarea', rows: 6, obligatorio: true,  placeholder: 'Autor, A. (año). Título. Editorial.\nAutor, B. (año). Título. Editorial.' },
      { key: 'bibliografiaComplementaria', label: 'Bibliografía de consulta',         tipo: 'textarea', rows: 6, obligatorio: false, placeholder: 'Autor, A. (año). Título. Editorial.\nRecursos en línea: URL' },
      { key: 'fechaVigenciaPrograma',      label: 'Año de vigencia del programa',    tipo: 'year',   obligatorio: true },
      { key: 'fechaAprobacion',            label: 'Fecha de aprobación / revisión',  tipo: 'date',   obligatorio: true },
    ]
  },
];

const ESTADO_PROG_CFG: Record<string, { label: string; cls: string }> = {
  PENDIENTE:   { label: 'Pendiente',   cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  EN_REVISION: { label: 'En revisión', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APROBADO:    { label: 'Aprobado',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const ESTADO_FUNC_CFG: Record<string, { label: string; cls: string }> = {
  INCOMPLETO:    { label: 'Incompleto',    cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  EN_CORRECCION: { label: 'En corrección', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  EN_REVISION:   { label: 'En revisión',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APROBADO:      { label: 'Aprobado',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const ACCION_PROG_CFG: Record<string, { label: string; cls: string }> = {
  ACTUALIZACION: { label: 'Actualización', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  APROBACION:    { label: 'Aprobación',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REVERSION:     { label: 'En revisión',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

function exportarProgramaPDF(ficha: FichaCompleta, programa: ProgramaAsignatura) {
  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── Mini helpers ─────────────────────────────────────────────────────────
  const esc   = (s: unknown) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const nl2br = (s: string)  => esc(s).replace(/\n/g,'<br>');
  const fmtN  = (n: number)  => n % 1 === 0 ? String(n) : n.toFixed(1);
  const SIN   = '<span class="sin-info">Sin información registrada</span>';

  const campoTxt = (label: string, v: string) =>
    `<div class="campo"><div class="lbl">${label}</div><div class="val">${v ? nl2br(v) : SIN}</div></div>`;

  const campoTabla = (label: string, tbl: string) =>
    `<div class="campo"><div class="lbl">${label}</div>${tbl}</div>`;

  const sec = (num: number, titulo: string, contenido: string) =>
    `<div class="seccion"><h2>${num}. ${titulo}</h2>${contenido}</div>`;

  // ── Datos JSON ───────────────────────────────────────────────────────────
  const compFilas = tryParseJson<CompetenciaFila[]>(programa.competenciasResultadosJson) ?? [];
  const contFilas = tryParseJson<ContenidoFila[]>(programa.contenidosGridJson) ?? [];
  const udFilas   = tryParseJson<UnidadDidacticaFila[]>(programa.unidadesDidacticasJson) ?? [];
  const intensFilasPdf = tryParseJson<IntensidadFila[]>(programa.formacionPracticaJson) ?? [];

  // ── S1: Objetivos y perfil (campos genéricos) ─────────────────────────
  const s1Cfg = SECCIONES_PROGRAMA.find(s => s.id === 's1')!;
  const s1HTML = s1Cfg.campos.map(c => {
    const v = String((programa as unknown as Record<string,unknown>)[c.key] ?? '');
    return campoTxt(c.label, v);
  }).join('');

  // ── S2: Competencias y contenidos ─────────────────────────────────────
  const tblComp = compFilas.length === 0 ? SIN :
    `<table><thead><tr><th style="width:50%">Competencia</th><th style="width:50%">Resultado de aprendizaje</th></tr></thead>
    <tbody>${compFilas.map(r =>
      `<tr><td>${nl2br(r.competencia||'—')}</td><td>${nl2br(r.resultadoAprendizaje||'—')}</td></tr>`
    ).join('')}</tbody></table>`;

  const tblCont = contFilas.length === 0 ? SIN :
    `<table><thead><tr><th>Conceptuales</th><th>Procedimentales</th><th>Actitudinales</th></tr></thead>
    <tbody>${contFilas.map(r =>
      `<tr><td>${nl2br(r.conceptuales||'—')}</td><td>${nl2br(r.procedimentales||'—')}</td><td>${nl2br(r.actitudinales||'—')}</td></tr>`
    ).join('')}</tbody></table>`;

  const s2HTML = campoTabla('Competencias / Resultados de aprendizaje', tblComp)
               + campoTabla('Contenidos', tblCont);

  // ── S3: Unidades didácticas ───────────────────────────────────────────
  const tblUD = udFilas.length === 0 ? SIN :
    `<table><thead><tr><th style="width:80%">Unidad didáctica</th><th>Horas</th></tr></thead>
    <tbody>${udFilas.map(r =>
      `<tr><td>${nl2br(r.unidad||'—')}</td><td>${esc(r.horas||'—')}</td></tr>`
    ).join('')}</tbody></table>`;

  const s3HTML = campoTabla('Unidades didácticas', tblUD);

  // ── S4: Formación práctica ────────────────────────────────────────────
  const s4ActHTML = campoTxt(
    'Actividades de formación práctica',
    programa.actividadesFormacionPractica ?? '',
  );
  const tblIntens = intensFilasPdf.length === 0 ? SIN :
    `<table>
      <thead><tr>
        <th style="width:80%">Intensidad de formación práctica</th>
        <th style="width:20%;text-align:center">Horas de clase</th>
      </tr></thead>
      <tbody>
        ${intensFilasPdf.map(f => `<tr>
          <td>${nl2br(f.intensidad||'—')}</td>
          <td style="text-align:center">${esc(f.horasClase != null ? String(f.horasClase) : '—')}</td>
        </tr>`).join('')}
      </tbody></table>`;
  const s4HTML = s4ActHTML + campoTabla('Intensidad de la formación práctica', tblIntens);

  // ── S5: Metodología y evaluación (campos genéricos) ───────────────────
  const s5Cfg = SECCIONES_PROGRAMA.find(s => s.id === 's5')!;
  const s5HTML = s5Cfg.campos.map(c => {
    const v = String((programa as unknown as Record<string,unknown>)[c.key] ?? '');
    return campoTxt(c.label, v);
  }).join('');

  // ── S6: Bibliografía y gestión (campos genéricos) ─────────────────────
  const s6Cfg = SECCIONES_PROGRAMA.find(s => s.id === 's6')!;
  const s6HTML = s6Cfg.campos.map(c => {
    const raw = (programa as unknown as Record<string,unknown>)[c.key];
    const v   = raw != null ? String(raw) : '';
    const display = c.tipo === 'date' && v ? formatFechaCorta(v) : v;
    return campoTxt(c.label, display);
  }).join('');

  // ── HTML final ────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Programa de Asignatura — ${esc(ficha.nombre)}</title>
<style>
@page {
  size: A4; margin: 15mm 20mm 22mm 20mm;
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font-size:8pt; color:#94a3b8; }
  @bottom-left  { content: "UDEMM — Programa de Asignatura"; font-size:8pt; color:#94a3b8; }
}
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:10pt;color:#1e293b;margin:0}
.hdr{background:#0f4c81;color:white;padding:14px 18px 16px}
.hdr-univ{font-size:7.5pt;letter-spacing:.06em;text-transform:uppercase;opacity:.8}
.hdr-fac{font-size:9.5pt;margin:3px 0 2px;opacity:.9}
.hdr-mat{font-size:14pt;font-weight:bold;margin:6px 0 0}
.hdr-bar{height:3px;background:#f26b22}
.meta-grid{display:flex;flex-wrap:wrap;gap:5px 22px;border:1px solid #e2e8f0;border-top:0;padding:9px 18px;background:#f8fafc;margin-bottom:22px}
.mi{font-size:8.5pt;color:#475569}
.mi strong{color:#1e293b}
h2{font-size:11pt;color:#0f4c81;border-bottom:2px solid #0f4c81;padding-bottom:4px;margin:24px 0 10px;break-after:avoid;page-break-after:avoid}
.seccion{break-inside:avoid;page-break-inside:avoid}
.campo{margin-bottom:13px;break-inside:avoid;page-break-inside:avoid}
.lbl{font-size:8pt;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
.val{font-size:10pt;line-height:1.55;color:#1e293b}
.sin-info{color:#94a3b8;font-style:italic}
table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:9pt}
thead{display:table-header-group;background:#0f4c81;color:white}
th{padding:6px 8px;text-align:left;font-size:8pt;font-weight:600}
td{padding:5px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
tr{break-inside:avoid;page-break-inside:avoid}
.tot-row td{background:#f1f5f9;font-weight:bold;border-top:2px solid #cbd5e1}
.footer{margin-top:28px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:8pt;color:#94a3b8;display:flex;justify-content:space-between}
</style>
</head>
<body>
<div class="hdr">
  <div class="hdr-univ">UDEMM — Universidad de la Marina Mercante</div>
  <div class="hdr-fac">${esc(ficha.planEstudio.carrera.facultad.nombre)}</div>
  <div class="hdr-mat">${esc(ficha.nombre)}</div>
</div>
<div class="hdr-bar"></div>
<div class="meta-grid">
  <div class="mi"><strong>Carrera:</strong> ${esc(ficha.planEstudio.carrera.nombre)}</div>
  <div class="mi"><strong>Plan de Estudios:</strong> ${esc(ficha.planEstudio.nombre)}${ficha.planEstudio.version ? ` (v${esc(ficha.planEstudio.version)})` : ''}</div>
  <div class="mi"><strong>Código:</strong> ${esc(ficha.codigo)}</div>
  ${ficha.anio ? `<div class="mi"><strong>Año:</strong> ${ficha.anio}°</div>` : ''}
  ${ficha.cuatrimestre != null ? `<div class="mi"><strong>Cuatrimestre:</strong> ${esc(duracionLabel(ficha.cuatrimestre))}</div>` : ''}
  ${ficha.bloqueConocimiento ? `<div class="mi"><strong>Bloque de conocimiento:</strong> ${esc(ficha.bloqueConocimiento)}</div>` : ''}
  ${(() => {
    const aprobacion = programa.historial.find(h => h.accion === 'APROBACION');
    if (!aprobacion) return '';
    const quien = `${aprobacion.usuario.nombre} ${aprobacion.usuario.apellido}`;
    const cuando = new Date(aprobacion.fecha).toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' });
    return `<div class="mi"><strong>Aprobado por:</strong> ${esc(quien)} el ${esc(cuando)}</div>`;
  })()}
</div>

${sec(1,'Objetivos y perfil', s1HTML)}
${sec(2,'Competencias y contenidos', s2HTML)}
${sec(3,'Unidades didácticas', s3HTML)}
${sec(4,'Formación práctica', s4HTML)}
${sec(5,'Metodología y evaluación', s5HTML)}
${sec(6,'Bibliografía y gestión', s6HTML)}

<div class="footer">
  <span>Generado el ${fecha}</span>
  <span>${esc(ficha.planEstudio.carrera.facultad.nombre)} · UDEMM</span>
</div>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
}

function ProgramaView({
  materiaId, ficha, permisosPrograma, puedeEditarPrograma = false, apiFetch, onRefreshFicha, modoVer = false
}: {
  materiaId: string;
  ficha: FichaCompleta;
  permisosPrograma: PermisosPrograma;
  puedeEditarPrograma?: boolean;
  apiFetch: (url: string, opts?: RequestInit) => Promise<any>;
  onRefreshFicha?: () => void;
  modoVer?: boolean;
}) {
  const [programa, setPrograma] = useState<ProgramaAsignatura | null>(null);
  const [cargando, setCargando] = useState(true);
  const [seccionActiva, setSeccionActiva] = useState('s1');
  const [editando, setEditando] = useState(false);
  const fieldRefs = useRef<Record<string, HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement | null>>({});
  const [editCheckboxes, setEditCheckboxes] = useState<Record<string, string[]>>({});
  const [editOtras, setEditOtras] = useState<Record<string, string>>({});
  const gridIdCounter = useRef(0);
  const [editCompRows, setEditCompRows] = useState<Array<{ _id: string; comp: string; res: string }>>([]);
  const [editContRows, setEditContRows] = useState<Array<{ _id: string; conc: string; proc: string; act: string }>>([]);
  const compRefMap = useRef<Record<string, { comp: HTMLTextAreaElement | null; res: HTMLTextAreaElement | null }>>({});
  const contRefMap = useRef<Record<string, { conc: HTMLTextAreaElement | null; proc: HTMLTextAreaElement | null; act: HTMLTextAreaElement | null }>>({});
  const [editUDRows, setEditUDRows] = useState<Array<{ _id: string; unidad: string; horas: string }>>([]);
  const udRefMap = useRef<Record<string, { unidad: HTMLTextAreaElement | null; horas: HTMLInputElement | null }>>({});
  const fpTextRef  = useRef<HTMLTextAreaElement | null>(null);
  const [editIntensRows, setEditIntensRows] = useState<Array<{ _id: string; intensidad: string; horasClase: string }>>([]);
  const intensRefMap = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [historialPagina, setHistorialPagina] = useState(1);
  const [historialAbierto, setHistorialAbierto] = useState(false);

  useEffect(() => {
    setCargando(true);
    apiFetch(`${API_URL}/programas/materia/${materiaId}`)
      .then(data => { setPrograma(data); setHistorialPagina(1); })
      .catch(() => setErrorMsg('No se pudo cargar el programa'))
      .finally(() => setCargando(false));
  }, [materiaId]);

  // S1-S6: todos los campos obligatorios deben tener >50 chars (textarea) o no estar vacíos (otros)
  // Excepción: validacion='masDeUnaPalabra' → completo cuando tiene más de una palabra
  function calcEstadoFromCampos(s: SeccionConfig, prog: ProgramaAsignatura): string {
    const reqs = s.campos.filter(c => c.obligatorio);
    if (reqs.length === 0) return 'PENDIENTE';
    const ok = reqs.every(c => {
      const val = String((prog as unknown as Record<string, unknown>)[c.key] ?? '').trim();
      if (c.validacion === 'masDeUnaPalabra') return val.split(/\s+/).filter(Boolean).length > 1;
      return c.tipo === 'textarea' ? val.length > 50 : val.length > 0;
    });
    return ok ? 'COMPLETO' : 'PENDIENTE';
  }

  function getEstadoSeccion(seccionId: string, prog: ProgramaAsignatura | null = programa): string {
    if (!prog) return 'PENDIENTE';
    const s = SECCIONES_PROGRAMA.find(x => x.id === seccionId);
    if (!s) return 'PENDIENTE';
    return String((prog as unknown as Record<string, unknown>)[s.estadoKey as string] ?? 'PENDIENTE');
  }

  const seccion = SECCIONES_PROGRAMA.find(s => s.id === seccionActiva)!;
  const estadoSeccion = getEstadoSeccion(seccionActiva);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function iniciarEdicionGrids() {
    const mkId = () => String(gridIdCounter.current++);
    const comps = tryParseJson<CompetenciaFila[]>(programa?.competenciasResultadosJson) ?? [];
    const conts  = tryParseJson<ContenidoFila[]>(programa?.contenidosGridJson) ?? [];
    compRefMap.current = {};
    contRefMap.current = {};
    setEditCompRows((comps.length > 0 ? comps : [{ competencia: '', resultadoAprendizaje: '' }])
      .map(c => ({ _id: mkId(), comp: c.competencia ?? '', res: c.resultadoAprendizaje ?? '' })));
    setEditContRows((conts.length > 0 ? conts : [{ conceptuales: '', procedimentales: '', actitudinales: '' }])
      .map(c => ({ _id: mkId(), conc: c.conceptuales ?? '', proc: c.procedimentales ?? '', act: c.actitudinales ?? '' })));
    setEditando(true);
    setErrorMsg(null);
  }

  async function guardarGrids() {
    const competencias: CompetenciaFila[] = editCompRows.map(row => ({
      competencia:          compRefMap.current[row._id]?.comp?.value ?? '',
      resultadoAprendizaje: compRefMap.current[row._id]?.res?.value  ?? '',
    }));
    const contenidos: ContenidoFila[] = editContRows.map(row => ({
      conceptuales:    contRefMap.current[row._id]?.conc?.value ?? '',
      procedimentales: contRefMap.current[row._id]?.proc?.value ?? '',
      actitudinales:   contRefMap.current[row._id]?.act?.value  ?? '',
    }));
    setGuardando(true);
    setErrorMsg(null);
    try {
      const payload: Record<string, unknown> = {
        seccionModificada:          seccion.titulo,
        competenciasResultadosJson: JSON.stringify(competencias),
        contenidosGridJson:         JSON.stringify(contenidos),
      };
      const data = await apiFetch(`${API_URL}/programas/materia/${materiaId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setPrograma(data);
      setEditando(false);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  function iniciarEdicionUnidades() {
    const mkId = () => String(gridIdCounter.current++);
    const uds = tryParseJson<UnidadDidacticaFila[]>(programa?.unidadesDidacticasJson) ?? [];
    udRefMap.current = {};
    setEditUDRows((uds.length > 0 ? uds : [{ unidad: '', horas: '' }])
      .map(u => ({ _id: mkId(), unidad: u.unidad ?? '', horas: u.horas ?? '' })));
    setEditando(true);
    setErrorMsg(null);
  }

  async function guardarUnidades() {
    const unidades: UnidadDidacticaFila[] = editUDRows.map(row => ({
      unidad: udRefMap.current[row._id]?.unidad?.value ?? '',
      horas:  udRefMap.current[row._id]?.horas?.value  ?? '',
    }));
    setGuardando(true);
    setErrorMsg(null);
    try {
      const payload: Record<string, unknown> = {
        seccionModificada:    seccion.titulo,
        unidadesDidacticasJson: JSON.stringify(unidades),
      };
      const data = await apiFetch(`${API_URL}/programas/materia/${materiaId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setPrograma(data);
      setEditando(false);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  function iniciarEdicionFormacion() {
    const mkId = () => String(gridIdCounter.current++);
    const filas = tryParseJson<IntensidadFila[]>(programa?.formacionPracticaJson) ?? [];
    intensRefMap.current = {};
    setEditIntensRows(filas.map(f => ({
      _id: mkId(),
      intensidad: f.intensidad ?? '',
      horasClase: f.horasClase != null ? String(f.horasClase) : '',
    })));
    setEditando(true);
    setErrorMsg(null);
  }

  async function guardarFormacion() {
    const texto = fpTextRef.current?.value ?? '';
    const filas: IntensidadFila[] = editIntensRows.map(row => ({
      intensidad: intensRefMap.current[row._id]?.value ?? row.intensidad,
      horasClase: Math.max(0, Math.min(99, parseInt(row.horasClase) || 0)),
    }));
    setGuardando(true);
    setErrorMsg(null);
    try {
      const payload: Record<string, unknown> = {
        seccionModificada:           seccion.titulo,
        actividadesFormacionPractica: texto,
        formacionPracticaJson:        JSON.stringify(filas),
      };
      const data = await apiFetch(`${API_URL}/programas/materia/${materiaId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setPrograma(data);
      setHistorialPagina(1);
      setEditando(false);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  function iniciarEdicion() {
    fieldRefs.current = {};
    const newCheckboxes: Record<string, string[]> = {};
    const newOtras: Record<string, string> = {};
    for (const campo of seccion.campos) {
      if (campo.tipo === 'checkboxgroup') {
        const stored = String((programa as unknown as Record<string, unknown>)[campo.key] ?? '');
        let arr: string[] = [];
        if (stored) { try { arr = JSON.parse(stored); } catch { arr = []; } }
        const regularOpts = arr.filter(o => !String(o).startsWith('Otra:'));
        const otraEntry = arr.find(o => String(o).startsWith('Otra:'));
        newCheckboxes[campo.key] = otraEntry ? [...regularOpts, 'Otra'] : regularOpts;
        newOtras[campo.key] = otraEntry ? String(otraEntry).replace(/^Otra:\s*/, '') : '';
      }
    }
    setEditCheckboxes(newCheckboxes);
    setEditOtras(newOtras);
    setEditando(true);
    setErrorMsg(null);
  }

  function cancelarEdicion() {
    fieldRefs.current = {};
    setEditCheckboxes({});
    setEditOtras({});
    setEditando(false);
    setErrorMsg(null);
  }

  async function guardarSeccion() {
    for (const campo of seccion.campos) {
      if (campo.digitosExactos) {
        const el = fieldRefs.current[campo.key];
        const value = (el ? el.value : '').trim();
        if (value !== '' && (!/^\d+$/.test(value) || value.length !== campo.digitosExactos)) {
          setErrorMsg(`"${campo.label}": ingrese exactamente ${campo.digitosExactos} dígitos numéricos (ej: ${new Date().getFullYear()}).`);
          return;
        }
      }
    }
    setGuardando(true);
    setErrorMsg(null);
    try {
      const payload: Record<string, unknown> = { seccionModificada: seccion.titulo };
      for (const campo of seccion.campos) {
        if (campo.tipo === 'checkboxgroup') {
          const selected = [...(editCheckboxes[campo.key] ?? [])];
          const otraIdx = selected.indexOf('Otra');
          if (otraIdx !== -1) {
            const otraEl = fieldRefs.current[`${campo.key}__otra`];
            const otraText = (otraEl ? otraEl.value : (editOtras[campo.key] ?? '')).trim();
            selected.splice(otraIdx, 1, `Otra: ${otraText}`);
          }
          payload[campo.key] = selected.length > 0 ? JSON.stringify(selected) : null;
        } else {
          const el = fieldRefs.current[campo.key];
          const value = el ? el.value : '';
          if (campo.tipo === 'number' || campo.tipo === 'year') {
            payload[campo.key] = value !== '' ? parseInt(value, 10) : null;
          } else {
            payload[campo.key] = value === '' ? null : value;
          }
        }
      }

      const data = await apiFetch(`${API_URL}/programas/materia/${materiaId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setPrograma(data);
      setEditando(false);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  // ── Progreso global ───────────────────────────────────────────────────────────

  const completadas = SECCIONES_PROGRAMA.filter(s => getEstadoSeccion(s.id) === 'COMPLETO').length;
  const porcentaje  = Math.round((completadas / SECCIONES_PROGRAMA.length) * 100);

  if (cargando) return <div className="flex justify-center py-12"><IcSpinner /></div>;
  if (!programa) return <div className="p-8 text-center text-xs text-slate-400">{errorMsg ?? 'No se pudo cargar el programa.'}</div>;

  const estadoProgCfg = ESTADO_PROG_CFG[programa.estadoPrograma] ?? ESTADO_PROG_CFG.PENDIENTE;
  // El backend devuelve estadoFuncional calculado; usarlo directamente para evitar duplicar reglas de negocio.
  const estadoFuncional = programa.estadoFuncional ?? 'INCOMPLETO';
  const estadoFuncCfg = ESTADO_FUNC_CFG[estadoFuncional] ?? ESTADO_FUNC_CFG.INCOMPLETO;
  const cellCls = 'w-full text-sm border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] resize-none';
  const compFilas = tryParseJson<CompetenciaFila[]>(programa.competenciasResultadosJson) ?? [];
  const contFilas   = tryParseJson<ContenidoFila[]>(programa.contenidosGridJson) ?? [];
  const udFilas     = tryParseJson<UnidadDidacticaFila[]>(programa.unidadesDidacticasJson) ?? [];
  const intensFilas = tryParseJson<IntensidadFila[]>(programa.formacionPracticaJson) ?? [];

  // Paginación del historial: 5 registros por página
  const HIST_POR_PAG   = 5;
  const histTotalPags  = Math.ceil(programa.historial.length / HIST_POR_PAG) || 1;
  const histPagActual  = Math.min(historialPagina, histTotalPags);
  const histVisible    = programa.historial.slice((histPagActual - 1) * HIST_POR_PAG, histPagActual * HIST_POR_PAG);

  return (
    <div>
      {/* Header del programa */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${estadoFuncCfg.cls}`}>
            {estadoFuncCfg.label}
          </span>
          <span className="text-[11px] text-slate-400">
            {completadas}/{SECCIONES_PROGRAMA.length} secciones completas
          </span>
          {programa.fechaActualizacion && (
            <span className="text-[11px] text-slate-400">
              · Actualizado {formatFecha(programa.fechaActualizacion)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHistorialAbierto(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Historial
          </button>
          {permisosPrograma.exportar && (
            <button
              onClick={() => exportarProgramaPDF(ficha, programa)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar PDF
            </button>
          )}
        </div>
      </div>

      {historialAbierto && (
        <ModalHistorialPrograma
          materiaId={materiaId}
          materiaNombre={ficha.nombre}
          onCerrar={() => setHistorialAbierto(false)}
        />
      )}

      {/* ── Indicador de completitud ─────────────────────────────────── */}
      {(() => {
        const radio = 30;
        const circ  = 2 * Math.PI * radio;
        const offset = circ * (1 - porcentaje / 100);
        const color  = porcentaje === 100 ? '#10b981' : porcentaje >= 50 ? '#f59e0b' : '#ef4444';
        return (
          <div className="px-5 pt-4 pb-1">
            <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-5">

              {/* Gráfico circular */}
              <div className="relative flex-shrink-0 w-20 h-20">
                <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
                  <circle cx="40" cy="40" r={radio} fill="none" stroke="#e2e8f0" strokeWidth="8" />
                  <circle
                    cx="40" cy="40" r={radio}
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold tabular-nums" style={{ color }}>{porcentaje}%</span>
                </div>
              </div>

              {/* Texto */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-slate-800">Avance del Formulario Programa Asignatura</h3>
                  <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    porcentaje === 100
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : porcentaje >= 50
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {porcentaje === 100 ? 'Completo' : porcentaje >= 50 ? 'En progreso' : 'Pendiente'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {completadas} de {SECCIONES_PROGRAMA.length} secciones completas
                </p>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ── Resumen ejecutivo ─────────────────────────────────────────── */}
      {(() => {
        const pendientes = SECCIONES_PROGRAMA.filter(s => getEstadoSeccion(s.id) !== 'COMPLETO');
        return (
          <div className="px-5 pb-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <span className="text-emerald-600 font-bold">✔</span>
                {completadas} de {SECCIONES_PROGRAMA.length} secciones completas
              </p>
              {pendientes.length === 0 ? (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <span className="font-bold">✔</span>
                  Programa de Asignatura completo.
                </p>
              ) : (
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-red-600 mb-1">
                    <span className="font-bold">✖</span>
                    Falta completar:
                  </p>
                  <ul className="ml-5 space-y-0.5">
                    {pendientes.map(s => (
                      <li key={s.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                        {s.titulo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Navegación de secciones */}
      <div className="flex gap-1 px-5 pt-4 pb-2 overflow-x-auto">
        {SECCIONES_PROGRAMA.map(s => {
          const esActiva = s.id === seccionActiva;
          const estadoS = getEstadoSeccion(s.id);
          return (
            <button
              key={s.id}
              onClick={() => { setSeccionActiva(s.id); setEditando(false); fieldRefs.current = {}; setEditCheckboxes({}); setEditOtras({}); setErrorMsg(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                esActiva
                  ? 'bg-[#0f4c81] text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                estadoS === 'COMPLETO'
                  ? esActiva ? 'bg-white/30 text-white' : 'bg-emerald-100 text-emerald-700'
                  : esActiva ? 'bg-white/20 text-white/80' : 'bg-slate-100 text-slate-500'
              }`}>
                {estadoS === 'COMPLETO' ? '✓' : s.numero}
              </span>
              {s.titulo}
            </button>
          );
        })}
      </div>

      {/* Contenido de sección activa */}
      <div className="px-5 py-4">

        {/* Encabezado de sección */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
              estadoSeccion === 'COMPLETO'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {estadoSeccion === 'COMPLETO' ? '✓ Completo' : '○ Pendiente'}
            </span>
          </div>
          {(permisosPrograma.editar || puedeEditarPrograma) && !editando && !modoVer && (
            <button
              onClick={seccion.renderTipo === 'grids' ? iniciarEdicionGrids : seccion.renderTipo === 'unidades' ? iniciarEdicionUnidades : seccion.renderTipo === 'formacion' ? iniciarEdicionFormacion : iniciarEdicion}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/5 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <IcEdit />
              Editar sección
            </button>
          )}
          {editando && (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelarEdicion}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={seccion.renderTipo === 'grids' ? guardarGrids : seccion.renderTipo === 'unidades' ? guardarUnidades : seccion.renderTipo === 'formacion' ? guardarFormacion : guardarSeccion}
                disabled={guardando}
                className="flex items-center gap-1.5 text-[11px] font-semibold bg-[#0f4c81] text-white px-3 py-1.5 rounded-lg hover:bg-[#0d3e6b] disabled:opacity-50 transition-colors"
              >
                {guardando ? 'Guardando...' : 'Guardar sección'}
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
            {errorMsg}
          </div>
        )}

        {/* ── Sección 2: grids dinámicos ── */}
        {seccion.renderTipo === 'grids' && (
          <div className="space-y-6">

            {/* Grid 1 — Competencias / Resultados */}
            <div>
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-3">
                Competencias / Resultados de aprendizaje
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                      <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 w-1/2">
                        Competencia <span className="text-red-500">*</span>
                      </th>
                      <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 w-1/2">
                        Resultado de aprendizaje <span className="text-red-500">*</span>
                      </th>
                      {editando && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {editando ? (
                      editCompRows.map(row => (
                        <tr key={row._id} className="border-b border-slate-100 last:border-0">
                          <td className="px-2 py-1.5 align-top">
                            <textarea
                              ref={el => { if (!compRefMap.current[row._id]) compRefMap.current[row._id] = { comp: null, res: null }; compRefMap.current[row._id].comp = el; }}
                              defaultValue={row.comp}
                              rows={2}
                              className={cellCls}
                            />
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <textarea
                              ref={el => { if (!compRefMap.current[row._id]) compRefMap.current[row._id] = { comp: null, res: null }; compRefMap.current[row._id].res = el; }}
                              defaultValue={row.res}
                              rows={2}
                              className={cellCls}
                            />
                          </td>
                          <td className="px-2 py-1.5 align-middle text-center">
                            {editCompRows.length > 1 && (
                              <button
                                onClick={() => { delete compRefMap.current[row._id]; setEditCompRows(prev => prev.filter(r => r._id !== row._id)); }}
                                className="text-slate-300 hover:text-red-500 transition-colors text-base leading-none"
                                title="Eliminar fila"
                              >✕</button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : compFilas.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-3 py-5 text-center text-sm text-slate-300 italic">Sin datos</td>
                      </tr>
                    ) : (
                      compFilas.map((row, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2.5 text-sm text-slate-700 align-top whitespace-pre-wrap">{row.competencia || <span className="text-slate-300 italic">—</span>}</td>
                          <td className="px-3 py-2.5 text-sm text-slate-700 align-top whitespace-pre-wrap">{row.resultadoAprendizaje || <span className="text-slate-300 italic">—</span>}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {editando && (
                <button
                  onClick={() => setEditCompRows(prev => [...prev, { _id: String(gridIdCounter.current++), comp: '', res: '' }])}
                  className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/5 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <span className="text-base leading-none">+</span> Agregar fila
                </button>
              )}
            </div>

            {/* Grid 2 — Contenidos */}
            <div>
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-3">
                Contenidos
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                      <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        Conceptuales <span className="text-red-500">*</span>
                      </th>
                      <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        Procedimentales <span className="text-red-500">*</span>
                      </th>
                      <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        Actitudinales <span className="text-red-500">*</span>
                      </th>
                      {editando && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {editando ? (
                      editContRows.map(row => (
                        <tr key={row._id} className="border-b border-slate-100 last:border-0">
                          <td className="px-2 py-1.5 align-top">
                            <textarea
                              ref={el => { if (!contRefMap.current[row._id]) contRefMap.current[row._id] = { conc: null, proc: null, act: null }; contRefMap.current[row._id].conc = el; }}
                              defaultValue={row.conc}
                              rows={2}
                              className={cellCls}
                            />
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <textarea
                              ref={el => { if (!contRefMap.current[row._id]) contRefMap.current[row._id] = { conc: null, proc: null, act: null }; contRefMap.current[row._id].proc = el; }}
                              defaultValue={row.proc}
                              rows={2}
                              className={cellCls}
                            />
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <textarea
                              ref={el => { if (!contRefMap.current[row._id]) contRefMap.current[row._id] = { conc: null, proc: null, act: null }; contRefMap.current[row._id].act = el; }}
                              defaultValue={row.act}
                              rows={2}
                              className={cellCls}
                            />
                          </td>
                          <td className="px-2 py-1.5 align-middle text-center">
                            {editContRows.length > 1 && (
                              <button
                                onClick={() => { delete contRefMap.current[row._id]; setEditContRows(prev => prev.filter(r => r._id !== row._id)); }}
                                className="text-slate-300 hover:text-red-500 transition-colors text-base leading-none"
                                title="Eliminar fila"
                              >✕</button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : contFilas.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-5 text-center text-sm text-slate-300 italic">Sin datos</td>
                      </tr>
                    ) : (
                      contFilas.map((row, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2.5 text-sm text-slate-700 align-top whitespace-pre-wrap">{row.conceptuales || <span className="text-slate-300 italic">—</span>}</td>
                          <td className="px-3 py-2.5 text-sm text-slate-700 align-top whitespace-pre-wrap">{row.procedimentales || <span className="text-slate-300 italic">—</span>}</td>
                          <td className="px-3 py-2.5 text-sm text-slate-700 align-top whitespace-pre-wrap">{row.actitudinales || <span className="text-slate-300 italic">—</span>}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {editando && (
                <button
                  onClick={() => setEditContRows(prev => [...prev, { _id: String(gridIdCounter.current++), conc: '', proc: '', act: '' }])}
                  className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/5 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <span className="text-base leading-none">+</span> Agregar fila
                </button>
              )}
            </div>

            {/* Footer */}
            <p className="text-[11px] text-slate-400 pt-3 border-t border-slate-100">
              <span className="text-red-500 font-semibold">*</span> Los campos marcados con asterisco son obligatorios.
            </p>
          </div>
        )}

        {/* ── Sección 3: unidades didácticas ── */}
        {seccion.renderTipo === 'unidades' && (
          <div className="space-y-4">
            <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-3">
              Unidades didácticas
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 w-4/5">
                      Unidad didáctica <span className="text-red-500">*</span>
                    </th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 w-1/5">
                      Horas
                    </th>
                    {editando && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {editando ? (
                    editUDRows.map(row => (
                      <tr key={row._id} className="border-b border-slate-100 last:border-0">
                        <td className="px-2 py-1.5 align-top">
                          <textarea
                            ref={el => { if (!udRefMap.current[row._id]) udRefMap.current[row._id] = { unidad: null, horas: null }; udRefMap.current[row._id].unidad = el; }}
                            defaultValue={row.unidad}
                            rows={2}
                            className={cellCls}
                          />
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <input
                            type="text"
                            inputMode="numeric"
                            ref={el => { if (!udRefMap.current[row._id]) udRefMap.current[row._id] = { unidad: null, horas: null }; udRefMap.current[row._id].horas = el; }}
                            defaultValue={row.horas}
                            onInput={e => { const el = e.currentTarget; const clean = soloDigitos(el.value); if (el.value !== clean) el.value = clean; }}
                            className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
                          />
                        </td>
                        <td className="px-2 py-1.5 align-middle text-center">
                          {editUDRows.length > 1 && (
                            <button
                              onClick={() => { delete udRefMap.current[row._id]; setEditUDRows(prev => prev.filter(r => r._id !== row._id)); }}
                              className="text-slate-300 hover:text-red-500 transition-colors text-base leading-none"
                              title="Eliminar fila"
                            >✕</button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : udFilas.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-5 text-center text-sm text-slate-300 italic">Sin datos</td>
                    </tr>
                  ) : (
                    udFilas.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2.5 text-sm text-slate-700 align-top whitespace-pre-wrap">{row.unidad || <span className="text-slate-300 italic">—</span>}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-700 align-top">{row.horas || <span className="text-slate-300 italic">—</span>}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {editando && (
              <button
                onClick={() => setEditUDRows(prev => [...prev, { _id: String(gridIdCounter.current++), unidad: '', horas: '' }])}
                className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/5 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <span className="text-base leading-none">+</span> Agregar fila
              </button>
            )}
            <p className="text-[11px] text-slate-400 pt-3 border-t border-slate-100">
              <span className="text-red-500 font-semibold">*</span> Los campos marcados con asterisco son obligatorios.
            </p>
          </div>
        )}

        {/* ── Sección 4: formación práctica ── */}
        {seccion.renderTipo === 'formacion' && (
          <div className="space-y-6">

            {/* Bloque 1: Actividades de Formación Práctica */}
            <div>
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-2">
                Actividades de formación práctica
              </p>
              {editando ? (
                <textarea
                  ref={fpTextRef}
                  defaultValue={programa?.actividadesFormacionPractica ?? ''}
                  rows={5}
                  className={cellCls}
                  placeholder="Describa las actividades de formación práctica de la asignatura..."
                />
              ) : (
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {programa.actividadesFormacionPractica || <span className="text-slate-300 italic">Sin datos</span>}
                </p>
              )}
            </div>

            {/* Bloque 2: Intensidad de la Formación Práctica */}
            <div>
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-2">
                Intensidad de la formación práctica
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                      <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        Intensidad de formación práctica
                      </th>
                      <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 w-32">
                        Horas de clase
                      </th>
                      {editando && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {editando ? (
                      editIntensRows.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-sm text-slate-300 italic">
                            Sin filas — use &ldquo;Agregar fila&rdquo;
                          </td>
                        </tr>
                      ) : (
                        editIntensRows.map(row => (
                          <tr key={row._id} className="border-b border-slate-100 last:border-0">
                            <td className="px-2 py-1.5 align-top">
                              <textarea
                                ref={el => { intensRefMap.current[row._id] = el; }}
                                defaultValue={row.intensidad}
                                rows={2}
                                className={cellCls}
                                placeholder="Tipo de actividad de formación práctica"
                              />
                            </td>
                            <td className="px-2 py-1.5 align-middle">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={row.horasClase}
                                onChange={e => {
                                  const digits = soloDigitos(e.target.value);
                                  const val = digits === '' ? '' : String(Math.min(99, parseInt(digits, 10)));
                                  setEditIntensRows(prev => prev.map(r => r._id === row._id ? { ...r, horasClase: val } : r));
                                }}
                                className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] text-center"
                              />
                            </td>
                            <td className="px-2 py-1.5 align-middle text-center">
                              <button
                                onClick={() => {
                                  delete intensRefMap.current[row._id];
                                  setEditIntensRows(prev => prev.filter(r => r._id !== row._id));
                                }}
                                className="text-slate-300 hover:text-red-500 transition-colors text-base leading-none"
                                title="Eliminar fila"
                              >✕</button>
                            </td>
                          </tr>
                        ))
                      )
                    ) : intensFilas.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-3 py-5 text-center text-sm text-slate-300 italic">Sin datos</td>
                      </tr>
                    ) : (
                      intensFilas.map((row, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2.5 text-sm text-slate-700 align-top whitespace-pre-wrap">
                            {row.intensidad || <span className="text-slate-300 italic">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-slate-700 text-center">
                            {row.horasClase ?? '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {editando && (
                <button
                  onClick={() => setEditIntensRows(prev => [...prev, { _id: String(gridIdCounter.current++), intensidad: '', horasClase: '' }])}
                  className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/5 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <span className="text-base leading-none">+</span> Agregar fila
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400 pt-3 border-t border-slate-100">
              Sección completa cuando el texto de actividades supera los 50 caracteres y existe al menos una fila de intensidad.
            </p>
          </div>
        )}

        {/* ── Secciones genéricas (1, 5-6) ── */}
        {!seccion.renderTipo && <div className="space-y-5">
            {seccion.campos.map(campo => {
              const valorActual = (programa as unknown as Record<string, unknown>)[campo.key];
              const valorStr = valorActual != null ? String(valorActual) : '';

              const labelNode = (
                <>
                  {campo.label}
                  {campo.obligatorio && <span className="text-red-500 ml-0.5">*</span>}
                </>
              );

              if (editando) {
                const edCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] resize-y';
                return (
                  <div key={campo.key}>
                    <label className="flex items-center gap-0.5 text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-0.5">
                      {labelNode}
                    </label>
                    {campo.obligatorio && campo.tipo === 'textarea' && (
                      <p className="text-[10px] text-slate-400 mb-1.5">Mínimo 50 caracteres para marcar como completo.</p>
                    )}
                    {campo.tipo === 'checkboxgroup' ? (
                      <div className="space-y-2">
                        {campo.opciones?.map(opcion => (
                          <label key={opcion} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={(editCheckboxes[campo.key] ?? []).includes(opcion)}
                              onChange={e => {
                                const isChecked = e.target.checked;
                                setEditCheckboxes(prev => ({
                                  ...prev,
                                  [campo.key]: isChecked
                                    ? [...(prev[campo.key] ?? []), opcion]
                                    : (prev[campo.key] ?? []).filter(o => o !== opcion)
                                }));
                              }}
                              className="mt-0.5 w-4 h-4 shrink-0 rounded border-slate-300 text-[#0f4c81] focus:ring-[#0f4c81]/30 cursor-pointer"
                            />
                            <span className="text-sm text-slate-700 leading-snug">{opcion}</span>
                          </label>
                        ))}
                        {campo.tieneOtra && (
                          <>
                            <label className="flex items-start gap-2.5 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={(editCheckboxes[campo.key] ?? []).includes('Otra')}
                                onChange={e => {
                                  const isChecked = e.target.checked;
                                  if (!isChecked) {
                                    const otraEl = fieldRefs.current[`${campo.key}__otra`];
                                    if (otraEl) setEditOtras(prev => ({ ...prev, [campo.key]: otraEl.value }));
                                  }
                                  setEditCheckboxes(prev => ({
                                    ...prev,
                                    [campo.key]: isChecked
                                      ? [...(prev[campo.key] ?? []), 'Otra']
                                      : (prev[campo.key] ?? []).filter(o => o !== 'Otra')
                                  }));
                                }}
                                className="mt-0.5 w-4 h-4 shrink-0 rounded border-slate-300 text-[#0f4c81] focus:ring-[#0f4c81]/30 cursor-pointer"
                              />
                              <span className="text-sm text-slate-700 leading-snug">OTRA (ESPECIFICAR)</span>
                            </label>
                            {(editCheckboxes[campo.key] ?? []).includes('Otra') && (
                              <input
                                ref={el => { fieldRefs.current[`${campo.key}__otra`] = el; }}
                                type="text"
                                defaultValue={editOtras[campo.key] ?? ''}
                                placeholder="Especificar tipo de formación práctica..."
                                className={`ml-6 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]`}
                              />
                            )}
                          </>
                        )}
                      </div>
                    ) : campo.tipo === 'textarea' ? (
                      <textarea
                        key={`${seccionActiva}-${campo.key}`}
                        ref={el => { fieldRefs.current[campo.key] = el; }}
                        defaultValue={String((programa as unknown as Record<string, unknown>)[campo.key] ?? '')}
                        placeholder={campo.placeholder}
                        rows={campo.rows ?? 4}
                        className={edCls}
                      />
                    ) : campo.tipo === 'year' ? (
                      <select
                        key={`${seccionActiva}-${campo.key}`}
                        ref={el => { fieldRefs.current[campo.key] = el; }}
                        defaultValue={String((programa as unknown as Record<string, unknown>)[campo.key] ?? '')}
                        className={edCls}
                      >
                        <option value="">-- Seleccionar año --</option>
                        {Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i).map(y => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        key={`${seccionActiva}-${campo.key}`}
                        ref={el => { fieldRefs.current[campo.key] = el; }}
                        type={campo.tipo}
                        defaultValue={
                          campo.tipo === 'date'
                            ? (valorStr ? valorStr.substring(0, 10) : '')
                            : String((programa as unknown as Record<string, unknown>)[campo.key] ?? '')
                        }
                        placeholder={campo.placeholder}
                        className={edCls}
                      />
                    )}
                  </div>
                );
              }

              return (
                <div key={campo.key} className="border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                  <p className="flex items-center gap-0.5 text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    {labelNode}
                  </p>
                  {valorStr ? (
                    campo.tipo === 'checkboxgroup' ? (
                      <ul className="space-y-0.5">
                        {(() => {
                          try {
                            return (JSON.parse(valorStr) as string[]).map(item => (
                              <li key={item} className="flex items-start gap-1.5 text-sm text-slate-700">
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#0f4c81] shrink-0" />
                                {item}
                              </li>
                            ));
                          } catch {
                            return <li className="text-sm text-slate-700">{valorStr}</li>;
                          }
                        })()}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {campo.key === 'estadoPrograma'
                          ? (ESTADO_PROG_CFG[valorStr]?.label ?? valorStr)
                          : campo.tipo === 'date'
                          ? formatFechaCorta(valorStr)
                          : valorStr}
                      </p>
                    )
                  ) : (
                    <p className="text-sm text-slate-300 italic">Sin datos</p>
                  )}
                </div>
              );
            })}

            {/* Nota de campos obligatorios */}
            {seccion.campos.some(c => c.obligatorio) && (
              <div className="pt-3 border-t border-slate-100 space-y-0.5">
                <p className="text-[11px] text-slate-400">
                  <span className="text-red-500 font-semibold">*</span> Los campos marcados con asterisco son obligatorios.
                </p>
                {seccion.campos.some(c => c.obligatorio && c.tipo === 'textarea') && (
                  <p className="text-[11px] text-slate-400">
                    Los campos de texto obligatorios deben contener más de 50 caracteres para ser considerados completos.
                  </p>
                )}
              </div>
            )}
          </div>}
      </div>

      {/* ── Historial de modificaciones ──────────────────────────────────── */}
      <div className="px-5 pb-5 pt-2">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Historial de modificaciones
            </h3>
          </div>
          {programa.historial.length === 0 ? (
            <div className="px-5 py-5 text-center">
              <p className="text-xs text-slate-400 italic">SIN MODIFICACIONES REGISTRADAS</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-50">
                {histVisible.map(item => {
                  const cfg = ACCION_PROG_CFG[item.accion] ?? { label: item.accion, cls: 'bg-slate-100 text-slate-500 border-slate-200' };
                  return (
                    <div key={item.id} className="px-5 py-3 flex items-start gap-3">
                      <span className={`mt-0.5 shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 leading-snug">
                          {item.descripcion ?? cfg.label}
                          {item.seccion && (
                            <span className="text-slate-400 ml-1">· {item.seccion}</span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {item.usuario.nombre} {item.usuario.apellido}
                          <span className="mx-1">·</span>
                          {new Date(item.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {' '}
                          {new Date(item.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {histTotalPags > 1 && (
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setHistorialPagina(p => Math.max(1, p - 1))}
                    disabled={histPagActual === 1}
                    className="text-[11px] font-medium px-3 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Página {histPagActual} de {histTotalPags}
                  </span>
                  <button
                    onClick={() => setHistorialPagina(p => Math.min(histTotalPags, p + 1))}
                    disabled={histPagActual === histTotalPags}
                    className="text-[11px] font-medium px-3 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
