'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch as apiFetchBase, mensajeErrorHttp } from '@/lib/api';
import { getPermisosPlanEstudio } from '@/lib/permisos-plan-estudios';
import { normalizarMayusculas } from '@/lib/normalizarMayusculas';

// ── Constantes ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const NAV_INTERNA = [
  { label: 'Carreras',                         href: '/plan-estudios/carreras' },
  { label: 'Programas de Asignatura',          href: '/plan-estudios/programas-asignatura' },
  { label: 'Información de Planes de Estudio', href: '/plan-estudios/informacion-planes' },
];

const TIPOS_ASIGNATURA = ['OBLIGATORIA', 'ELECTIVA', 'OPTATIVA'];
const ESTADOS_ASIGNATURA = ['ACTIVO', 'INACTIVO'];
const ESTADOS_PLAN = ['ACTIVO', 'INACTIVO', 'EN_REVISION'];

const MODALIDADES_DICTADO = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'VIRTUAL',    label: 'Virtual' },
  { value: 'HÍBRIDA',    label: 'Híbrida' },
];

const BLOQUES_CONOCIMIENTO = [
  { codigo: 'CB', label: 'CB - Ciencias Básicas' },
  { codigo: 'TB', label: 'TB - Tecnologías Básicas' },
  { codigo: 'TA', label: 'TA - Tecnologías Aplicadas' },
  { codigo: 'CX', label: 'CX - Cs. y Tecn. Complementarias' },
  { codigo: 'EL', label: 'EL - Electivas' },
];

const MATERIA_VACIA = {
  codigo: '', nombre: '', descripcion: '', anio: '',
  cuatrimestre: '', bloqueConocimiento: '', modalidadDictado: '',
  cargaHorariaSemanal: '', cargaHorariaTotal: '', creditos: '',
  tipoAsignatura: 'OBLIGATORIA', estado: 'ACTIVO', observaciones: ''
};
const PLAN_VACIO = { nombre: '', anio: '', version: '', estado: 'ACTIVO' };

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Carrera {
  id: string;
  nombre: string;
  facultad?: { nombre: string };
  _count?: { planes: number };
}

interface Plan {
  id: string;
  nombre: string;
  anio?: number;
  version?: string;
  estado: string;
  carreraId: string;
  _count?: { materias: number };
}

interface Materia {
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
  estado: string;
  observaciones?: string;
  planEstudioId: string;
}

type FormMateria = typeof MATERIA_VACIA;
type FormPlan = typeof PLAN_VACIO;

