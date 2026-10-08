'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch as apiFetchBase, mensajeErrorHttp } from '@/lib/api';
import { getPermisosPlanEstudio } from '@/lib/permisos-plan-estudios';
import { normalizarMayusculas } from '@/lib/normalizarMayusculas';

// ── Constantes ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const BLOQUE_NOMBRE: Record<string, string> = {
  CB: 'Ciencias Básicas',
  TB: 'Tecnologías Básicas',
  TA: 'Tecnologías Aplicadas',
  CX: 'Cs. y Tecn. Complementarias',
  EL: 'Electivas',
};

const BLOQUES_CONOCIMIENTO = [
  { codigo: 'CB', label: 'CB - Ciencias Básicas' },
  { codigo: 'TB', label: 'TB - Tecnologías Básicas' },
  { codigo: 'TA', label: 'TA - Tecnologías Aplicadas' },
  { codigo: 'CX', label: 'CX - Cs. y Tecn. Complementarias' },
  { codigo: 'EL', label: 'EL - Electivas' },
];

const TIPOS_ASIGNATURA   = ['OBLIGATORIA', 'ELECTIVA', 'OPTATIVA'];
const ESTADOS_ASIGNATURA = ['ACTIVO', 'INACTIVO'];
const MODALIDADES_DICTADO = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'VIRTUAL',    label: 'Virtual' },
  { value: 'HÍBRIDA',    label: 'Híbrida' },
];

const MATERIA_VACIA = {
  codigo: '', nombre: '', descripcion: '', anio: '',
  cuatrimestre: '', bloqueConocimiento: '', modalidadDictado: '',
  cargaHorariaSemanal: '', cargaHorariaTotal: '', creditos: '',
  tipoAsignatura: 'OBLIGATORIA', estado: 'ACTIVO', observaciones: '',
};
type FormMateria = typeof MATERIA_VACIA;

type SortCol = 'codigo' | 'nombre' | 'bloque' | 'hSemanal' | 'hTotal' | null;

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Facultad  { id: string; nombre: string }
interface Carrera   { id: string; nombre: string; facultad?: Facultad }
interface PlanDetalle {
  id: string; nombre: string; anio?: number; version?: string;
  estado: string; duracionCuatrimestres?: number; totalCreditos?: number;
  carrera: Carrera;
}
interface DocenteVinculado {
  id: string; nombre: string; apellido: string;
}
interface Materia {
  id: string; codigo: string; nombre: string;
  anio?: number; cuatrimestre?: number;
  bloqueConocimiento?: string; modalidadDictado?: string;
  cargaHorariaSemanal?: number; cargaHorariaTotal?: number;
  creditos: number; tipoAsignatura: string; estado: string;
  descripcion?: string; observaciones?: string; planEstudioId: string;
  vinculaciones?: { docente: DocenteVinculado }[];
}
interface CorrelativaItem {
  id: string; tipo: string;
  correlativa: { id: string; codigo: string; nombre: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bloqueColor(b?: string) {
  if (b === 'CB') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (b === 'TB') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (b === 'TA') return 'bg-orange-50 text-orange-700 border-orange-200';
  if (b === 'CX') return 'bg-teal-50 text-teal-700 border-teal-200';
  if (b === 'EL') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-500 border-slate-200';
}

function estadoPlanLabel(e: string) {
  if (e === 'ACTIVO')      return 'Vigente';
  if (e === 'EN_REVISION') return 'En revisión';
  return 'No vigente';
}
function estadoPlanClases(e: string) {
  if (e === 'ACTIVO')      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (e === 'EN_REVISION') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-500 border-slate-200';
}

function groupMaterias(materias: Materia[]): Record<string, Record<string, Materia[]>> {
  const result: Record<string, Record<string, Materia[]>> = {};
  for (const m of materias) {
    const a = m.anio?.toString() ?? 'Sin año';
    const c = m.cuatrimestre?.toString() ?? 'Sin cuatrimestre';
    if (!result[a]) result[a] = {};
    if (!result[a][c]) result[a][c] = [];
    result[a][c].push(m);
  }
  return result;
}

function sortedKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).sort((a, b) => {
    const na = parseInt(a), nb = parseInt(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return a.localeCompare(b);
  });
}

function sortarMaterias(list: Materia[], col: SortCol, asc: boolean): Materia[] {
  if (!col) return list;
  return [...list].sort((a, b) => {
    let va: string | number, vb: string | number;
    if      (col === 'codigo')   { va = a.codigo;                      vb = b.codigo; }
    else if (col === 'nombre')   { va = a.nombre;                      vb = b.nombre; }
    else if (col === 'bloque')   { va = a.bloqueConocimiento ?? 'zzz'; vb = b.bloqueConocimiento ?? 'zzz'; }
    else if (col === 'hSemanal') { va = a.cargaHorariaSemanal ?? -1;   vb = b.cargaHorariaSemanal ?? -1; }
    else                         { va = a.cargaHorariaTotal   ?? -1;   vb = b.cargaHorariaTotal   ?? -1; }
    if (typeof va === 'string' && typeof vb === 'string')
      return asc ? va.localeCompare(vb) : vb.localeCompare(va);
    return asc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });
}

// ── Iconos ────────────────────────────────────────────────────────────────────

const IcPlus = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const IcEdit = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const IcBaja = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);
const IcClose = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IcSearch = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const IcBack = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);
const IcChevron = ({ collapsed }: { collapsed: boolean }) => (
  <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);
