'use client';

import { useEffect, useState, useRef } from 'react';
import { apiFetch, mensajeErrorHttp } from '@/lib/api';
import Link from 'next/link';
import { normalizarMayusculas } from '@/lib/normalizarMayusculas';

interface AreaDisciplinar {
  id: string;
  nombre: string;
  activo: boolean;
}

interface Subarea {
  id: string;
  nombre: string;
  activo: boolean;
  areaDisciplinarId: string;
  areaDisciplinar: { id: string; nombre: string };
  fechaCreacion: string;
}

interface ModalState {
  abierto: boolean;
  id: string | null;
  nombre: string;
  areaDisciplinarId: string;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IcPlus   = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>;
const IcEdit   = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
const IcTrash  = () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
const IcToggle = ({ activo }: { activo: boolean }) => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{activo ? <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/> : <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>}</svg>;
const IcBack   = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>;
const IcSearch = () => <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>;
const IcSpinner = () => <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-[#0f4c81] animate-spin"/>;
const IcCheck   = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>;

function formatFecha(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const INPUT_CLS = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/15 transition';

export default function SubareasPage() {
  const [items, setItems]         = useState<Subarea[]>([]);
  const [areas, setAreas]         = useState<AreaDisciplinar[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [buscar, setBuscar]       = useState('');
  const [filtroActivo, setFiltroActivo] = useState('');
  const [filtroArea, setFiltroArea]     = useState('');
  const [exito, setExito]         = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>({ abierto: false, id: null, nombre: '', areaDisciplinarId: '' });
  const [modalKey, setModalKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function cargarAreas() {
    const res = await apiFetch(`${API}/configuracion/tablas-maestras/areas-disciplinares`);
    if (res.ok) setAreas(await res.json());
  }

  async function cargar() {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (buscar.trim())   params.set('buscar', buscar.trim());
      if (filtroActivo)    params.set('activo', filtroActivo);
      if (filtroArea)      params.set('areaDisciplinarId', filtroArea);
      const res = await apiFetch(`${API}/configuracion/subareas?${params}`);
      if (!res.ok) throw new Error(mensajeErrorHttp(res, null, 'Error al cargar los datos'));
      setItems(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargarAreas(); }, []);
  useEffect(() => { cargar(); }, [buscar, filtroActivo, filtroArea]);
  useEffect(() => { if (modal.abierto) setTimeout(() => inputRef.current?.focus(), 80); }, [modal.abierto]);

  function abrirCrear() {
    setModal({ abierto: true, id: null, nombre: '', areaDisciplinarId: '' });
    setModalKey(k => k + 1);
    setModalError(null);
  }

  function abrirEditar(item: Subarea) {
    setModal({ abierto: true, id: item.id, nombre: item.nombre, areaDisciplinarId: item.areaDisciplinarId });
    setModalKey(k => k + 1);
    setModalError(null);
  }

  function cerrarModal() {
    setModal({ abierto: false, id: null, nombre: '', areaDisciplinarId: '' });
    setModalError(null);
  }

  async function guardar() {
    const nombre = normalizarMayusculas((inputRef.current?.value ?? modal.nombre).trim());
    if (!nombre) { setModalError('El nombre es obligatorio'); return; }
    if (!modal.areaDisciplinarId) { setModalError('El área disciplinar es obligatoria'); return; }
    setSubmitting(true); setModalError(null);
    try {
      const url = modal.id
        ? `${API}/configuracion/subareas/${modal.id}`
        : `${API}/configuracion/subareas`;
      const res = await apiFetch(url, {
        method: modal.id ? 'PATCH' : 'POST',
        body: JSON.stringify({ nombre, areaDisciplinarId: modal.areaDisciplinarId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al guardar'));
      cerrarModal();
      flash(modal.id ? 'Subárea actualizada' : 'Subárea creada');
      cargar();
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(item: Subarea) {
    try {
      const res = await apiFetch(`${API}/configuracion/subareas/${item.id}/toggle`, { method: 'PATCH' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al cambiar estado'));
      flash(item.activo ? 'Desactivada' : 'Activada');
      cargar();
    } catch (e) { alert((e as Error).message); }
  }

  async function eliminar(item: Subarea) {
    if (!confirm(`¿Eliminar "${item.nombre}"?\nEsta acción no se puede deshacer.`)) return;
    try {
      const res = await apiFetch(`${API}/configuracion/subareas/${item.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al eliminar'));
      flash('Eliminada correctamente');
      cargar();
    } catch (e) { alert((e as Error).message); }
  }

  function flash(msg: string) {
    setExito(msg);
    setTimeout(() => setExito(null), 3000);
  }

  const areasActivas = areas.filter(a => a.activo);

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">

      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2">
        <Link href="/configuracion/tablas-maestras" className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#0f4c81] transition-colors">
          <IcBack />
          Tablas Maestras
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-xs font-semibold text-slate-700">Subáreas</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Configuración · Tablas Maestras</p>
          <h1 className="text-xl font-bold text-slate-800">Subáreas</h1>
          <p className="mt-1 text-sm text-slate-500">Subáreas disciplinares asociadas a un Área Disciplinar.</p>
        </div>
        <button onClick={abrirCrear} className="flex items-center gap-2 px-4 py-2 bg-[#0f4c81] text-white text-sm font-semibold rounded-xl hover:bg-[#0d3e6b] transition-colors flex-shrink-0 shadow-sm">
          <IcPlus />
          Agregar
        </button>
      </div>

      {exito && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-3 rounded-xl">
          <IcCheck />{exito}
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2"><IcSearch /></span>
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar subáreas..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/15 transition"/>
        </div>
        <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/15 transition min-w-[200px]">
          <option value="">Todas las áreas</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}{!a.activo ? ' (inactiva)' : ''}</option>)}
        </select>
        <select value={filtroActivo} onChange={e => setFiltroActivo(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/15 transition min-w-[140px]">
          <option value="">Todos los estados</option>
          <option value="true">Solo activas</option>
          <option value="false">Solo inactivas</option>
        </select>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
              <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Nombre</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Área Disciplinar</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 w-28">Estado</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 w-36">Creada</th>
              <th className="px-4 py-3 w-28"/>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center"><div className="flex items-center justify-center gap-2 text-slate-400 text-sm"><IcSpinner />Cargando...</div></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center"><p className="text-sm font-medium text-slate-600 mb-1">Sin resultados</p><p className="text-xs text-slate-400">{buscar || filtroActivo || filtroArea ? 'Cambiá los filtros para ver más registros.' : 'Aún no hay subáreas cargadas.'}</p></td></tr>
            ) : items.map(item => (
              <tr key={item.id} className={`hover:bg-slate-50/60 transition-colors ${!item.activo ? 'opacity-60' : ''}`}>
                <td className="px-5 py-3.5"><span className="font-medium text-slate-800">{item.nombre}</span></td>
                <td className="px-4 py-3.5"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">{item.areaDisciplinar.nombre}</span></td>
                <td className="px-4 py-3.5">
                  {item.activo
                    ? <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Activa</span>
                    : <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Inactiva</span>
                  }
                </td>
                <td className="px-4 py-3.5 text-xs text-slate-500">{formatFecha(item.fechaCreacion)}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => abrirEditar(item)} title="Editar" className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f4c81] hover:bg-[#0f4c81]/8 transition-colors"><IcEdit /></button>
                    <button onClick={() => toggle(item)} title={item.activo ? 'Desactivar' : 'Activar'} className={`p-1.5 rounded-lg transition-colors ${item.activo ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}><IcToggle activo={item.activo}/></button>
                    <button onClick={() => eliminar(item)} title="Eliminar" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><IcTrash /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-400">{items.length} subárea{items.length !== 1 ? 's' : ''} · {items.filter(i => i.activo).length} activa{items.filter(i => i.activo).length !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal.abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] p-4" onClick={e => { if (e.target === e.currentTarget) cerrarModal(); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">{modal.id ? 'Editar Subárea' : 'Nueva Subárea'}</h2>
              <p className="text-xs text-slate-500 mt-0.5">El nombre se guardará en mayúsculas automáticamente.</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Área Disciplinar <span className="text-red-500">*</span></label>
                <select
                  value={modal.areaDisciplinarId}
                  onChange={e => setModal(m => ({ ...m, areaDisciplinarId: e.target.value }))}
                  className={INPUT_CLS}
                >
                  <option value="">Seleccioná un área...</option>
                  {areasActivas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nombre <span className="text-red-500">*</span></label>
                <input
                  key={modalKey}
                  ref={inputRef}
                  defaultValue={modal.nombre}
                  onChange={e => setModal(m => ({ ...m, nombre: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && !submitting && guardar()}
                  className={INPUT_CLS}
                  placeholder="Ej: INGENIERÍA INDUSTRIAL"
                  maxLength={100}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-no-uppercase="true"
                />
                {modal.nombre.trim() && modal.nombre !== modal.nombre.toUpperCase() && (
                  <p className="mt-1 text-[10px] text-slate-400">Se guardará como: <span className="font-semibold text-slate-600">{modal.nombre.trim().toUpperCase()}</span></p>
                )}
              </div>
              {modalError && <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{modalError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={cerrarModal} className="px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={guardar} disabled={submitting} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#0f4c81] text-white rounded-xl hover:bg-[#0d3e6b] transition-colors disabled:opacity-60">
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