// ── Iconos ────────────────────────────────────────────────────────────────────

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
const IcPlus = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const IcSearch = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const IcClose = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IcSpinner = () => (
  <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin" />
);
const IcChevron = ({ up }: { up: boolean }) => (
  <svg
    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${up ? '' : 'rotate-180'}`}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

// ── Componente principal ──────────────────────────────────────────────────────

export default function MallaCurricularPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { usuario } = useAuth();
  const permisos = getPermisosPlanEstudio(usuario?.rol?.nombre ?? '');
  const paramPlanId = useRef(searchParams.get('planId'));

  // ── State: datos ─────────────────────────────────────────────────────────
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [carreraId, setCarreraId] = useState('');
  const [planId, setPlanId] = useState('');

  // ── State: carga ─────────────────────────────────────────────────────────
  const [cargandoCarreras, setCargandoCarreras] = useState(true);
  const [cargandoPlanes, setCargandoPlanes] = useState(false);
  const [cargandoMaterias, setCargandoMaterias] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // ── State: errores y UI ───────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [aniosColapsados, setAniosColapsados] = useState<Set<string>>(new Set());

  // ── State: filtros ────────────────────────────────────────────────────────
  const [buscar, setBuscar] = useState('');
  const [filtroAnio, setFiltroAnio] = useState('');
  const [filtroCuatri, setFiltroCuatri] = useState('');
  const [filtroModalidad, setFiltroModalidad] = useState('');
  const [filtroBloque, setFiltroBloque] = useState('');

  // ── State: modales ────────────────────────────────────────────────────────
  const [modalMateriaAbierto, setModalMateriaAbierto] = useState(false);
  const [modalPlanAbierto, setModalPlanAbierto] = useState(false);
  const [materiaEditar, setMateriaEditar] = useState<Materia | null>(null);
  const [formMateria, setFormMateria] = useState<FormMateria>(MATERIA_VACIA);
  const [formPlan, setFormPlan] = useState<FormPlan>(PLAN_VACIO);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!usuario) return;
    fetchCarreras();
  }, [usuario]);

  useEffect(() => {
    if (!usuario || !carreraId) { setPlanes([]); setPlanId(''); return; }
    fetchPlanes(carreraId);
  }, [usuario, carreraId]);

  useEffect(() => {
    if (!usuario || !planId) { setMaterias([]); return; }
    fetchMaterias(planId);
  }, [usuario, planId]);

  // Al cambiar plan, expandir todos los años
  useEffect(() => {
    setAniosColapsados(new Set());
  }, [planId]);

  // ── Handlers de expansión por año ─────────────────────────────────────────
  function toggleAnio(anio: string) {
    setAniosColapsados(prev => {
      const next = new Set(prev);
      if (next.has(anio)) next.delete(anio); else next.add(anio);
      return next;
    });
  }

  // ── API ───────────────────────────────────────────────────────────────────
  async function apiFetch(url: string, opts?: RequestInit) {
    const res = await apiFetchBase(url, opts);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error en la solicitud'));
    return data;
  }

  async function fetchCarreras() {
    setCargandoCarreras(true);
    setError(null);
    try {
      const data = await apiFetch(`${API_URL}/plan-estudios/carreras`);
      const list: Carrera[] = data ?? [];
      setCarreras(list);
      const paramCarreraId = searchParams.get('carreraId');
      if (paramCarreraId && list.some(c => c.id === paramCarreraId)) {
        setCarreraId(paramCarreraId);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargandoCarreras(false);
    }
  }

  async function fetchPlanes(id: string) {
    setCargandoPlanes(true);
    setPlanes([]);
    setPlanId('');
    try {
      const data = await apiFetch(`${API_URL}/plan-estudios?carreraId=${id}`);
      const list: Plan[] = data ?? [];
      setPlanes(list);
      if (paramPlanId.current && list.some(p => p.id === paramPlanId.current)) {
        setPlanId(paramPlanId.current);
        paramPlanId.current = null;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargandoPlanes(false);
    }
  }

  async function fetchMaterias(id: string) {
    setCargandoMaterias(true);
    setMaterias([]);
    try {
      const data = await apiFetch(`${API_URL}/materias?planEstudioId=${id}`);
      setMaterias(data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargandoMaterias(false);
    }
  }

  async function guardarMateria() {
    if (!formMateria.codigo.trim() || !formMateria.nombre.trim()) {
      alert('El código y el nombre son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      let payload: Record<string, unknown>;

      if (materiaEditar) {
        // PATCH: siempre enviar todos los campos; null para limpiar opcionales
        payload = {
          codigo:            formMateria.codigo.trim(),
          nombre:            formMateria.nombre.trim(),
          tipoAsignatura:    formMateria.tipoAsignatura,
          estado:            formMateria.estado,
          descripcion:       formMateria.descripcion.trim() || null,
          bloqueConocimiento: formMateria.bloqueConocimiento || null,
          modalidadDictado:  formMateria.modalidadDictado   || null,
          observaciones:     formMateria.observaciones.trim() || null,
          anio:              formMateria.anio !== ''              ? parseInt(formMateria.anio)              : null,
          cuatrimestre:      formMateria.cuatrimestre !== ''      ? parseInt(formMateria.cuatrimestre)      : null,
          cargaHorariaSemanal: formMateria.cargaHorariaSemanal !== '' ? parseInt(formMateria.cargaHorariaSemanal) : null,
          cargaHorariaTotal:   formMateria.cargaHorariaTotal   !== '' ? parseInt(formMateria.cargaHorariaTotal)   : null,
          creditos:          formMateria.creditos !== ''        ? parseInt(formMateria.creditos)        : 0,
        };
        await apiFetch(`${API_URL}/materias/${materiaEditar.id}`, {
          method: 'PATCH', body: JSON.stringify(payload)
        });
      } else {
        // POST: solo enviar campos con valor
        payload = {
          codigo:         formMateria.codigo.trim(),
          nombre:         formMateria.nombre.trim(),
          planEstudioId:  planId,
          tipoAsignatura: formMateria.tipoAsignatura,
          estado:         formMateria.estado,
        };
        if (formMateria.descripcion.trim())   payload.descripcion       = formMateria.descripcion.trim();
        if (formMateria.anio)                 payload.anio              = parseInt(formMateria.anio);
        if (formMateria.cuatrimestre !== '')  payload.cuatrimestre      = parseInt(formMateria.cuatrimestre);
        if (formMateria.bloqueConocimiento)   payload.bloqueConocimiento = formMateria.bloqueConocimiento;
        if (formMateria.modalidadDictado)     payload.modalidadDictado  = formMateria.modalidadDictado;
        if (formMateria.cargaHorariaSemanal)  payload.cargaHorariaSemanal = parseInt(formMateria.cargaHorariaSemanal);
        if (formMateria.cargaHorariaTotal)    payload.cargaHorariaTotal = parseInt(formMateria.cargaHorariaTotal);
        if (formMateria.creditos)             payload.creditos          = parseInt(formMateria.creditos);
        if (formMateria.observaciones.trim()) payload.observaciones     = formMateria.observaciones.trim();
        await apiFetch(`${API_URL}/materias`, {
          method: 'POST', body: JSON.stringify(payload)
        });
      }

      cerrarModalMateria();
      await fetchMaterias(planId);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function darDeBajaMateria(id: string) {
    if (!window.confirm('¿Confirmar la baja lógica de esta asignatura?')) return;
    try {
      await apiFetch(`${API_URL}/materias/${id}`, { method: 'DELETE' });
      setMaterias(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function guardarPlan() {
    if (!formPlan.nombre.trim() || !carreraId) {
      alert('El nombre del plan y la carrera son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      const payload: Record<string, unknown> = {
        nombre: formPlan.nombre.trim(),
        carreraId,
        estado: formPlan.estado
      };
      if (formPlan.anio) payload.anio = parseInt(formPlan.anio);
      if (formPlan.version) payload.version = formPlan.version.trim();

      const nuevoPlan = await apiFetch(`${API_URL}/plan-estudios`, {
        method: 'POST', body: JSON.stringify(payload)
      });
      setModalPlanAbierto(false);
      setFormPlan(PLAN_VACIO);
      const planesActualizados = await apiFetch(`${API_URL}/plan-estudios?carreraId=${carreraId}`);
      setPlanes(planesActualizados ?? []);
      if (nuevoPlan?.id) setPlanId(nuevoPlan.id);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  // ── Handlers modal ────────────────────────────────────────────────────────

  function abrirCrearMateria() {
    setFormMateria(MATERIA_VACIA);
    setMateriaEditar(null);
    setModalMateriaAbierto(true);
  }

  function abrirEditarMateria(m: Materia) {
    setFormMateria({
      codigo: m.codigo, nombre: m.nombre, descripcion: m.descripcion ?? '',
      anio: m.anio?.toString() ?? '', cuatrimestre: m.cuatrimestre?.toString() ?? '',
      bloqueConocimiento: m.bloqueConocimiento ?? '',
      modalidadDictado: m.modalidadDictado ?? '',
      cargaHorariaSemanal: m.cargaHorariaSemanal?.toString() ?? '',
      cargaHorariaTotal: m.cargaHorariaTotal?.toString() ?? '',
      creditos: m.creditos?.toString() ?? '',
      tipoAsignatura: m.tipoAsignatura || 'OBLIGATORIA',
      estado: m.estado, observaciones: m.observaciones ?? ''
    });
    setMateriaEditar(m);
    setModalMateriaAbierto(true);
  }

  function cerrarModalMateria() {
    setModalMateriaAbierto(false);
    setMateriaEditar(null);
    setFormMateria(MATERIA_VACIA);
  }

  function setField(field: keyof FormMateria, val: string) {
    setFormMateria(prev => ({ ...prev, [field]: val }));
  }

  function setFieldPlan(field: keyof FormPlan, val: string) {
    setFormPlan(prev => ({ ...prev, [field]: val }));
  }

  // ── Filtrado y agrupación ─────────────────────────────────────────────────

  const materiasFiltradas = useMemo(() => {
    const texto = buscar.toLowerCase().trim();
    return materias.filter(m => {
      if (texto && !m.nombre.toLowerCase().includes(texto) && !m.codigo.toLowerCase().includes(texto)) return false;
      if (filtroAnio && m.anio?.toString() !== filtroAnio) return false;
      if (filtroCuatri && (m.cuatrimestre ?? -1).toString() !== filtroCuatri) return false;
      if (filtroModalidad && m.modalidadDictado !== filtroModalidad) return false;
      if (filtroBloque && m.bloqueConocimiento !== filtroBloque) return false;
      return true;
    });
  }, [materias, buscar, filtroAnio, filtroCuatri, filtroModalidad, filtroBloque]);

  const mallaPorAnio = useMemo(() => {
    const grouped: Record<string, Record<string, Materia[]>> = {};
    for (const m of materiasFiltradas) {
      const anio = m.anio?.toString() ?? '0';
      const cuatri = m.cuatrimestre == null ? 'sin'
                   : m.cuatrimestre === 0   ? 'anual'
                   : m.cuatrimestre.toString();
      if (!grouped[anio]) grouped[anio] = {};
      if (!grouped[anio][cuatri]) grouped[anio][cuatri] = [];
      grouped[anio][cuatri].push(m);
    }
    return grouped;
  }, [materiasFiltradas]);

  const aniosOrdenados = Object.keys(mallaPorAnio).sort((a, b) => {
    if (a === '0') return 1;
    if (b === '0') return -1;
    return parseInt(a) - parseInt(b);
  });

  const planSeleccionado = planes.find(p => p.id === planId);

  function colorTipo(tipo: string) {
    if (tipo === 'ELECTIVA') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (tipo === 'OPTATIVA') return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  }

  function labelModalidad(val?: string) {
    return MODALIDADES_DICTADO.find(m => m.value === val)?.label ?? null;
  }

  function colorModalidad(val?: string) {
    if (val === 'VIRTUAL') return 'bg-sky-50 text-sky-700 border-sky-200';
    if (val === 'HÍBRIDA') return 'bg-teal-50 text-teal-700 border-teal-200';
    return 'bg-green-50 text-green-700 border-green-200';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <a href="/plan-estudios" className="hover:text-slate-600 transition-colors">Plan de Estudios</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Malla Curricular</span>
      </nav>

      {/* Encabezado */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Plan de Estudios</p>
        <h1 className="text-xl font-bold text-slate-800">Malla Curricular</h1>
        <p className="mt-1 text-sm text-slate-500">Asignaturas del plan organizadas por año y cuatrimestre.</p>
      </div>

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

      {/* Selector de Carrera y Plan */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">

          <div className="flex-1 min-w-0">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Carrera</label>
            {cargandoCarreras ? (
              <div className="flex items-center gap-2 h-9"><IcSpinner /><span className="text-xs text-slate-400">Cargando...</span></div>
            ) : (
              <select
                value={carreraId}
                onChange={e => { setCarreraId(e.target.value); setError(null); }}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
              >
                <option value="">-- Seleccionar carrera --</option>
                {carreras.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}{c._count ? ` (${c._count.planes} planes)` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Plan de Estudio</label>
            {cargandoPlanes ? (
              <div className="flex items-center gap-2 h-9"><IcSpinner /><span className="text-xs text-slate-400">Cargando...</span></div>
            ) : (
              <select
                value={planId}
                onChange={e => { setPlanId(e.target.value); setError(null); }}
                disabled={!carreraId}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <option value="">-- Seleccionar plan --</option>
                {planes.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}{p.anio ? ` (${p.anio})` : ''}{p.version ? ` v${p.version}` : ''} · {p.estado}
                  </option>
                ))}
              </select>
            )}
          </div>

          {permisos.crear && carreraId && (
            <button
              onClick={() => { setFormPlan(PLAN_VACIO); setModalPlanAbierto(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#0f4c81] text-[#0f4c81] text-xs font-semibold hover:bg-[#0f4c81]/5 transition-colors whitespace-nowrap"
            >
              <IcPlus />
              Nuevo Plan
            </button>
          )}
        </div>

        {planSeleccionado && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
            <span>
              <strong className="text-slate-700">{planSeleccionado.nombre}</strong>
              {planSeleccionado.anio && ` · ${planSeleccionado.anio}`}
              {planSeleccionado.version && ` · v${planSeleccionado.version}`}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
              planSeleccionado.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : planSeleccionado.estado === 'EN_REVISION' ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {planSeleccionado.estado.replace('_', ' ')}
            </span>
            <span className="text-slate-400">
              {materias.length} asignatura{materias.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Contenido principal */}
      {planId && (
        <>
          {/* Barra de filtros y acciones */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IcSearch /></div>
              <input
                value={buscar}
                onChange={e => setBuscar(e.target.value)}
                placeholder="Buscar por código o nombre..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
              />
            </div>
            <select
              value={filtroAnio}
              onChange={e => setFiltroAnio(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
            >
              <option value="">Todos los años</option>
              {[1,2,3,4,5].map(a => <option key={a} value={a}>{a}° Año</option>)}
            </select>
            <select
              value={filtroCuatri}
              onChange={e => setFiltroCuatri(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
            >
              <option value="">Todas las duraciones</option>
              <option value="1">1° Cuatrimestre</option>
              <option value="2">2° Cuatrimestre</option>
              <option value="0">Anual</option>
            </select>
            <select
              value={filtroModalidad}
              onChange={e => setFiltroModalidad(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
            >
              <option value="">Todas las modalidades</option>
              {MODALIDADES_DICTADO.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              value={filtroBloque}
              onChange={e => setFiltroBloque(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
            >
              <option value="">Todos los bloques</option>
              {BLOQUES_CONOCIMIENTO.map(b => (
                <option key={b.codigo} value={b.label}>{b.label}</option>
              ))}
            </select>
            {permisos.editar && (
              <button
                onClick={abrirCrearMateria}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0f4c81] text-white text-xs font-semibold hover:bg-[#0d3e6b] transition-colors whitespace-nowrap"
              >
                <IcPlus />
                Nueva Asignatura
              </button>
            )}
          </div>

          {(buscar || filtroAnio || filtroCuatri || filtroModalidad || filtroBloque) && (
            <p className="text-xs text-slate-400 mb-3">
              {materiasFiltradas.length} resultado{materiasFiltradas.length !== 1 ? 's' : ''} de {materias.length} asignaturas
            </p>
          )}

          {/* Malla: tabla expandible por año */}
          {cargandoMaterias ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex items-center justify-center gap-3">
              <IcSpinner />
              <span className="text-sm text-slate-500">Cargando asignaturas...</span>
            </div>
          ) : materiasFiltradas.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
              <p className="text-sm font-medium text-slate-600 mb-1">
                {materias.length === 0 ? 'Este plan no tiene asignaturas todavía' : 'Sin resultados para los filtros aplicados'}
              </p>
              <p className="text-xs text-slate-400">
                {materias.length === 0 && permisos.editar ? 'Usá el botón "Nueva Asignatura" para comenzar a cargar la malla.' : ''}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {aniosOrdenados.map(anio => {
                const isExpanded = !aniosColapsados.has(anio);
                const totalAnio = Object.values(mallaPorAnio[anio]).flat().length;

                const grupo = mallaPorAnio[anio];
                const byNombre = (a: Materia, b: Materia) => a.nombre.localeCompare(b.nombre);
                const matC1  = [...(grupo['1'] ?? []), ...(grupo['anual'] ?? [])].sort(byNombre);
                const matC2  = [...(grupo['2'] ?? []), ...(grupo['anual'] ?? [])].sort(byNombre);
                const matSin = (grupo['sin'] ?? []).sort(byNombre);
                const conCuatrimestre = matC1.length > 0 || matC2.length > 0;

                return (
                  <div key={anio} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

                    {/* Header de año: clickable */}
                    <button
                      onClick={() => toggleAnio(anio)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#0f4c81] flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">{anio === '0' ? '?' : anio}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-700">
                        {anio === '0' ? 'Sin año asignado' : `${anio}° Año`}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {totalAnio} asignatura{totalAnio !== 1 ? 's' : ''}
                      </span>
                      <div className="flex-1" />
                      <IcChevron up={isExpanded} />
                    </button>

                    {/* Tabla de asignaturas */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 overflow-x-auto">
                        <table className="w-full text-xs min-w-[560px]">
                          <thead>
                            <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide w-28">Código</th>
                              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Asignatura</th>
                              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide w-24">Duración</th>
                              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Modalidad</th>
                              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Bloque</th>
                              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide w-28">Tipo</th>
                              <th className="text-right px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide w-14 hidden sm:table-cell">H/S</th>
                              <th className="text-right px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide w-14 hidden sm:table-cell">H/T</th>
                              <th className="text-right px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide w-14">Cr.</th>
                              <th className="px-4 py-2.5 w-44"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {conCuatrimestre ? (
                              <>
                                {matC1.length > 0 && (
                                  <>
                                    <tr className="bg-[#0f4c81]/4 border-y border-[#0f4c81]/10">
                                      <td colSpan={10} className="px-4 py-1.5 text-[10px] font-bold text-[#0f4c81] uppercase tracking-wider">
                                        1° Cuatrimestre
                                      </td>
                                    </tr>
                                    {matC1.map(m => (
                                      <MateriaRow key={`${m.id}-c1`} materia={m} permisos={permisos} colorTipo={colorTipo} labelModalidad={labelModalidad} colorModalidad={colorModalidad} onEditar={() => abrirEditarMateria(m)} onBaja={() => darDeBajaMateria(m.id)} />
                                    ))}
                                  </>
                                )}
                                {matC2.length > 0 && (
                                  <>
                                    <tr className="bg-[#0f4c81]/4 border-y border-[#0f4c81]/10">
                                      <td colSpan={10} className="px-4 py-1.5 text-[10px] font-bold text-[#0f4c81] uppercase tracking-wider">
                                        2° Cuatrimestre
                                      </td>
                                    </tr>
                                    {matC2.map(m => (
                                      <MateriaRow key={`${m.id}-c2`} materia={m} permisos={permisos} colorTipo={colorTipo} labelModalidad={labelModalidad} colorModalidad={colorModalidad} onEditar={() => abrirEditarMateria(m)} onBaja={() => darDeBajaMateria(m.id)} />
                                    ))}
                                  </>
                                )}
                                {matSin.length > 0 && (
                                  <>
                                    <tr className="bg-slate-50/80 border-y border-slate-100">
                                      <td colSpan={10} className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        Sin duración asignada
                                      </td>
                                    </tr>
                                    {matSin.map(m => (
                                      <MateriaRow key={m.id} materia={m} permisos={permisos} colorTipo={colorTipo} labelModalidad={labelModalidad} colorModalidad={colorModalidad} onEditar={() => abrirEditarMateria(m)} onBaja={() => darDeBajaMateria(m.id)} />
                                    ))}
                                  </>
                                )}
                              </>
                            ) : (
                              matSin.map(m => (
                                <MateriaRow key={m.id} materia={m} permisos={permisos} colorTipo={colorTipo} labelModalidad={labelModalidad} colorModalidad={colorModalidad} onEditar={() => abrirEditarMateria(m)} onBaja={() => darDeBajaMateria(m.id)} />
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Estado vacío: sin plan seleccionado */}
      {!planId && !cargandoCarreras && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#0f4c81]/8 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-[#0f4c81]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </div>
          {carreras.length === 0 ? (
            <>
              <p className="text-sm font-medium text-slate-700 mb-1">No hay datos cargados en Plan de Estudios</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                La base de datos no tiene carreras, planes ni asignaturas aún. Para comenzar, ejecutá el seed:
              </p>
              <code className="inline-block bg-slate-100 text-slate-700 text-xs px-4 py-2 rounded-lg font-mono mb-3">
                npx prisma db seed
              </code>
              <p className="text-[11px] text-slate-400">Ejecutar desde la carpeta <span className="font-mono">backend/</span></p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600 mb-1">
                {!carreraId ? 'Seleccioná una carrera para comenzar' : 'Seleccioná un plan de estudio'}
              </p>
              <p className="text-xs text-slate-400">
                {!carreraId
                  ? 'La malla curricular se organiza por carrera y plan de estudio.'
                  : planes.length === 0
                  ? permisos.crear ? 'Esta carrera no tiene planes. Podés crear uno con el botón "Nuevo Plan".' : 'Esta carrera no tiene planes de estudio cargados.'
                  : 'Elegí un plan para visualizar y gestionar sus asignaturas.'}
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Modal: Asignatura ─────────────────────────────────────────────── */}
      {modalMateriaAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                {materiaEditar ? 'Editar Asignatura' : 'Nueva Asignatura'}
              </h3>
              <button onClick={cerrarModalMateria} className="text-slate-400 hover:text-slate-600 transition-colors">
                <IcClose />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Código <span className="text-red-500">*</span></label>
                  <input value={formMateria.codigo} onChange={e => setField('codigo', e.target.value)}
                    placeholder="Ej: MAT-101" data-no-uppercase="true"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] font-mono" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Nombre <span className="text-red-500">*</span></label>
                  <input value={formMateria.nombre} onChange={e => setField('nombre', normalizarMayusculas(e.target.value))}
                    placeholder="Nombre de la asignatura" data-no-uppercase="true"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Año</label>
                  <select value={formMateria.anio} onChange={e => setField('anio', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
                    <option value="">-- Año --</option>
                    {[1,2,3,4,5].map(a => <option key={a} value={a}>{a}° Año</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Duración</label>
                  <select value={formMateria.cuatrimestre} onChange={e => setField('cuatrimestre', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
                    <option value="">-- Duración --</option>
                    <option value="1">1° Cuatrimestre</option>
                    <option value="2">2° Cuatrimestre</option>
                    <option value="0">Anual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Tipo de Asignatura</label>
                  <select value={formMateria.tipoAsignatura} onChange={e => setField('tipoAsignatura', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
                    {TIPOS_ASIGNATURA.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Modalidad de Dictado</label>
                  <select value={formMateria.modalidadDictado} onChange={e => setField('modalidadDictado', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
                    <option value="">-- Sin asignar --</option>
                    {MODALIDADES_DICTADO.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Bloque de Conocimiento</label>
                  <select value={formMateria.bloqueConocimiento} onChange={e => setField('bloqueConocimiento', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
                    <option value="">-- Sin asignar --</option>
                    {BLOQUES_CONOCIMIENTO.map(b => (
                      <option key={b.codigo} value={b.label}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div></div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Hs/Semana</label>
                  <input type="number" min="0" value={formMateria.cargaHorariaSemanal} onChange={e => setField('cargaHorariaSemanal', e.target.value)}
                    placeholder="0" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Hs Totales</label>
                  <input type="number" min="0" value={formMateria.cargaHorariaTotal} onChange={e => setField('cargaHorariaTotal', e.target.value)}
                    placeholder="0" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Créditos</label>
                  <input type="number" min="0" value={formMateria.creditos} onChange={e => setField('creditos', e.target.value)}
                    placeholder="0" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Estado</label>
                <select value={formMateria.estado} onChange={e => setField('estado', e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
                  {ESTADOS_ASIGNATURA.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Observaciones</label>
                <textarea value={formMateria.observaciones} onChange={e => setField('observaciones', normalizarMayusculas(e.target.value))}
                  rows={2} placeholder="Notas adicionales..." data-no-uppercase="true"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={cerrarModalMateria}
                className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={guardarMateria} disabled={guardando}
                className="px-4 py-2 text-xs font-semibold bg-[#0f4c81] text-white rounded-lg hover:bg-[#0d3e6b] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {guardando ? 'Guardando...' : materiaEditar ? 'Guardar cambios' : 'Crear asignatura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nuevo Plan ─────────────────────────────────────────────── */}
      {modalPlanAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Nuevo Plan de Estudio</h3>
              <button onClick={() => setModalPlanAbierto(false)} className="text-slate-400 hover:text-slate-600"><IcClose /></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Nombre del Plan <span className="text-red-500">*</span></label>
                <input value={formPlan.nombre} onChange={e => setFieldPlan('nombre', normalizarMayusculas(e.target.value))}
                  placeholder="Ej: Plan de Estudios 2024" data-no-uppercase="true"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Año</label>
                  <input type="number" value={formPlan.anio} onChange={e => setFieldPlan('anio', e.target.value)}
                    placeholder={new Date().getFullYear().toString()}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Versión</label>
                  <input value={formPlan.version} onChange={e => setFieldPlan('version', e.target.value)}
                    placeholder="Ej: 1.0" data-no-uppercase="true"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Estado</label>
                <select value={formPlan.estado} onChange={e => setFieldPlan('estado', e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
                  {ESTADOS_PLAN.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
                </select>
              </div>
              <p className="text-[11px] text-slate-400">
                Carrera: <strong className="text-slate-600">{carreras.find(c => c.id === carreraId)?.nombre}</strong>
              </p>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => { setModalPlanAbierto(false); setFormPlan(PLAN_VACIO); }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={guardarPlan} disabled={guardando}
                className="px-4 py-2 text-xs font-semibold bg-[#0f4c81] text-white rounded-lg hover:bg-[#0d3e6b] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {guardando ? 'Creando...' : 'Crear Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componente: Fila de materia en tabla ──────────────────────────────────

function MateriaRow({
  materia: m,
  permisos,
  colorTipo,
  labelModalidad,
  colorModalidad,
  onEditar,
  onBaja
}: {
  materia: Materia;
  permisos: ReturnType<typeof getPermisosPlanEstudio>;
  colorTipo: (t: string) => string;
  labelModalidad: (v?: string) => string | null;
  colorModalidad: (v?: string) => string;
  onEditar: () => void;
  onBaja: () => void;
}) {
  const modLabel = labelModalidad(m.modalidadDictado);
  return (
    <tr className="hover:bg-slate-50/60 transition-colors group">
      <td className="px-4 py-2.5">
        <span className="text-[11px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/10 whitespace-nowrap">
          {m.codigo}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <p className="text-xs font-semibold text-slate-800 leading-tight">{m.nombre}</p>
        {m.observaciones && (
          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{m.observaciones}</p>
        )}
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
        {m.cuatrimestre === 0
          ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">Anual</span>
          : m.cuatrimestre
          ? `${m.cuatrimestre}°`
          : '—'}
      </td>
      <td className="px-4 py-2.5 hidden lg:table-cell">
        {modLabel
          ? <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap ${colorModalidad(m.modalidadDictado)}`}>{modLabel}</span>
          : <span className="text-xs text-slate-400">—</span>}
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-500 hidden md:table-cell">
        {m.bloqueConocimiento ?? '—'}
      </td>
      <td className="px-4 py-2.5">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${colorTipo(m.tipoAsignatura)}`}>
          {m.tipoAsignatura}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right text-xs text-slate-600 hidden sm:table-cell">
        {m.cargaHorariaSemanal ?? '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-xs text-slate-600 hidden sm:table-cell">
        {m.cargaHorariaTotal ?? '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-xs font-medium text-slate-700">
        {m.creditos > 0 ? m.creditos : '—'}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/plan-estudios/ficha-asignatura?id=${m.id}`}
            className="flex items-center gap-1 text-[11px] font-semibold bg-[#0f4c81] text-white hover:bg-[#0d3d6b] px-2.5 py-1 rounded transition-colors whitespace-nowrap"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Ficha
          </Link>
          {permisos.editar && (
            <button
              onClick={onEditar}
              className="flex items-center gap-1 text-[11px] text-[#0f4c81] hover:bg-[#0f4c81]/5 px-2 py-1 rounded transition-colors whitespace-nowrap"
            >
              <IcEdit />
              Editar
            </button>
          )}
          {permisos.eliminar && m.estado === 'ACTIVO' && (
            <button
              onClick={onBaja}
              className="flex items-center gap-1 text-[11px] text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors whitespace-nowrap"
            >
              <IcBaja />
              Baja
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
