'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch, mensajeErrorHttp } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoriaId =
  | 'catedras'
  | 'cargos'
  | 'designaciones'
  | 'modalidades'
  | 'areas-disciplinares'
  | 'subareas'
  | 'tipos-posgrado';

type SortCol = 'nombre' | 'estado' | 'fecha';

interface Item {
  id: string;
  nombre: string;
  activo: boolean;
  fechaCreacion: string;
  fechaActualizacion?: string;
  areaDisciplinarId?: string;
  areaDisciplinar?: { id: string; nombre: string };
}

interface AreaSimple { id: string; nombre: string; }

interface ModalState {
  abierto: boolean;
  id: string | null;
  nombre: string;
  areaDisciplinarId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API       = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const PAGE_SIZE = 15;

const CATEGORIAS: {
  id:          CategoriaId;
  label:       string;
  descripcion: string;
  esSubarea:   boolean;
}[] = [
  { id: 'catedras',            label: 'Cátedras',            descripcion: 'Valores de cátedra asignados a los docentes.',                             esSubarea: false },
  { id: 'cargos',              label: 'Cargos',              descripcion: 'Tipos de cargo docente (Titular, Adjunto, JTP, Ayudante, etc.).',           esSubarea: false },
  { id: 'designaciones',       label: 'Designaciones',       descripcion: 'Tipos de designación (Regular rentado, Interino, Contratado, etc.).',       esSubarea: false },
  { id: 'modalidades',         label: 'Modalidades',         descripcion: 'Modalidades de cursado (Cuatrimestral, Semestral, Anual, etc.).',           esSubarea: false },
  { id: 'areas-disciplinares', label: 'Áreas Disciplinares',              descripcion: 'Áreas de clasificación disciplinar de docentes por campo de conocimiento.', esSubarea: false },
  { id: 'subareas',            label: 'Subáreas',                         descripcion: 'Subáreas disciplinares vinculadas a un Área Disciplinar.',                  esSubarea: true  },
  { id: 'tipos-posgrado',      label: 'Tipos de Posgrado',                descripcion: 'Tipos de títulos de posgrado (Especialización, Maestría, Doctorado, etc.).', esSubarea: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IcCatedras   = () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>;
const IcCargos     = () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>;
const IcDesig      = () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>;
const IcMod        = () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>;
const IcAreas      = () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>;
const IcSubareas   = () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>;
const IcPosgrado   = () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>;
const IcPlus       = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>;
const IcEdit       = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
const IcTrash      = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
const IcSearch     = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>;
const IcSpinner    = () => <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-[#0f4c81] animate-spin flex-shrink-0"/>;
const IcCheck      = () => <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>;
const IcSortAsc    = () => <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>;
const IcSortDesc   = () => <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>;
const IcActivar    = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const IcDesactivar = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const IcEmpty      = () => <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>;

const CAT_ICONS: Record<CategoriaId, React.ReactNode> = {
  catedras:              <IcCatedras />,
  cargos:                <IcCargos />,
  designaciones:         <IcDesig />,
  modalidades:           <IcMod />,
  'areas-disciplinares': <IcAreas />,
  subareas:              <IcSubareas />,
  'tipos-posgrado':      <IcPosgrado />,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TablasMaestrasPage() {
  // Category
  const [categoria,    setCategoria]    = useState<CategoriaId>('catedras');
  const catInfo = CATEGORIAS.find(c => c.id === categoria)!;

  // Table
  const [items,        setItems]        = useState<Item[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [buscar,       setBuscar]       = useState('');
  const [filtroActivo, setFiltroActivo] = useState('');
  const [filtroArea,   setFiltroArea]   = useState('');
  const [sortCol,      setSortCol]      = useState<SortCol>('nombre');
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('asc');
  const [page,         setPage]         = useState(1);
  const [exito,        setExito]        = useState<string | null>(null);

  // Areas for subarea select
  const [areasActivas, setAreasActivas] = useState<AreaSimple[]>([]);

  // Modal
  const [modal,      setModal]      = useState<ModalState>({ abierto: false, id: null, nombre: '', areaDisciplinarId: '' });
  const [modalKey,   setModalKey]   = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  async function cargar() {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (buscar.trim()) params.set('buscar', buscar.trim());
      if (filtroActivo)  params.set('activo', filtroActivo);
      let url: string;
      if (categoria === 'subareas') {
        if (filtroArea) params.set('areaDisciplinarId', filtroArea);
        url = `${API}/configuracion/subareas?${params}`;
      } else {
        url = `${API}/configuracion/tablas-maestras/${categoria}?${params}`;
      }
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(mensajeErrorHttp(res, null, 'Error al cargar los datos'));
      setItems(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function cargarAreasActivas() {
    try {
      const res = await apiFetch(`${API}/configuracion/tablas-maestras/areas-disciplinares/activos`);
      if (res.ok) setAreasActivas(await res.json());
    } catch {}
  }

  // ── Effects ────────────────────────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); cargar(); }, [categoria, buscar, filtroActivo, filtroArea]);

  useEffect(() => {
    if (modal.abierto) setTimeout(() => inputRef.current?.focus(), 80);
  }, [modal.abierto]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function cambiarCategoria(cat: CategoriaId) {
    if (cat === categoria) return;
    setCategoria(cat);
    setBuscar('');
    setFiltroActivo('');
    setFiltroArea('');
    setSortCol('nombre');
    setSortDir('asc');
    setPage(1);
    if (cat === 'subareas') cargarAreasActivas();
  }

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  }

  function abrirCrear() {
    if (categoria === 'subareas' && areasActivas.length === 0) cargarAreasActivas();
    setModal({ abierto: true, id: null, nombre: '', areaDisciplinarId: '' });
    setModalKey(k => k + 1);
    setModalError(null);
  }

  function abrirEditar(item: Item) {
    if (categoria === 'subareas' && areasActivas.length === 0) cargarAreasActivas();
    setModal({ abierto: true, id: item.id, nombre: item.nombre, areaDisciplinarId: item.areaDisciplinarId ?? '' });
    setModalKey(k => k + 1);
    setModalError(null);
  }

  function cerrarModal() {
    setModal({ abierto: false, id: null, nombre: '', areaDisciplinarId: '' });
    setModalError(null);
  }

  async function guardar() {
    const nombre = (inputRef.current?.value ?? '').trim();
    if (!nombre) { setModalError('El nombre es obligatorio'); return; }
    if (categoria === 'subareas' && !modal.areaDisciplinarId) {
      setModalError('El área disciplinar es obligatoria');
      return;
    }
    setSubmitting(true); setModalError(null);
    try {
      const body: Record<string, string> = { nombre };
      if (categoria === 'subareas') body.areaDisciplinarId = modal.areaDisciplinarId;
      const base = categoria === 'subareas'
        ? `${API}/configuracion/subareas`
        : `${API}/configuracion/tablas-maestras/${categoria}`;
      const url = modal.id ? `${base}/${modal.id}` : base;
      const res = await apiFetch(url, {
        method: modal.id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al guardar'));
      cerrarModal();
      flash(modal.id ? 'Registro actualizado' : 'Registro creado');
      cargar();
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(item: Item) {
    if (item.activo) {
      if (!confirm(`¿Desactivar "${item.nombre}"?\nNo aparecerá en nuevos formularios pero se conservará en registros existentes.`)) return;
    }
    try {
      const base = categoria === 'subareas'
        ? `${API}/configuracion/subareas`
        : `${API}/configuracion/tablas-maestras/${categoria}`;
      const res = await apiFetch(`${base}/${item.id}/toggle`, { method: 'PATCH' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al cambiar estado'));
      flash(item.activo ? 'Registro desactivado' : 'Registro activado');
      cargar();
    } catch (e) { alert((e as Error).message); }
  }

  async function eliminar(item: Item) {
    if (!confirm(`¿Eliminar "${item.nombre}"?\nEsta acción no se puede deshacer.`)) return;
    try {
      const base = categoria === 'subareas'
        ? `${API}/configuracion/subareas`
        : `${API}/configuracion/tablas-maestras/${categoria}`;
      const res = await apiFetch(`${base}/${item.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al eliminar'));
      flash('Registro eliminado');
      cargar();
    } catch (e) { alert((e as Error).message); }
  }

  function flash(msg: string) {
    setExito(msg);
    setTimeout(() => setExito(null), 3000);
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const sorted = [...items].sort((a, b) => {
    let cmp = 0;
    if (sortCol === 'nombre') cmp = a.nombre.localeCompare(b.nombre, 'es');
    if (sortCol === 'estado') cmp = (a.activo === b.activo ? 0 : a.activo ? -1 : 1);
    if (sortCol === 'fecha')  cmp = new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime();
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activos    = items.filter(i => i.activo).length;
  const esSubarea  = categoria === 'subareas';
  const colSpan    = esSubarea ? 6 : 5;
  const tieneFiltr = !!(buscar || filtroActivo || filtroArea);

  // ── Sort th helper (plain function, not a component) ───────────────────────

  function sortTh(col: SortCol, label: string, extraCls = '') {
    const active = sortCol === col;
    return (
      <th
        onClick={() => toggleSort(col)}
        className={`text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer select-none whitespace-nowrap hover:text-[#0f4c81] transition-colors ${extraCls}`}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className={active ? 'text-[#0f4c81]' : 'text-slate-300'}>
            {active && sortDir === 'asc' ? <IcSortAsc /> : <IcSortDesc />}
          </span>
        </span>
      </th>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 sm:p-7 flex flex-col gap-5">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Configuración</p>
        <h1 className="text-lg font-bold text-slate-800">Tablas Maestras</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Valores parametrizables del sistema. Los cambios afectan los selectores de todos los módulos.
        </p>
      </div>

      {/* ── Layout: sidebar + content ─────────────────────────────────────── */}
      <div className="flex gap-5 items-start">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-48 flex-shrink-0">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/70">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Categorías</p>
            </div>
            <nav className="py-1.5">
              {CATEGORIAS.map(cat => {
                const active = cat.id === categoria;
                return (
                  <button
                    key={cat.id}
                    onClick={() => cambiarCategoria(cat.id)}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[13px] transition-colors border-l-2 ${
                      active
                        ? 'bg-blue-50 text-[#0f4c81] font-semibold border-[#0f4c81]'
                        : 'text-slate-600 hover:bg-slate-50/80 border-transparent font-medium'
                    }`}
                  >
                    <span className={active ? 'text-[#0f4c81]' : 'text-slate-400'}>
                      {CAT_ICONS[cat.id]}
                    </span>
                    {cat.label}
                  </button>
                );
              })}
            </nav>
            <div className="px-3.5 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Valores <strong className="font-semibold text-slate-500">inactivos</strong> se preservan en historial pero no aparecen en nuevos formularios.
              </p>
            </div>
          </div>
        </aside>

        {/* ── Content column ───────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Mobile pill tabs */}
          <div className="lg:hidden flex gap-2 overflow-x-auto -mx-5 px-5 sm:-mx-7 sm:px-7 pb-1">
            {CATEGORIAS.map(cat => (
              <button
                key={cat.id}
                onClick={() => cambiarCategoria(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
                  cat.id === categoria
                    ? 'bg-[#0f4c81] text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {CAT_ICONS[cat.id]}
                {cat.label}
              </button>
            ))}
          </div>

          {/* Section header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-bold text-slate-800">{catInfo.label}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{catInfo.descripcion}</p>
            </div>
            <button
              onClick={abrirCrear}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#0f4c81] text-white text-sm font-semibold rounded-lg hover:bg-[#0d3e6b] transition-colors flex-shrink-0 shadow-sm"
            >
              <IcPlus />
              Nuevo registro
            </button>
          </div>

          {/* Toast */}
          {exito && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-2.5 rounded-lg">
              <IcCheck />{exito}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><IcSearch /></span>
              <input
                value={buscar}
                onChange={e => setBuscar(e.target.value)}
                placeholder={`Buscar en ${catInfo.label.toLowerCase()}...`}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/10 transition"
              />
            </div>
            {esSubarea && (
              <select
                value={filtroArea}
                onChange={e => setFiltroArea(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/10 transition min-w-[180px]"
              >
                <option value="">Todas las áreas</option>
                {areasActivas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            )}
            <select
              value={filtroActivo}
              onChange={e => setFiltroActivo(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/10 transition min-w-[150px]"
            >
              <option value="">Todos los estados</option>
              <option value="true">Solo activos</option>
              <option value="false">Solo inactivos</option>
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                    {sortTh('nombre', 'Nombre', 'pl-5')}
                    {esSubarea && (
                      <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">
                        Área Disciplinar
                      </th>
                    )}
                    {sortTh('estado', 'Estado', 'w-28')}
                    {sortTh('fecha', 'Creación', 'w-32')}
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap w-32">
                      Actualización
                    </th>
                    <th className="px-4 py-2.5 w-28"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={colSpan} className="px-5 py-10 text-center">
                        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                          <IcSpinner />Cargando...
                        </div>
                      </td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={colSpan} className="px-5 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <IcEmpty />
                          {tieneFiltr ? (
                            <>
                              <p className="text-sm font-semibold text-slate-600 mt-1">No se encontraron registros</p>
                              <p className="text-xs text-slate-400">Cambiá los filtros para ver más resultados.</p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-slate-600 mt-1">Sin registros</p>
                              <p className="text-xs text-slate-400 mb-2">No hay valores cargados para {catInfo.label.toLowerCase()}.</p>
                              <button
                                onClick={abrirCrear}
                                className="flex items-center gap-2 px-3.5 py-2 bg-[#0f4c81] text-white text-xs font-semibold rounded-lg hover:bg-[#0d3e6b] transition-colors"
                              >
                                <IcPlus />
                                Crear primer registro
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : paginated.map(item => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/60 transition-colors ${!item.activo ? 'opacity-55' : ''}`}
                    >
                      <td className="px-5 py-2.5 font-medium text-slate-800">{item.nombre}</td>
                      {esSubarea && (
                        <td className="px-4 py-2.5">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
                            {item.areaDisciplinar?.nombre ?? '—'}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        {item.activo
                          ? <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Activo</span>
                          : <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Inactivo</span>
                        }
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-500 tabular-nums whitespace-nowrap">{fmt(item.fechaCreacion)}</td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-500 tabular-nums whitespace-nowrap">{fmt(item.fechaActualizacion)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => abrirEditar(item)}
                            title="Editar"
                            className="p-1.5 rounded-md text-slate-400 hover:text-[#0f4c81] hover:bg-[#0f4c81]/8 transition-colors"
                          >
                            <IcEdit />
                          </button>
                          <button
                            onClick={() => toggle(item)}
                            title={item.activo ? 'Desactivar' : 'Activar'}
                            className={`p-1.5 rounded-md transition-colors ${
                              item.activo
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {item.activo ? <IcDesactivar /> : <IcActivar />}
                          </button>
                          <button
                            onClick={() => eliminar(item)}
                            title="Eliminar"
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <IcTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer: counter + pagination */}
            {!loading && sorted.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-slate-400">
                  {sorted.length} registro{sorted.length !== 1 ? 's' : ''} ·{' '}
                  {activos} activo{activos !== 1 ? 's' : ''}
                  {totalPages > 1 && ` · Página ${page} de ${totalPages}`}
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-2.5 py-1 text-[11px] font-medium border border-slate-200 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      ‹ Anterior
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = totalPages <= 5
                        ? i + 1
                        : page <= 3
                          ? i + 1
                          : page >= totalPages - 2
                            ? totalPages - 4 + i
                            : page - 2 + i;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-7 h-7 text-[11px] font-medium rounded-md transition-colors ${
                            p === page
                              ? 'bg-[#0f4c81] text-white shadow-sm'
                              : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-2.5 py-1 text-[11px] font-medium border border-slate-200 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Siguiente ›
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────────── */}
      {modal.abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] p-4"
          onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">
                {modal.id ? `Editar — ${catInfo.label}` : `Nuevo registro — ${catInfo.label}`}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">El nombre se guardará en mayúsculas automáticamente.</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              {esSubarea && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Área Disciplinar <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={modal.areaDisciplinarId}
                    onChange={e => setModal(m => ({ ...m, areaDisciplinarId: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/10 transition"
                  >
                    <option value="">Seleccioná un área...</option>
                    {areasActivas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  key={modalKey}
                  ref={inputRef}
                  defaultValue={modal.nombre}
                  onChange={e => setModal(m => ({ ...m, nombre: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && !submitting && guardar()}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/10 transition"
                  placeholder="Ej: NUEVO VALOR"
                  maxLength={100}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {modal.nombre.trim() && modal.nombre !== modal.nombre.toUpperCase() && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Se guardará como: <span className="font-semibold text-slate-600">{modal.nombre.trim().toUpperCase()}</span>
                  </p>
                )}
              </div>
              {modalError && (
                <p className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{modalError}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={cerrarModal}
                className="px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#0f4c81] text-white rounded-lg hover:bg-[#0d3e6b] transition-colors disabled:opacity-60"
              >
                {submitting && <IcSpinner />}
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
