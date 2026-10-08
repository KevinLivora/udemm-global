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

const FORM_VACIO = { codigo: '', nombre: '', descripcion: '', estado: 'ACTIVO' };
const ITEMS_POR_PAGINA = 10;

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Facultad {
  id: string;
  codigo?: string;
  nombre: string;
  descripcion?: string;
  estado: string;
  universidadId: string;
  universidad?: { id: string; nombre: string };
  _count?: { carreras: number };
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

interface Universidad { id: string; nombre: string }
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
const IcBuilding = () => (
  <svg className="w-6 h-6 text-[#0f4c81]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

// ── Componente principal ──────────────────────────────────────────────────────

export default function FacultadesPage() {
  const pathname = usePathname();
  const { usuario } = useAuth();
  const permisos = getPermisosGestionAcademica(usuario?.rol?.nombre ?? '');

  const [facultades, setFacultades] = useState<Facultad[]>([]);
  const [universidades, setUniversidades] = useState<Universidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [buscar, setBuscar] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [pagina, setPagina] = useState(1);

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Facultad | null>(null);
  const [form, setForm] = useState<Form>(FORM_VACIO);
  const [universidadId, setUniversidadId] = useState('');
  const [guardando, setGuardando] = useState(false);

  // ── API ─────────────────────────────────────────────────────────────────
  async function apiFetch(url: string, opts?: RequestInit) {
    const res = await apiFetchBase(url, opts);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error en la solicitud'));
    return data;
  }

  async function fetchFacultades() {
    setCargando(true);
    setError(null);
    try {
      const data = await apiFetch(`${API_URL}/facultades`);
      setFacultades(data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (!usuario) return;
    fetchFacultades();
    apiFetch(`${API_URL}/facultades/universidades`).then(setUniversidades).catch(() => {});
  }, [usuario]);

  // Reset página al cambiar filtros
  useEffect(() => { setPagina(1); }, [buscar, filtroEstado]);

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    const t = buscar.toLowerCase().trim();
    return facultades.filter(f => {
      if (filtroEstado && f.estado !== filtroEstado) return false;
      if (t && !f.nombre.toLowerCase().includes(t) && !f.codigo?.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [facultades, buscar, filtroEstado]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / ITEMS_POR_PAGINA));
  const paginadas = filtradas.slice((pagina - 1) * ITEMS_POR_PAGINA, pagina * ITEMS_POR_PAGINA);

  const stats = useMemo(() => ({
    total: facultades.length,
    activas: facultades.filter(f => f.estado === 'ACTIVO').length,
    inactivas: facultades.filter(f => f.estado === 'INACTIVO').length,
  }), [facultades]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function abrirCrear() {
    setForm(FORM_VACIO);
    setUniversidadId(universidades[0]?.id ?? '');
    setEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(f: Facultad) {
    setForm({ codigo: f.codigo ?? '', nombre: f.nombre, descripcion: f.descripcion ?? '', estado: f.estado });
    setUniversidadId(f.universidadId);
    setEditando(f);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
    setForm(FORM_VACIO);
  }

  async function guardar() {
    if (!form.nombre.trim()) { alert('El nombre es obligatorio.'); return; }
    if (!editando && !universidadId) { alert('Seleccioná una universidad.'); return; }
    setGuardando(true);
    try {
      if (editando) {
        const payload = {
          nombre: form.nombre.trim(),
          codigo: form.codigo.trim() || undefined,
          descripcion: form.descripcion.trim() || undefined,
          estado: form.estado,
        };
        const updated = await apiFetch(`${API_URL}/facultades/${editando.id}`, {
          method: 'PATCH', body: JSON.stringify(payload)
        });
        setFacultades(prev => prev.map(f => f.id === editando.id ? { ...f, ...updated } : f));
      } else {
        const payload = {
          nombre: form.nombre.trim(),
          codigo: form.codigo.trim() || undefined,
          descripcion: form.descripcion.trim() || undefined,
          estado: form.estado,
          universidadId,
        };
        const created = await apiFetch(`${API_URL}/facultades`, {
          method: 'POST', body: JSON.stringify(payload)
        });
        setFacultades(prev => [...prev, created]);
      }
      cerrarModal();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function toggleEstado(f: Facultad) {
    const accion = f.estado === 'ACTIVO' ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Confirmar ${accion} la facultad "${f.nombre}"?`)) return;
    try {
      if (f.estado === 'ACTIVO') {
        await apiFetch(`${API_URL}/facultades/${f.id}`, { method: 'DELETE' });
        setFacultades(prev => prev.map(x => x.id === f.id ? { ...x, estado: 'INACTIVO' } : x));
      } else {
        const updated = await apiFetch(`${API_URL}/facultades/${f.id}`, {
          method: 'PATCH', body: JSON.stringify({ estado: 'ACTIVO' })
        });
        setFacultades(prev => prev.map(x => x.id === f.id ? { ...x, ...updated } : x));
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
        <span className="text-slate-600 font-medium">Facultades</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Gestión Académica</p>
        <h1 className="text-xl font-bold text-slate-800">Facultades</h1>
        <p className="mt-1 text-sm text-slate-500">Administración de facultades y unidades académicas.</p>
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
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IcSearch /></div>
          <input value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
          />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activas</option>
          <option value="INACTIVO">Inactivas</option>
        </select>
        {permisos.crear && (
          <button onClick={abrirCrear}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0f4c81] text-white text-xs font-semibold hover:bg-[#0d3e6b] transition-colors whitespace-nowrap">
            <IcPlus />
            Nueva Facultad
          </button>
        )}
      </div>

      {(buscar || filtroEstado) && (
        <p className="text-xs text-slate-400 mb-3">{filtradas.length} resultado{filtradas.length !== 1 ? 's' : ''} de {facultades.length}</p>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}

      {/* Tabla */}
      {cargando ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex items-center justify-center gap-3">
          <IcSpinner /><span className="text-sm text-slate-500">Cargando facultades...</span>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <IcBuilding />
          <p className="text-sm font-medium text-slate-600 mt-3 mb-1">
            {facultades.length === 0 ? 'No hay facultades registradas' : 'Sin resultados para los filtros aplicados'}
          </p>
          <p className="text-xs text-slate-400">
            {facultades.length === 0 && permisos.crear ? 'Usá el botón "Nueva Facultad" para comenzar.' : ''}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide w-24">Código</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Descripción</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide w-24 hidden sm:table-cell">Carreras</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide w-24">Estado</th>
                <th className="px-4 py-3 w-36"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginadas.map(f => (
                <tr key={f.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="px-4 py-3">
                    {f.codigo ? (
                      <span className="text-[11px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/10">
                        {f.codigo}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-slate-800">{f.nombre}</p>
                    {f.universidad && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{f.universidad.nombre}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell max-w-xs">
                    <p className="line-clamp-2">{f.descripcion ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600 hidden sm:table-cell">
                    <span className="font-semibold">{f._count?.carreras ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${
                      f.estado === 'ACTIVO'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {f.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {permisos.editar && (
                        <button onClick={() => abrirEditar(f)}
                          className="flex items-center gap-1 text-[11px] text-[#0f4c81] hover:bg-[#0f4c81]/5 px-2 py-1 rounded transition-colors">
                          <IcEdit />Editar
                        </button>
                      )}
                      {permisos.eliminar && (
                        <button onClick={() => toggleEstado(f)}
                          className={`text-[11px] px-2 py-1 rounded transition-colors ${
                            f.estado === 'ACTIVO'
                              ? 'text-red-500 hover:bg-red-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}>
                          {f.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
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
                de <span className="font-semibold text-slate-700">{filtradas.length}</span> facultades
              </p>
              <Paginador pagina={pagina} total={totalPaginas} onChange={setPagina} />
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                {editando ? 'Editar Facultad' : 'Nueva Facultad'}
              </h3>
              <button onClick={cerrarModal} className="text-slate-400 hover:text-slate-600"><IcClose /></button>
            </div>

            <div className="p-6 space-y-4">
              {universidades.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Universidad</label>
                  {editando ? (
                    <p className="w-full text-sm border border-slate-100 rounded-lg px-3 py-2 bg-slate-50 text-slate-600">
                      {editando.universidad?.nombre ?? universidades.find(u => u.id === editando.universidadId)?.nombre ?? editando.universidadId}
                    </p>
                  ) : (
                    <select value={universidadId} onChange={e => setUniversidadId(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
                      <option value="">-- Seleccionar --</option>
                      {universidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Código</label>
                  <input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                    placeholder="Ej: FAC-ING" data-no-uppercase="true"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] font-mono" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Estado</label>
                  <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]">
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Nombre <span className="text-red-500">*</span></label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: normalizarMayusculas(e.target.value) }))}
                  placeholder="Ej: Facultad de Ingeniería" data-no-uppercase="true"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Descripción</label>
                <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: normalizarMayusculas(e.target.value) }))}
                  rows={3} placeholder="Descripción de la facultad..." data-no-uppercase="true"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={cerrarModal}
                className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                className="px-4 py-2 text-xs font-semibold bg-[#0f4c81] text-white rounded-lg hover:bg-[#0d3e6b] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear facultad'}
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
