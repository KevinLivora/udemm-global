'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch as apiFetchBase, mensajeErrorHttp } from '@/lib/api';
import { getPermisosPlanEstudio } from '@/lib/permisos-plan-estudios';

// ── Constantes ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const NAV_INTERNA = [
  { label: 'Carreras',                         href: '/plan-estudios/carreras' },
  { label: 'Programas de Asignatura',          href: '/plan-estudios/programas-asignatura' },
  { label: 'Información de Planes de Estudio', href: '/plan-estudios/informacion-planes' },
];

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Carrera {
  id: string;
  nombre: string;
  facultad?: { nombre: string };
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
  anio?: number;
  tipoAsignatura: string;
}

interface EstadisticasPlan {
  cargaHorariaTotal: number;
  distribBloque: Array<{
    bloque: string;
    cantidad: number;
    cargaHoraria: number;
    porcentaje: number;
  }>;
}

// ── Iconos ────────────────────────────────────────────────────────────────────

const IcSpinner = () => (
  <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin" />
);

// ── Componente ────────────────────────────────────────────────────────────────

export default function InformacionPlanesPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { usuario } = useAuth();

  const [carreras,         setCarreras]         = useState<Carrera[]>([]);
  const [planes,           setPlanes]           = useState<Plan[]>([]);
  const [materias,         setMaterias]         = useState<Materia[]>([]);
  const [carreraId,        setCarreraId]        = useState('');
  const [planId,           setPlanId]           = useState('');
  const [cargandoCarreras, setCargandoCarreras] = useState(true);
  const [cargandoPlanes,   setCargandoPlanes]   = useState(false);
  const [cargandoMaterias, setCargandoMaterias] = useState(false);
  const [estadisticas,     setEstadisticas]     = useState<EstadisticasPlan | null>(null);
  const [exportando,       setExportando]       = useState<'excel' | 'pdf' | null>(null);
  const [error,            setError]            = useState<string | null>(null);

  // ── API ───────────────────────────────────────────────────────────────────

  async function apiFetch(url: string) {
    const res = await apiFetchBase(url);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error en la solicitud'));
    return data;
  }

  useEffect(() => {
    if (!usuario) return;
    setCargandoCarreras(true);
    apiFetch(`${API_URL}/plan-estudios/carreras`)
      .then(data => {
        const list: Carrera[] = data ?? [];
        setCarreras(list);
        const paramId = searchParams.get('carreraId');
        if (paramId && list.some(c => c.id === paramId)) {
          setCarreraId(paramId);
        }
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setCargandoCarreras(false));
  }, [usuario]);

  useEffect(() => {
    if (!carreraId) { setPlanes([]); setPlanId(''); setMaterias([]); setEstadisticas(null); return; }
    setCargandoPlanes(true);
    setPlanes([]);
    setPlanId('');
    setMaterias([]);
    apiFetch(`${API_URL}/plan-estudios?carreraId=${carreraId}`)
      .then(data => setPlanes(data ?? []))
      .catch(() => {})
      .finally(() => setCargandoPlanes(false));
  }, [carreraId]);

  useEffect(() => {
    if (!planId) { setMaterias([]); setEstadisticas(null); return; }
    setCargandoMaterias(true);
    Promise.all([
      apiFetch(`${API_URL}/materias?planEstudioId=${planId}`),
      apiFetch(`${API_URL}/plan-estudios/${planId}/estadisticas`),
    ])
      .then(([mats, stats]) => {
        setMaterias(mats ?? []);
        setEstadisticas(stats ?? null);
      })
      .catch(() => {})
      .finally(() => setCargandoMaterias(false));
  }, [planId]);

  // ── Datos derivados ───────────────────────────────────────────────────────

  const planSeleccionado   = planes.find(p => p.id === planId);
  const carreraSeleccionada = carreras.find(c => c.id === carreraId);

  const stats = useMemo(() => {
    const byAnio: Record<string, number> = {};
    let obligatorias = 0, electivas = 0, optativas = 0;
    materias.forEach(m => {
      const a = m.anio?.toString() ?? 'Sin año';
      byAnio[a] = (byAnio[a] ?? 0) + 1;
      if (m.tipoAsignatura === 'OBLIGATORIA') obligatorias++;
      else if (m.tipoAsignatura === 'ELECTIVA') electivas++;
      else optativas++;
    });
    return { byAnio, obligatorias, electivas, optativas };
  }, [materias]);

  const permisos = getPermisosPlanEstudio(usuario?.rol?.nombre ?? '');

  async function handleExportar(formato: 'excel' | 'pdf') {
    if (!carreraId || !planId) {
      alert('Seleccioná una carrera y un plan de estudio para exportar.');
      return;
    }
    setExportando(formato);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (carreraId) params.set('carreraId', carreraId);
      if (planId) params.set('planId', planId);
      const res = await apiFetchBase(`${API_URL}/plan-estudios/exportar/${formato}?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(mensajeErrorHttp(res, data, 'No se pudo generar el archivo.'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fecha = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `informacion_planes_estudio_${fecha}.${formato === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Error al generar el archivo. Verificá la conexión.');
    } finally {
      setExportando(null);
    }
  }

  const selectCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <a href="/plan-estudios" className="hover:text-slate-600 transition-colors">Plan de Estudios</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Información de Planes de Estudio</span>
      </nav>

      {/* Encabezado */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Plan de Estudios</p>
        <h1 className="text-xl font-bold text-slate-800">Información de Planes de Estudio</h1>
        <p className="mt-1 text-sm text-slate-500">
          Datos generales y distribución de asignaturas de cada plan de estudio por carrera.
        </p>
      </div>

      {/* Navegación interna */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {NAV_INTERNA.map(item => (
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

      {/* Selectores y exportación */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
        {permisos.exportar && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Filtros</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleExportar('excel')}
                disabled={!carreraId || !planId || exportando !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exportando === 'excel' ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-300 border-t-emerald-700 animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                Exportar Excel
              </button>
              <button
                onClick={() => handleExportar('pdf')}
                disabled={!carreraId || !planId || exportando !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exportando === 'pdf' ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-red-300 border-t-red-700 animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}
                Exportar PDF
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Carrera
            </label>
            {cargandoCarreras ? (
              <div className="flex items-center gap-2 h-9"><IcSpinner /><span className="text-xs text-slate-400">Cargando...</span></div>
            ) : (
              <select
                value={carreraId}
                onChange={e => { setCarreraId(e.target.value); setError(null); }}
                className={selectCls}
              >
                <option value="">-- Seleccionar carrera --</option>
                {carreras.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            )}
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Plan de Estudio
            </label>
            {cargandoPlanes ? (
              <div className="flex items-center gap-2 h-9"><IcSpinner /><span className="text-xs text-slate-400">Cargando...</span></div>
            ) : (
              <select
                value={planId}
                onChange={e => setPlanId(e.target.value)}
                disabled={!carreraId}
                className={selectCls}
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
        </div>
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

      {/* Estado vacío */}
      {!planId && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#0f4c81]/8 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-[#0f4c81]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">
            {!carreraId ? 'Seleccioná una carrera para comenzar' : 'Seleccioná un plan de estudio'}
          </p>
          <p className="text-xs text-slate-400">
            {!carreraId
              ? 'Elegí la carrera y luego el plan para ver su información.'
              : planes.length === 0
              ? 'Esta carrera no tiene planes de estudio cargados.'
              : 'Elegí un plan para visualizar sus datos.'}
          </p>
        </div>
      )}

      {/* Información del plan */}
      {planId && planSeleccionado && (
        <>
          {/* Ficha general */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Información General del Plan</h2>
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
                planSeleccionado.estado === 'ACTIVO'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : planSeleccionado.estado === 'EN_REVISION'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {planSeleccionado.estado.replace('_', ' ')}
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                { label: 'Carrera',              valor: carreraSeleccionada?.nombre ?? '—' },
                { label: 'Facultad',             valor: carreraSeleccionada?.facultad?.nombre ?? '—' },
                { label: 'Nombre del Plan',      valor: planSeleccionado.nombre },
                { label: 'Año',                  valor: planSeleccionado.anio?.toString() ?? '—' },
                { label: 'Versión',              valor: planSeleccionado.version ?? '—' },
                { label: 'Total de Asignaturas', valor: cargandoMaterias ? '...' : materias.length.toString() },
              ].map(campo => (
                <div key={campo.label} className="flex items-center px-5 py-3">
                  <span className="w-44 text-xs font-medium text-slate-500 flex-shrink-0">{campo.label}</span>
                  <span className="text-sm text-slate-800">{campo.valor}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Distribución */}
          {!cargandoMaterias && materias.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-700">Distribución de Asignaturas</h2>
              </div>
              <div className="p-5">
                {/* Tarjetas resumen */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Total',        valor: materias.length,    color: 'text-[#0f4c81]', bg: 'bg-[#0f4c81]/8' },
                    { label: 'Obligatorias', valor: stats.obligatorias, color: 'text-slate-700',  bg: 'bg-slate-100'   },
                    { label: 'Electivas',    valor: stats.electivas,    color: 'text-amber-700',  bg: 'bg-amber-50'    },
                    { label: 'Optativas',    valor: stats.optativas,    color: 'text-purple-700', bg: 'bg-purple-50'   },
                  ].map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
                      <p className={`text-2xl font-bold ${s.color}`}>{s.valor}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Por año */}
                <div className="space-y-2">
                  {Object.keys(stats.byAnio)
                    .sort((a, b) => {
                      if (a === 'Sin año') return 1;
                      if (b === 'Sin año') return -1;
                      return parseInt(a) - parseInt(b);
                    })
                    .map(anio => (
                      <div key={anio} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-slate-600 w-20 flex-shrink-0">
                          {anio === 'Sin año' ? 'Sin año' : `${anio}° Año`}
                        </span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[#0f4c81] h-2 rounded-full transition-all duration-500"
                            style={{ width: `${(stats.byAnio[anio] / materias.length) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-20 text-right flex-shrink-0">
                          {stats.byAnio[anio]} mat.
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Carga Horaria del Plan */}
          {!cargandoMaterias && estadisticas && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-700">Carga Horaria del Plan</h2>
              </div>
              <div className="p-5">
                {/* KPI destacado */}
                <div className="flex items-center gap-4 p-4 bg-[#0f4c81]/8 rounded-xl mb-5">
                  <div className="w-12 h-12 rounded-xl bg-[#0f4c81] flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-[#0f4c81]">
                      {estadisticas.cargaHorariaTotal.toLocaleString('es-AR')} hs
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Carga Horaria Total · asignaturas activas</p>
                  </div>
                </div>

                {/* Tabla distribución por bloque */}
                {estadisticas.distribBloque.length > 0 && (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
                      Distribución de Carga Horaria por Bloque
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                            <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Bloque</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Asignaturas</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Carga Horaria</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-slate-600 w-40">Porcentaje</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {estadisticas.distribBloque.map(fila => (
                            <tr key={fila.bloque} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  fila.bloque === 'Sin bloque asignado'
                                    ? 'bg-slate-100 text-slate-500'
                                    : 'bg-[#0f4c81]/10 text-[#0f4c81]'
                                }`}>
                                  {fila.bloque}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-slate-600">{fila.cantidad}</td>
                              <td className="px-4 py-3 text-right text-slate-600 font-medium">{fila.cargaHoraria} hs</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="bg-[#0f4c81] h-1.5 rounded-full"
                                      style={{ width: `${fila.porcentaje}%` }}
                                    />
                                  </div>
                                  <span className="text-slate-600 w-12 text-right">{fila.porcentaje.toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {estadisticas.distribBloque.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-3">
                    No hay asignaturas activas con carga horaria definida.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Cargando materias */}
          {cargandoMaterias && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center justify-center gap-3 mb-4">
              <IcSpinner />
              <span className="text-sm text-slate-500">Cargando distribución...</span>
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/plan-estudios/malla-curricular${carreraId && planId ? `?carreraId=${carreraId}&planId=${planId}` : carreraId ? `?carreraId=${carreraId}` : ''}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Ver Malla Curricular
            </Link>
            <Link
              href="/plan-estudios/programas-asignatura"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f4c81] text-white text-xs font-semibold hover:bg-[#0d3e6b] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Ver Programas de Asignatura
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