const IcSort = ({ col, active, asc }: { col: string; active: boolean; asc: boolean }) => (
  <span className="inline-flex flex-col ml-1 align-middle">
    <svg className={`w-2 h-2 ${active && asc ? 'text-[#0f4c81]' : 'text-slate-300'}`} viewBox="0 0 6 4" fill="currentColor">
      <path d="M3 0L6 4H0L3 0Z" />
    </svg>
    <svg className={`w-2 h-2 ${active && !asc ? 'text-[#0f4c81]' : 'text-slate-300'}`} viewBox="0 0 6 4" fill="currentColor">
      <path d="M3 4L0 0H6L3 4Z" />
    </svg>
  </span>
);

// ── Componente principal ──────────────────────────────────────────────────────

export default function EstructuraCurricularPage() {
  const params    = useParams();
  const carreraId = params.carreraId as string;
  const planId    = params.planId    as string;
  const { usuario } = useAuth();
  const permisos = getPermisosPlanEstudio(usuario?.rol?.nombre ?? '');

  // ── State ─────────────────────────────────────────────────────────────────
  const [plan,            setPlan]            = useState<PlanDetalle | null>(null);
  const [materias,        setMaterias]        = useState<Materia[]>([]);
  const [correlativasMap, setCorrelativasMap] = useState<Map<string, CorrelativaItem[]>>(new Map());
  const [cargando,        setCargando]        = useState(true);
  const [cargandoCorr,    setCargandoCorr]    = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  // Filtros
  const [buscar,       setBuscar]       = useState('');
  const [filtroAnio,   setFiltroAnio]   = useState('');
  const [filtroCuatri, setFiltroCuatri] = useState('');
  const [filtroBloque, setFiltroBloque] = useState('');

  // Acordeón años colapsados
  const [aniosColapsados, setAniosColapsados] = useState<Set<string>>(new Set());

  // Ordenamiento global (aplica a todas las tablas)
  const [ordenCol, setOrdenCol] = useState<SortCol>('codigo');
  const [ordenAsc, setOrdenAsc] = useState(true);

  // Modal
  const [modalAbierto,  setModalAbierto]  = useState(false);
  const [materiaEditar, setMateriaEditar] = useState<Materia | null>(null);
  const [formMateria,   setFormMateria]   = useState<FormMateria>(MATERIA_VACIA);
  const [guardando,     setGuardando]     = useState(false);
  const [materiasEditables, setMateriasEditables] = useState<Set<string>>(new Set());

  // ── API ───────────────────────────────────────────────────────────────────
  async function apiFetch(url: string, opts?: RequestInit) {
    const res = await apiFetchBase(url, opts);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error en la solicitud'));
    return data;
  }

  useEffect(() => {
    if (!usuario || !planId) return;
    setCargando(true);
    Promise.all([
      apiFetch(`${API_URL}/plan-estudios/${planId}`),
      apiFetch(`${API_URL}/materias?planEstudioId=${planId}`),
    ])
      .then(([planData, materiasData]) => {
        setPlan(planData);
        const lista: Materia[] = materiasData ?? [];
        setMaterias(lista);
        if (lista.length > 0) cargarCorrelativas(lista);
        if (usuario?.rol?.nombre === 'DOCENTE') cargarMateriasEditables();
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setCargando(false));
  }, [usuario, planId]);

  async function cargarCorrelativas(lista: Materia[]) {
    setCargandoCorr(true);
    const resultados = await Promise.allSettled(
      lista.map(m => apiFetch(`${API_URL}/materias/${m.id}/correlativas`))
    );
    const mapa = new Map<string, CorrelativaItem[]>();
    resultados.forEach((r, i) => {
      mapa.set(lista[i].id, r.status === 'fulfilled' ? (r.value ?? []) : []);
    });
    setCorrelativasMap(mapa);
    setCargandoCorr(false);
  }

  async function cargarMateriasEditables() {
    try {
      const data: { materia?: { id: string } }[] = await apiFetch(`${API_URL}/vinculaciones-catedra?estado=APROBADA`);
      setMateriasEditables(new Set(data.map(v => v.materia?.id).filter((id): id is string => !!id)));
    } catch {
      // falla segura: sin permisos de edición
    }
  }

  // ── Datos derivados ───────────────────────────────────────────────────────
  const materiasFiltradas = useMemo(() => {
    const t = buscar.trim().toLowerCase();
    return materias.filter(m => {
      if (filtroAnio   && m.anio?.toString()        !== filtroAnio)   return false;
      if (filtroCuatri && m.cuatrimestre?.toString() !== filtroCuatri) return false;
      if (filtroBloque && m.bloqueConocimiento        !== filtroBloque) return false;
      if (t && !m.nombre.toLowerCase().includes(t) && !m.codigo.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [materias, buscar, filtroAnio, filtroCuatri, filtroBloque]);

  const agrupadas = useMemo(() => groupMaterias(materiasFiltradas), [materiasFiltradas]);

  const kpis = useMemo(() => ({
    total:        materias.length,
    obligatorias: materias.filter(m => m.tipoAsignatura === 'OBLIGATORIA').length,
    electivas:    materias.filter(m => m.tipoAsignatura === 'ELECTIVA').length,
    horasTotal:   materias.reduce((s, m) => s + (m.cargaHorariaTotal ?? 0), 0),
  }), [materias]);

  const aniosDisponibles   = useMemo(() =>
    [...new Set(materias.map(m => m.anio?.toString()).filter(Boolean))].sort((a, b) => parseInt(a!) - parseInt(b!)) as string[],
    [materias]);
  const cuatrisDisponibles = useMemo(() =>
    [...new Set(materias.map(m => m.cuatrimestre?.toString()).filter(Boolean))].sort((a, b) => parseInt(a!) - parseInt(b!)) as string[],
    [materias]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function toggleAnio(anio: string) {
    setAniosColapsados(prev => {
      const next = new Set(prev);
      next.has(anio) ? next.delete(anio) : next.add(anio);
      return next;
    });
  }

  function toggleSort(col: SortCol) {
    if (ordenCol === col) setOrdenAsc(p => !p);
    else { setOrdenCol(col); setOrdenAsc(true); }
  }

  function abrirCrear() {
    setFormMateria(MATERIA_VACIA); setMateriaEditar(null); setModalAbierto(true);
  }
  function abrirEditar(m: Materia) {
    setFormMateria({
      codigo: m.codigo, nombre: m.nombre, descripcion: m.descripcion ?? '',
      anio: m.anio?.toString() ?? '', cuatrimestre: m.cuatrimestre?.toString() ?? '',
      bloqueConocimiento: m.bloqueConocimiento ?? '', modalidadDictado: m.modalidadDictado ?? '',
      cargaHorariaSemanal: m.cargaHorariaSemanal?.toString() ?? '',
      cargaHorariaTotal: m.cargaHorariaTotal?.toString() ?? '',
      creditos: m.creditos?.toString() ?? '',
      tipoAsignatura: m.tipoAsignatura, estado: m.estado, observaciones: m.observaciones ?? '',
    });
    setMateriaEditar(m); setModalAbierto(true);
  }
  function setF(campo: keyof FormMateria, val: string) {
    setFormMateria(prev => ({ ...prev, [campo]: val }));
  }

  async function guardarMateria() {
    if (!formMateria.codigo.trim() || !formMateria.nombre.trim()) {
      alert('El código y el nombre son obligatorios.'); return;
    }
    setGuardando(true);
    try {
      if (materiaEditar) {
        const payload: Record<string, unknown> = {
          codigo: formMateria.codigo.trim(), nombre: formMateria.nombre.trim(),
          tipoAsignatura: formMateria.tipoAsignatura, estado: formMateria.estado,
          descripcion: formMateria.descripcion.trim() || null,
          bloqueConocimiento: formMateria.bloqueConocimiento || null,
          modalidadDictado: formMateria.modalidadDictado || null,
          observaciones: formMateria.observaciones.trim() || null,
          anio:               formMateria.anio               !== '' ? parseInt(formMateria.anio)               : null,
          cuatrimestre:       formMateria.cuatrimestre       !== '' ? parseInt(formMateria.cuatrimestre)       : null,
          cargaHorariaSemanal:formMateria.cargaHorariaSemanal!== '' ? parseInt(formMateria.cargaHorariaSemanal) : null,
          cargaHorariaTotal:  formMateria.cargaHorariaTotal  !== '' ? parseInt(formMateria.cargaHorariaTotal)  : null,
          creditos: formMateria.creditos !== '' ? parseInt(formMateria.creditos) : 0,
        };
        const saved: Materia = await apiFetch(`${API_URL}/materias/${materiaEditar.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setMaterias(prev => prev.map(m => m.id === materiaEditar.id ? { ...m, ...saved } : m));
      } else {
        const payload: Record<string, unknown> = {
          codigo: formMateria.codigo.trim(), nombre: formMateria.nombre.trim(),
          planEstudioId: planId, tipoAsignatura: formMateria.tipoAsignatura, estado: formMateria.estado,
        };
        if (formMateria.descripcion.trim())   payload.descripcion          = formMateria.descripcion.trim();
        if (formMateria.anio)                 payload.anio                 = parseInt(formMateria.anio);
        if (formMateria.cuatrimestre !== '')  payload.cuatrimestre         = parseInt(formMateria.cuatrimestre);
        if (formMateria.bloqueConocimiento)   payload.bloqueConocimiento   = formMateria.bloqueConocimiento;
        if (formMateria.modalidadDictado)     payload.modalidadDictado     = formMateria.modalidadDictado;
        if (formMateria.cargaHorariaSemanal)  payload.cargaHorariaSemanal  = parseInt(formMateria.cargaHorariaSemanal);
        if (formMateria.cargaHorariaTotal)    payload.cargaHorariaTotal    = parseInt(formMateria.cargaHorariaTotal);
        if (formMateria.creditos)             payload.creditos             = parseInt(formMateria.creditos);
        if (formMateria.observaciones.trim()) payload.observaciones        = formMateria.observaciones.trim();
        const saved: Materia = await apiFetch(`${API_URL}/materias`, { method: 'POST', body: JSON.stringify(payload) });
        setMaterias(prev => [...prev, saved]);
        setCorrelativasMap(prev => new Map(prev).set(saved.id, []));
      }
      setModalAbierto(false);
    } catch (e) { alert((e as Error).message); }
    finally { setGuardando(false); }
  }

  async function darDeBaja(m: Materia) {
    if (!confirm(`¿Confirmar baja lógica de "${m.nombre}"?\nLa asignatura pasará a estado INACTIVO.`)) return;
    try {
      await apiFetch(`${API_URL}/materias/${m.id}`, { method: 'DELETE' });
      setMaterias(prev => prev.filter(x => x.id !== m.id));
    } catch (e) { alert((e as Error).message); }
  }

  const hayFiltros = !!(buscar || filtroAnio || filtroCuatri || filtroBloque);
  const aniosOrdenados = sortedKeys(agrupadas);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5 flex-wrap">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <a href="/plan-estudios" className="hover:text-slate-600 transition-colors">Plan de Estudios</a>
        <span>/</span>
        <Link href="/plan-estudios/carreras" className="hover:text-slate-600 transition-colors">Carreras</Link>
        <span>/</span>
        <Link href={`/plan-estudios/carreras/${carreraId}/planes`} className="hover:text-slate-600 transition-colors">
          {cargando ? '...' : (plan?.carrera?.nombre ?? 'Carrera')}
        </Link>
        <span>/</span>
        <Link href={`/plan-estudios/carreras/${carreraId}/planes`} className="hover:text-slate-600 transition-colors">
          {cargando ? '...' : (plan?.nombre ?? 'Plan')}
        </Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">Estructura Curricular</span>
      </nav>

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Plan de Estudios</p>
          <h1 className="text-xl font-bold text-slate-800">Estructura Curricular</h1>
          {cargando ? (
            <div className="mt-2 space-y-1.5">
              <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-48 bg-slate-100 rounded animate-pulse" />
            </div>
          ) : plan ? (
            <div className="mt-1.5 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-slate-800">{plan.nombre}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${estadoPlanClases(plan.estado)}`}>
                  {estadoPlanLabel(plan.estado)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {plan.anio && (
                  <span className="text-[11px] font-mono font-bold bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/15">
                    {plan.anio}
                  </span>
                )}
                {plan.version && (
                  <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                    v{plan.version}
                  </span>
                )}
                <span className="text-xs text-[#0f4c81] font-semibold">{plan.carrera?.nombre}</span>
              </div>
              {plan.carrera?.facultad && (
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                  </svg>
                  {plan.carrera.facultad.nombre}
                </p>
              )}
            </div>
          ) : null}
        </div>
        <Link
          href={`/plan-estudios/carreras/${carreraId}/planes`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors self-start whitespace-nowrap"
        >
          <IcBack />
          Volver a Planes
        </Link>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      {!cargando && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Total de Asignaturas
            </p>
            <p className="text-3xl font-extrabold text-[#0f4c81] tabular-nums leading-none">
              {kpis.total}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Carga Horaria Total
            </p>
            <p className="text-3xl font-extrabold text-slate-700 tabular-nums leading-none">
              {kpis.horasTotal > 0
                ? <>{kpis.horasTotal}<span className="text-lg font-bold text-slate-400 ml-0.5">h</span></>
                : '—'
              }
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Obligatorias
            </p>
            <p className="text-3xl font-extrabold text-emerald-700 tabular-nums leading-none">
              {kpis.obligatorias}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Electivas
            </p>
            <p className="text-3xl font-extrabold text-amber-600 tabular-nums leading-none">
              {kpis.electivas}
            </p>
          </div>

        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}

      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <IcSearch />
          </div>
          <input
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por código o nombre..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
          />
        </div>
        <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
          <option value="">Todos los años</option>
          {aniosDisponibles.map(a => <option key={a} value={a}>{a}° Año</option>)}
        </select>
        <select value={filtroCuatri} onChange={e => setFiltroCuatri(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
          <option value="">Todos los cuatrimestres</option>
          {cuatrisDisponibles.map(c => <option key={c} value={c}>{c}° Cuatrimestre</option>)}
        </select>
        <select value={filtroBloque} onChange={e => setFiltroBloque(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
          <option value="">Todos los bloques</option>
          {BLOQUES_CONOCIMIENTO.map(b => <option key={b.codigo} value={b.codigo}>{b.label}</option>)}
        </select>
        {permisos.crear && (
          <button onClick={abrirCrear}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0f4c81] text-white text-xs font-semibold hover:bg-[#0d3e6b] transition-colors whitespace-nowrap">
            <IcPlus />Nueva Asignatura
          </button>
        )}
      </div>

      {/* Resumen */}
      {hayFiltros && !cargando && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-slate-400">
            {materiasFiltradas.length} resultado{materiasFiltradas.length !== 1 ? 's' : ''} de {materias.length} asignaturas
          </p>
          <button onClick={() => { setBuscar(''); setFiltroAnio(''); setFiltroCuatri(''); setFiltroBloque(''); }}
            className="text-[11px] text-[#0f4c81] hover:underline font-medium">
            Limpiar filtros
          </button>
        </div>
      )}

      {/* ── Contenido ────────────────────────────────────────────────────── */}
      {cargando ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex items-center justify-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin" />
          <span className="text-sm text-slate-500">Cargando estructura curricular...</span>
        </div>

      ) : materias.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <p className="text-sm font-semibold text-slate-700 mb-1">Sin asignaturas</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Este plan no tiene asignaturas registradas.
            {permisos.crear && ' Podés agregar una con "Nueva Asignatura".'}
          </p>
          {permisos.crear && (
            <button onClick={abrirCrear}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f4c81] text-white text-xs font-semibold hover:bg-[#0d3e6b] transition-colors mx-auto">
              <IcPlus />Nueva Asignatura
            </button>
          )}
        </div>

      ) : materiasFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <p className="text-sm font-semibold text-slate-700 mb-1">Sin resultados</p>
          <p className="text-xs text-slate-400">Ninguna asignatura coincide con los filtros aplicados.</p>
          <button onClick={() => { setBuscar(''); setFiltroAnio(''); setFiltroCuatri(''); setFiltroBloque(''); }}
            className="mt-3 text-xs text-[#0f4c81] hover:underline font-medium">
            Limpiar filtros
          </button>
        </div>

      ) : (
        <div className="space-y-3">
          {aniosOrdenados.map(anio => {
            const cuatrisDelAnio = agrupadas[anio];
            const cuatrisOrdenados = sortedKeys(cuatrisDelAnio);
            const colapsado = aniosColapsados.has(anio);
            const totalAnio = Object.values(cuatrisDelAnio).reduce((s, arr) => s + arr.length, 0);
            const esNumerico = !isNaN(parseInt(anio));

            return (
              <div key={anio} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

                {/* ── Cabecera de Año (colapsable) ── */}
                <button
                  type="button"
                  onClick={() => toggleAnio(anio)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#0f4c81]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-extrabold text-[#0f4c81]">
                        {esNumerico ? anio : '?'}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-800 leading-tight">
                        {esNumerico ? `${anio}° Año` : anio}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {totalAnio} asignatura{totalAnio !== 1 ? 's' : ''}
                        {' · '}
                        {cuatrisOrdenados.length} cuatrimestre{cuatrisOrdenados.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <IcChevron collapsed={colapsado} />
                </button>

                {/* ── Cuatrimestres + tablas ── */}
                {!colapsado && (
                  <div className="border-t border-slate-100">
                    {cuatrisOrdenados.map((cuatri, cidx) => {
                      const materiasGrupo = sortarMaterias(cuatrisDelAnio[cuatri], ordenCol, ordenAsc);
                      const esCuatriNum = !isNaN(parseInt(cuatri));
                      const cuatriLabel = esCuatriNum ? `${cuatri}° Cuatrimestre` : cuatri;

                      return (
                        <div key={cuatri} className={cidx > 0 ? 'border-t border-slate-100' : ''}>

                          {/* Cabecera cuatrimestre */}
                          <div className="px-5 py-2.5 bg-slate-50/70 flex items-center gap-2.5 border-b border-slate-100">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                              {cuatriLabel}
                            </span>
                            <span className="text-[10px] bg-white text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 font-semibold tabular-nums">
                              {materiasGrupo.length} asignatura{materiasGrupo.length !== 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Tabla */}
                          {materiasGrupo.length === 0 ? (
                            <div className="px-5 py-6 text-center text-xs text-slate-400">
                              Sin asignaturas en este cuatrimestre.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs min-w-[900px]">
                                <thead>
                                  <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                                    <Th label="Código"     col="codigo"   ordenCol={ordenCol} ordenAsc={ordenAsc} onClick={() => toggleSort('codigo')}   cls="w-28 pl-5" />
                                    <Th label="Asignatura" col="nombre"   ordenCol={ordenCol} ordenAsc={ordenAsc} onClick={() => toggleSort('nombre')}   cls="min-w-[180px]" />
                                    <Th label="Bloque"     col="bloque"   ordenCol={ordenCol} ordenAsc={ordenAsc} onClick={() => toggleSort('bloque')}   cls="min-w-[160px]" />
                                    <th className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wide text-[10px] min-w-[140px]">
                                      Correlativas aprobadas
                                    </th>
                                    <th className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wide text-[10px] min-w-[160px]">
                                      Docentes vinculados
                                    </th>
                                    <Th label="H/Sem" col="hSemanal" ordenCol={ordenCol} ordenAsc={ordenAsc} onClick={() => toggleSort('hSemanal')} cls="w-20 text-center" />
                                    <Th label="H/Tot" col="hTotal"   ordenCol={ordenCol} ordenAsc={ordenAsc} onClick={() => toggleSort('hTotal')}   cls="w-20 text-center" />
                                    <th className="px-3 py-2.5 pr-5 text-right font-semibold text-slate-400 uppercase tracking-wide text-[10px] w-32">
                                      Acciones
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {materiasGrupo.map(materia => {
                                    const corrItems = correlativasMap.get(materia.id);
                                    const corrAprobadas = (corrItems ?? [])
                                      .map(c => c.correlativa.codigo);
                                    const nombreBloque = materia.bloqueConocimiento
                                      ? (BLOQUE_NOMBRE[materia.bloqueConocimiento] ?? materia.bloqueConocimiento)
                                      : null;

                                    return (
                                      <tr key={materia.id} className="hover:bg-slate-50/60 transition-colors">

                                        {/* Código */}
                                        <td className="pl-5 pr-3 py-3">
                                          <span className="text-[10px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/15 whitespace-nowrap">
                                            {materia.codigo || '—'}
                                          </span>
                                        </td>

                                        {/* Asignatura */}
                                        <td className="px-3 py-3">
                                          <p className="text-xs font-semibold text-slate-800 leading-tight">
                                            {materia.nombre}
                                          </p>
                                          {materia.descripcion && (
                                            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                                              {materia.descripcion}
                                            </p>
                                          )}
                                        </td>

                                        {/* Bloque */}
                                        <td className="px-3 py-3">
                                          {nombreBloque ? (
                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded border whitespace-nowrap ${bloqueColor(materia.bloqueConocimiento)}`}>
                                              {nombreBloque}
                                            </span>
                                          ) : (
                                            <span className="text-slate-300 text-[11px]">—</span>
                                          )}
                                        </td>

                                        {/* Correlativas aprobadas */}
                                        <td className="px-3 py-3">
                                          {cargandoCorr && !correlativasMap.has(materia.id) ? (
                                            <div className="w-3 h-3 rounded-full border border-slate-200 border-t-[#0f4c81] animate-spin" />
                                          ) : corrAprobadas.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                              {corrAprobadas.map(cod => (
                                                <span key={cod} className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                                                  {cod}
                                                </span>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-[11px] text-slate-400 italic">Sin correlativas</span>
                                          )}
                                        </td>

                                        {/* Docentes vinculados */}
                                        <td className="px-3 py-3">
                                          {(materia.vinculaciones ?? []).length > 0 ? (
                                            <div className="flex flex-col gap-0.5">
                                              {(materia.vinculaciones ?? []).map(v => (
                                                <span key={v.docente.id} className="text-[10px] text-slate-700 font-medium leading-tight">
                                                  {v.docente.apellido.toUpperCase()}, {v.docente.nombre}
                                                </span>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-[10px] text-slate-400 italic">Sin docente vinculado</span>
                                          )}
                                        </td>

                                        {/* H/Sem */}
                                        <td className="px-3 py-3 text-center text-slate-600 tabular-nums">
                                          {materia.cargaHorariaSemanal != null
                                            ? <>{materia.cargaHorariaSemanal}<span className="text-slate-400 text-[10px]">h</span></>
                                            : <span className="text-slate-300">—</span>
                                          }
                                        </td>

                                        {/* H/Tot */}
                                        <td className="px-3 py-3 text-center text-slate-600 tabular-nums">
                                          {materia.cargaHorariaTotal != null
                                            ? <>{materia.cargaHorariaTotal}<span className="text-slate-400 text-[10px]">h</span></>
                                            : <span className="text-slate-300">—</span>
                                          }
                                        </td>

                                        {/* Acciones */}
                                        <td className="pl-3 pr-5 py-3">
                                          <div className="flex items-center justify-end gap-1">
                                            <Link
                                              href={`/plan-estudios/ficha-asignatura?id=${materia.id}`}
                                              className="text-[11px] font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/8 px-2 py-1 rounded transition-colors whitespace-nowrap"
                                            >
                                              Ver
                                            </Link>
                                            {(permisos.editar || materiasEditables.has(materia.id)) && (
                                              <button onClick={() => abrirEditar(materia)}
                                                className="p-1.5 rounded text-slate-400 hover:text-[#0f4c81] hover:bg-[#0f4c81]/8 transition-colors"
                                                title="Editar asignatura">
                                                <IcEdit />
                                              </button>
                                            )}
                                            {permisos.eliminar && (
                                              <button onClick={() => darDeBaja(materia)}
                                                className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                title="Baja lógica">
                                                <IcBaja />
                                              </button>
                                            )}
                                          </div>
                                        </td>

                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalAbierto && (
        <ModalMateria
          editando={materiaEditar}
          form={formMateria}
          setF={setF}
          guardando={guardando}
          onGuardar={guardarMateria}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </div>
  );
}

// ── Th: encabezado de columna ordenable ──────────────────────────────────────

function Th({ label, col, ordenCol, ordenAsc, onClick, cls = '' }: {
  label: string; col: string;
  ordenCol: SortCol; ordenAsc: boolean;
  onClick: () => void; cls?: string;
}) {
  const active = ordenCol === col;
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wide text-[10px] cursor-pointer select-none hover:text-slate-600 hover:bg-slate-50/80 transition-colors ${cls}`}
    >
      <span className="inline-flex items-center">
        {label}
        <IcSort col={col} active={active} asc={ordenAsc} />
      </span>
    </th>
  );
}

// ── ModalMateria ──────────────────────────────────────────────────────────────

function ModalMateria({ editando, form, setF, guardando, onGuardar, onCerrar }: {
  editando: Materia | null; form: FormMateria;
  setF: (campo: keyof FormMateria, val: string) => void;
  guardando: boolean; onGuardar: () => void; onCerrar: () => void;
}) {
  const lbl = 'block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1';
  const inp = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]';
  const sel = `${inp} bg-white`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">
            {editando ? 'Editar Asignatura' : 'Nueva Asignatura'}
          </h3>
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-600"><IcClose /></button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Código <span className="text-red-500">*</span></label>
              <input value={form.codigo} onChange={e => setF('codigo', e.target.value)}
                placeholder="Ej: MAT-101" data-no-uppercase="true" className={`${inp} font-mono`} />
            </div>
            <div>
              <label className={lbl}>Estado</label>
              <select value={form.estado} onChange={e => setF('estado', e.target.value)} className={sel}>
                {ESTADOS_ASIGNATURA.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Nombre <span className="text-red-500">*</span></label>
            <input value={form.nombre} onChange={e => setF('nombre', normalizarMayusculas(e.target.value))}
              placeholder="Ej: Matemática I" data-no-uppercase="true" className={inp} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Año</label>
              <input type="number" min="1" max="10" value={form.anio}
                onChange={e => setF('anio', e.target.value)} placeholder="1" className={inp} />
            </div>
            <div>
              <label className={lbl}>Cuatrimestre</label>
              <input type="number" min="1" max="2" value={form.cuatrimestre}
                onChange={e => setF('cuatrimestre', e.target.value)} placeholder="1" className={inp} />
            </div>
            <div>
              <label className={lbl}>Créditos</label>
              <input type="number" min="0" value={form.creditos}
                onChange={e => setF('creditos', e.target.value)} placeholder="4" className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Tipo de Asignatura</label>
              <select value={form.tipoAsignatura} onChange={e => setF('tipoAsignatura', e.target.value)} className={sel}>
                {TIPOS_ASIGNATURA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Bloque de Conocimiento</label>
              <select value={form.bloqueConocimiento} onChange={e => setF('bloqueConocimiento', e.target.value)} className={sel}>
                <option value="">-- Sin bloque --</option>
                {BLOQUES_CONOCIMIENTO.map(b => <option key={b.codigo} value={b.codigo}>{b.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>H/Semana</label>
              <input type="number" min="0" value={form.cargaHorariaSemanal}
                onChange={e => setF('cargaHorariaSemanal', e.target.value)} placeholder="4" className={inp} />
            </div>
            <div>
              <label className={lbl}>H/Total</label>
              <input type="number" min="0" value={form.cargaHorariaTotal}
                onChange={e => setF('cargaHorariaTotal', e.target.value)} placeholder="64" className={inp} />
            </div>
            <div>
              <label className={lbl}>Modalidad</label>
              <select value={form.modalidadDictado} onChange={e => setF('modalidadDictado', e.target.value)} className={sel}>
                <option value="">-- Sin especificar --</option>
                {MODALIDADES_DICTADO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Descripción</label>
            <textarea value={form.descripcion} onChange={e => setF('descripcion', normalizarMayusculas(e.target.value))}
              placeholder="Descripción breve de la asignatura..." rows={2} data-no-uppercase="true" className={`${inp} resize-none`} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={onCerrar}
            className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onGuardar} disabled={guardando}
            className="px-4 py-2 text-xs font-semibold bg-[#0f4c81] text-white rounded-lg hover:bg-[#0d3e6b] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear asignatura'}
          </button>
        </div>
      </div>
    </div>
  );
}
