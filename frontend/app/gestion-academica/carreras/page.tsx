'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch as apiFetchBase, mensajeErrorHttp } from '@/lib/api';
import { getPermisosGestionAcademica } from '@/lib/permisos-gestion-academica';
import { normalizarMayusculas } from '@/lib/normalizarMayusculas';

// ── Constantes ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const NAV_INTERNA = [
  { label: 'Facultades', href: '/gestion-academica/facultades' },
  { label: 'Carreras',   href: '/gestion-academica/carreras'   },
];

const MODALIDADES = ['Presencial', 'Virtual', 'A distancia', 'Híbrida'];
const ITEMS_POR_PAGINA = 10;

const FORM_VACIO = {
  codigo: '', nombre: '', facultadId: '', tituloOtorgado: '',
  duracionAnios: '', modalidad: '', estado: 'ACTIVO'
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Facultad { id: string; nombre: string; codigo?: string; estado?: string }
interface Carrera {
  id: string;
  codigo?: string;
  nombre: string;
  facultadId: string;
  facultad?: Facultad;
  tituloOtorgado?: string;
  duracionAnios?: number;
  modalidad?: string;
  estado: string;
  _count?: { planes: number };
}
type Form = typeof FORM_VACIO;

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
const IcSpinner = () => (
  <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin" />
);

// ── Componente principal ──────────────────────────────────────────────────────

export default function CarrerasPage() {
  const pathname = usePathname();
  const { usuario } = useAuth();
  const permisos = getPermisosGestionAcademica(usuario?.rol?.nombre ?? '');

  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [facultades, setFacultades] = useState<Facultad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [buscar, setBuscar] = useState('');
  const [filtroFacultad, setFiltroFacultad] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [pagina, setPagina] = useState(1);

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Carrera | null>(null);
  const [form, setForm] = useState<Form>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  // ── API ─────────────────────────────────────────────────────────────────
  async function apiFetch(url: string, opts?: RequestInit) {
    const res = await apiFetchBase(url, opts);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error en la solicitud'));
    return data;
  }

  async function fetchCarreras() {
    setCargando(true);
    setError(null);
    try {
      const data = await apiFetch(`${API_URL}/carreras`);
      setCarreras(data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!usuario) return;
    fetchCarreras();
    apiFetch(`${API_URL}/facultades`).then(setFacultades).catch(() => {});
  }, [usuario]);

  // Reset página al cambiar filtros
  useEffect(() => { setPagina(1); }, [buscar, filtroEstado, filtroFacultad]);

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    const t = buscar.toLowerCase().trim();
    return carreras.filter(c => {
      if (filtroEstado && c.estado !== filtroEstado) return false;
      if (filtroFacultad && c.facultadId !== filtroFacultad) return false;
      if (t && !c.nombre.toLowerCase().includes(t) && !c.codigo?.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [carreras, buscar, filtroEstado, filtroFacultad]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / ITEMS_POR_PAGINA));
  const paginadas = filtradas.slice((pagina - 1) * ITEMS_POR_PAGINA, pagina * ITEMS_POR_PAGINA);

  const stats = useMemo(() => ({
    total: carreras.length,
    activas: carreras.filter(c => c.estado === 'ACTIVO').length,
    inactivas: carreras.filter(c => c.estado === 'INACTIVO').length,
  }), [carreras]);

  const facultadFiltroActual = filtroFacultad
    ? facultades.find(f => f.id === filtroFacultad)
    : null;
  const filtrandoFacInactiva = facultadFiltroActual?.estado === 'INACTIVO';

  // ── Handlers ─────────────────────────────────────────────────────────────
  function abrirCrear() {
    setForm({ ...FORM_VACIO, facultadId: facultades[0]?.id ?? '' });
    setEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(c: Carrera) {
    setForm({
      codigo: c.codigo ?? '', nombre: c.nombre, facultadId: c.facultadId,
      tituloOtorgado: c.tituloOtorgado ?? '', duracionAnios: c.duracionAnios?.toString() ?? '',
      modalidad: c.modalidad ?? '', estado: c.estado
    });
    setEditando(c);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
    setForm(FORM_VACIO);
  }

  function setF(campo: keyof Form, val: string) {
    setForm(prev => ({ ...prev, [campo]: val }));
  }

  async function guardar() {
    if (!form.nombre.trim()) { alert('El nombre es obligatorio.'); return; }
    if (!form.facultadId) { alert('Seleccioná una facultad.'); return; }
    setGuardando(true);
    try {
      const payload: Record<string, unknown> = {
        nombre: form.nombre.trim(),
        facultadId: form.facultadId,
        estado: form.estado,
        codigo: form.codigo.trim() || undefined,
        tituloOtorgado: form.tituloOtorgado.trim() || undefined,
        modalidad: form.modalidad || undefined,
      };
      if (form.duracionAnios) payload.duracionAnios = parseInt(form.duracionAnios);

      if (editando) {
        const updated = await apiFetch(`${API_URL}/carreras/${editando.id}`, {
          method: 'PATCH', body: JSON.stringify(payload)
        });
        setCarreras(prev => prev.map(c => c.id === editando.id ? { ...c, ...updated } : c));
      } else {
        const created = await apiFetch(`${API_URL}/carreras`, {
          method: 'POST', body: JSON.stringify(payload)
        });
        setCarreras(prev => [...prev, created]);
      }
      cerrarModal();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function toggleEstado(c: Carrera) {
    const accion = c.estado === 'ACTIVO' ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Confirmar ${accion} la carrera "${c.nombre}"?`)) return;
    try {
      if (c.estado === 'ACTIVO') {
        await apiFetch(`${API_URL}/carreras/${c.id}`, { method: 'DELETE' });
        setCarreras(prev => prev.map(x => x.id === c.id ? { ...x, estado: 'INACTIVO' } : x));
      } else {
        const updated = await apiFetch(`${API_URL}/carreras/${c.id}`, {
          method: 'PATCH', body: JSON.stringify({ estado: 'ACTIVO' })
        });
        setCarreras(prev => prev.map(x => x.id === c.id ? { ...x, ...updated } : x));
      }
    } catch (e) {
      alert((e as Error).message);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <span className="hover:text-slate-600 transition-colors">Gestión Académica</span>
        <span>/</span>
        <span className="text-slate-600 font-medium">Carreras</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Gestión Académica</p>
        <h1 className="text-xl font-bold text-slate-800">Carreras</h1>
        <p className="mt-1 text-sm text-slate-500">Administración de carreras de grado y posgrado.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {NAV_INTERNA.map(item => (
          <Link key={item.href} href={item.href}
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

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total', valor: stats.total, color: 'text-[#0f4c81]', bg: 'bg-[#0f4c81]/6' },
          { label: 'Activas', valor: stats.activas, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Inactivas', valor: stats.inactivas, color: 'text-slate-500', bg: 'bg-slate-100' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-white/60`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.valor}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IcSearch /></div>
          <input value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
          />
        </div>
        <select value={filtroFacultad} onChange={e => setFiltroFacultad(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
          <option value="">Todas las facultades</option>
          {facultades.map(f => (
            <option key={f.id} value={f.id}>
              {f.nombre}{f.estado === 'INACTIVO' ? ' (Inactiva)' : ''}
            </option>
          ))}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activas</option>
          <option value="INACTIVO">Inactivas</option>
        </select>
        {permisos.crear && (
          <button
            onClick={filtrandoFacInactiva ? undefined : abrirCrear}
            disabled={filtrandoFacInactiva}
            title={filtrandoFacInactiva ? 'La Facultad está inactiva. Activala para crear carreras.' : undefined}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filtrandoFacInactiva
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-[#0f4c81] text-white hover:bg-[#0d3e6b]'
            }`}
          >
            <IcPlus />
            Nueva Carrera
          </button>
        )}
      </div>

      {(buscar || filtroFacultad || filtroEstado) && (
        <p className="text-xs text-slate-400 mb-3">{filtradas.length} resultado{filtradas.length !== 1 ? 's' : ''} de {carreras.length}</p>
      )}

      {/* Aviso facultad inactiva */}
      {filtrandoFacInactiva && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>
            <span className="font-semibold">La Facultad se encuentra inactiva.</span>{' '}
            Debe activarla para cargar Carreras o Planes de Estudio.
            Las carreras existentes pueden consultarse pero no pueden trasladarse a esta Facultad.
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}

      {/* Tabla */}
      {cargando ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex items-center justify-center gap-3">
          <IcSpinner /><span className="text-sm text-slate-500">Cargando carreras...</span>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <p className="text-sm font-medium text-slate-600 mb-1">
            {carreras.length === 0 ? 'No hay carreras registradas' : 'Sin resultados para los filtros aplicados'}
          </p>
          <p className="text-xs text-slate-400">
            {carreras.length === 0 && permisos.crear ? 'Usá el botón "Nueva Carrera" para comenzar.' : ''}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide w-24">Código</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide">Carrera</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Facultad</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Modalidad</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide w-20 hidden sm:table-cell">Duración</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide w-20 hidden sm:table-cell">Planes</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide w-24">Estado</th>
                <th className="px-4 py-3 w-36"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginadas.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="px-4 py-3">
                    {c.codigo ? (
                      <span className="text-[11px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/10">
                        {c.codigo}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-slate-800">{c.nombre}</p>
                    {c.tituloOtorgado && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{c.tituloOtorgado}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-slate-500">{c.facultad?.nombre ?? '—'}</span>
                    {c.facultad?.estado === 'INACTIVO' && (
                      <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap">
                        Inactiva
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {c.modalidad ? (
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                        {c.modalidad}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600 hidden sm:table-cell">
                    {c.duracionAnios ? `${c.duracionAnios} año${c.duracionAnios !== 1 ? 's' : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700 hidden sm:table-cell">
                    {c._count?.planes ?? 0}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${
                      c.estado === 'ACTIVO'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {permisos.editar && (
                        <button onClick={() => abrirEditar(c)}
                          className="flex items-center gap-1 text-[11px] text-[#0f4c81] hover:bg-[#0f4c81]/5 px-2 py-1 rounded transition-colors">
                          <IcEdit />Editar
                        </button>
                      )}
                      {permisos.eliminar && (
                        <button onClick={() => toggleEstado(c)}
                          className={`text-[11px] px-2 py-1 rounded transition-colors ${
                            c.estado === 'ACTIVO'
                              ? 'text-red-500 hover:bg-red-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}>
                          {c.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginado */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white">
              <p className="text-[11px] text-slate-500">
                Mostrando{' '}
                <span className="font-semibold text-slate-700">
                  {(pagina - 1) * ITEMS_POR_PAGINA + 1}–{Math.min(pagina * ITEMS_POR_PAGINA, filtradas.length)}
                </span>{' '}
                de <span className="font-semibold text-slate-700">{filtradas.length}</span> carreras
              </p>
              <Paginador pagina={pagina} total={totalPaginas} onChange={setPagina} />
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                {editando ? 'Editar Carrera' : 'Nueva Carrera'}
              </h3>
              <button onClick={cerrarModal} className="text-slate-400 hover:text-slate-600"><IcClose /></button>
            </div>

            <div className="overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Facultad <span className="text-red-500">*</span></label>
                <select value={form.facultadId} onChange={e => setF('facultadId', e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
                  <option value="">-- Seleccionar facultad --</option>
                  {facultades.filter(f => f.estado !== 'INACTIVO').map(f => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Código</label>
                  <input value={form.codigo} onChange={e => setF('codigo', e.target.value)}
                    placeholder="Ej: ING-IND" data-no-uppercase="true"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] font-mono" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Estado</label>
                  <select value={form.estado} onChange={e => setF('estado', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Nombre <span className="text-red-500">*</span></label>
                <input
                  value={form.nombre}
                  onChange={e => setF('nombre', e.target.value.normalize('NFC').toLocaleUpperCase('es-AR'))}
                  data-no-uppercase="true"
                  placeholder="Ej: Ingeniería Industrial"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Título Otorgado</label>
                <input value={form.tituloOtorgado} onChange={e => setF('tituloOtorgado', normalizarMayusculas(e.target.value))}
                  placeholder="Ej: Ingeniero/a Industrial" data-no-uppercase="true"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Duración (años)</label>
                  <input type="number" min="1" max="10" value={form.duracionAnios} onChange={e => setF('duracionAnios', e.target.value)}
                    placeholder="5"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Modalidad</label>
                  <select value={form.modalidad} onChange={e => setF('modalidad', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
                    <option value="">-- Sin especificar --</option>
                    {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={cerrarModal}
                className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                className="px-4 py-2 text-xs font-semibold bg-[#0f4c81] text-white rounded-lg hover:bg-[#0d3e6b] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear carrera'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente de paginado ────────────────────────────────────────────────────

function Paginador({ pagina, total, onChange }: {
  pagina: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const paginas = construirRango(pagina, total);
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(pagina - 1)}
        disabled={pagina === 1}
        className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Página anterior"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {paginas.map((p, i) =>
        p === '...' ? (
          <span key={`e-${i}`} className="h-7 w-7 flex items-center justify-center text-[11px] text-slate-400">
            ···
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={`h-7 w-7 flex items-center justify-center rounded text-[11px] font-medium transition-colors ${
              p === pagina
                ? 'bg-[#0f4c81] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onChange(pagina + 1)}
        disabled={pagina === total}
        className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Página siguiente"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

function construirRango(actual: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const result: (number | '...')[] = [];
  result.push(1);
  if (actual > 3) result.push('...');
  for (let p = Math.max(2, actual - 1); p <= Math.min(total - 1, actual + 1); p++) result.push(p);
  if (actual < total - 2) result.push('...');
  result.push(total);
  return result;
}
