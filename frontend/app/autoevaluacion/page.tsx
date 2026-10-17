'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch as apiFetchBase, mensajeErrorHttp } from '@/lib/api';
import { ResultadoIndicadorDetalle } from './components/ResultadoIndicadorDetalle';

// ── Constantes ─────────────────────────────────────────────────────────────────

// Explicit context requirement per implemented indicator (source of truth: evaluator files).
// R-07 has alcance='DOCENTE' in the registry but its evaluator requires carreraId — evaluator wins.
const CONTEXTO_POR_INDICADOR: Record<string, 'carreraId' | 'planEstudioId'> = {
  'R-02': 'planEstudioId',
  'R-06': 'carreraId',
  'R-07': 'carreraId',
  'R-08': 'planEstudioId',
  'R-09': 'planEstudioId',
};

// ── API helper ─────────────────────────────────────────────────────────────────

async function apiCall(path: string, opts?: RequestInit) {
  const res = await apiFetchBase(path, opts);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error en la solicitud'));
  return data;
}

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface IndicadorMeta {
  codigo: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  severidad: string;
  alcance: string;
  estadoImplementacion: 'IMPLEMENTADO' | 'NO_IMPLEMENTADO';
  motivoPendiente?: string;
}

interface DatoFaltante {
  campo: string;
  descripcion?: string;
}

interface ResultadoEvaluacion {
  codigo: string;
  contextoId: string;
  tipoContexto: string;
  estadoImplementacion: 'IMPLEMENTADO' | 'NO_IMPLEMENTADO';
  estadoCalculo: 'CALCULADO' | 'PARCIAL' | 'NO_DETERMINABLE' | 'NO_APLICA' | null;
  valor: unknown;
  unidad?: string;
  datosFaltantes: DatoFaltante[];
  evidencias?: string[];
  observaciones?: string;
  motivoPendiente?: string;
  fechaEvaluacion: string;
}

interface Carrera {
  id: string;
  nombre: string;
  codigo?: string;
  facultadId: string;
}

interface Plan {
  id: string;
  nombre: string;
  anio?: number;
  version?: string;
  estado: string;
}

// ── Helpers visuales ───────────────────────────────────────────────────────────

function tipoCls(tipo: string): string {
  if (tipo === 'ALERTA')    return 'bg-red-50 text-red-700 border-red-200';
  if (tipo === 'INDICADOR') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function alcanceCls(alcance: string): string {
  if (alcance === 'PLAN')    return 'bg-violet-50 text-violet-700 border-violet-200';
  if (alcance === 'CARRERA') return 'bg-[#0f4c81]/8 text-[#0f4c81] border-[#0f4c81]/15';
  if (alcance === 'DOCENTE') return 'bg-teal-50 text-teal-700 border-teal-200';
  return 'bg-slate-100 text-slate-500 border-slate-200';
}

function estadoCls(estadoCalculo: string | null, estadoImpl: string): string {
  if (estadoImpl === 'NO_IMPLEMENTADO')    return 'bg-slate-100 text-slate-500 border-slate-200';
  if (estadoCalculo === 'CALCULADO')       return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (estadoCalculo === 'PARCIAL')         return 'bg-amber-50 text-amber-700 border-amber-200';
  if (estadoCalculo === 'NO_DETERMINABLE') return 'bg-slate-100 text-slate-600 border-slate-200';
  if (estadoCalculo === 'NO_APLICA')       return 'bg-sky-50 text-sky-700 border-sky-200';
  return 'bg-slate-100 text-slate-500 border-slate-200';
}

function estadoLabel(estadoCalculo: string | null, estadoImpl: string): string {
  if (estadoImpl === 'NO_IMPLEMENTADO') return 'NO IMPLEMENTADO';
  if (!estadoCalculo) return '—';
  return estadoCalculo.replace(/_/g, ' ');
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatValor(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'object') return JSON.stringify(valor, null, 2);
  return String(valor);
}

// ── Iconos ─────────────────────────────────────────────────────────────────────

const IcSpinnerSm = () => (
  <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin flex-shrink-0" />
);

const IcSpinnerMd = () => (
  <span className="inline-block w-5 h-5 rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin flex-shrink-0" />
);

const IcChevron = ({ open }: { open: boolean }) => (
  <svg
    className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const IcPlay = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IcRefresh = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// ── Componente principal ───────────────────────────────────────────────────────

export default function AutoevaluacionPage() {
  const { usuario } = useAuth();
  const rol = usuario?.rol?.nombre ?? '';

  const [indicadores,         setIndicadores]         = useState<IndicadorMeta[]>([]);
  const [cargandoIndicadores, setCargandoIndicadores] = useState(true);
  const [errorIndicadores,    setErrorIndicadores]    = useState<string | null>(null);

  const [carreras,        setCarreras]        = useState<Carrera[]>([]);
  const [cargandoCarreras, setCargandoCarreras] = useState(true);
  const [carreraId,       setCarreraId]       = useState('');

  const [planes,        setPlanes]        = useState<Plan[]>([]);
  const [cargandoPlanes, setCargandoPlanes] = useState(false);
  const [planId,        setPlanId]        = useState('');

  const [evaluando,  setEvaluando]  = useState<Record<string, boolean>>({});
  const [resultados, setResultados] = useState<Record<string, ResultadoEvaluacion>>({});
  const [erroresEval, setErroresEval] = useState<Record<string, string>>({});
  const [expandido,  setExpandido]  = useState<string | null>(null);

  // C-01: Monotonic generation counter incremented synchronously in every context-change handler.
  // Detects A→B→A scenarios where plain ID comparison would accept stale responses.
  const generacionRef = useRef(0);

  // D-05: Invalidate all results and errors whenever the evaluation context changes
  useEffect(() => {
    setResultados({});
    setErroresEval({});
    setExpandido(null);
  }, [carreraId, planId]);

  // Cargar indicadores y carreras al montar
  useEffect(() => {
    if (!usuario) return;
    apiCall('/autoevaluacion/indicadores')
      .then(setIndicadores)
      .catch(e => setErrorIndicadores((e as Error).message))
      .finally(() => setCargandoIndicadores(false));

    apiCall('/carreras')
      .then(setCarreras)
      .catch(() => {})
      .finally(() => setCargandoCarreras(false));
  }, [usuario]);

  // Pre-seleccionar carrera para DIRECTOR_CARRERA; also counts as a context change
  useEffect(() => {
    if (rol === 'DIRECTOR_CARRERA' && usuario?.carreraAsociada) {
      generacionRef.current += 1;
      setCarreraId(usuario.carreraAsociada.id);
    }
  }, [rol, usuario]);

  // Cargar planes al cambiar carrera
  useEffect(() => {
    if (!carreraId) { setPlanes([]); setPlanId(''); return; }
    setCargandoPlanes(true);
    apiCall(`/plan-estudios?carreraId=${carreraId}`)
      .then((data: Plan[]) => setPlanes(data ?? []))
      .catch(() => setPlanes([]))
      .finally(() => setCargandoPlanes(false));
    setPlanId('');
  }, [carreraId]);

  async function evaluar(ind: IndicadorMeta) {
    const { codigo } = ind;

    // D-02 + D-03: NO_IMPLEMENTADO indicators must never fire a request
    if (ind.estadoImplementacion === 'NO_IMPLEMENTADO') return;

    // D-08 + D-03: build payload using explicit indicator code map; guard missing context
    const campo = CONTEXTO_POR_INDICADOR[codigo];
    if (!campo) return;

    let payload: Record<string, string>;
    if (campo === 'planEstudioId') {
      if (!planId) return;
      payload = { planEstudioId: planId };
    } else {
      if (!carreraId) return;
      payload = { carreraId };
    }

    // C-01: capture generation at call start; any context change will increment it,
    // making this request invalid even if the user returns to the same IDs (A→B→A)
    const miGeneracion = generacionRef.current;

    setEvaluando(prev => ({ ...prev, [codigo]: true }));
    setErroresEval(prev => { const n = { ...prev }; delete n[codigo]; return n; });

    try {
      const res: ResultadoEvaluacion = await apiCall(
        `/autoevaluacion/indicadores/${codigo}/evaluar`,
        { method: 'POST', body: JSON.stringify(payload) },
      );
      // C-01: discard response if context changed (including A→B→A return to same IDs)
      if (generacionRef.current !== miGeneracion) return;
      setResultados(prev => ({ ...prev, [codigo]: res }));
      setExpandido(codigo);
    } catch (e) {
      if (generacionRef.current !== miGeneracion) return;
      setErroresEval(prev => ({ ...prev, [codigo]: (e as Error).message }));
    } finally {
      setEvaluando(prev => { const n = { ...prev }; delete n[codigo]; return n; });
    }
  }

  function puedeEvaluar(ind: IndicadorMeta): boolean {
    // D-02: NO_IMPLEMENTADO is never evaluatable regardless of role
    if (ind.estadoImplementacion === 'NO_IMPLEMENTADO') return false;
    // D-01: context is required for ALL roles — check by indicator code, not role
    const campo = CONTEXTO_POR_INDICADOR[ind.codigo];
    if (!campo) return false;
    if (campo === 'planEstudioId') return !!planId;
    return !!carreraId;
  }

  function tooltipContexto(ind: IndicadorMeta): string | undefined {
    if (puedeEvaluar(ind)) return undefined;
    if (ind.estadoImplementacion === 'NO_IMPLEMENTADO') return 'Este indicador aún no está implementado';
    const campo = CONTEXTO_POR_INDICADOR[ind.codigo];
    if (campo === 'planEstudioId') return 'Seleccioná un plan de estudio para este indicador';
    if (campo === 'carreraId') return 'Seleccioná una carrera para este indicador';
    return undefined;
  }

  const carreraLabel = carreras.find(c => c.id === carreraId)?.nombre;
  const planLabel    = planes.find(p => p.id === planId)?.nombre;

  return (
    <div className="max-w-6xl mx-auto">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Autoevaluación</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">MOD-AUT</p>
        <h1 className="text-xl font-bold text-slate-800">Autoevaluación Institucional</h1>
        <p className="mt-1 text-sm text-slate-500">
          Evaluación de indicadores académicos e institucionales.
          {' Seleccioná el contexto requerido para habilitar la evaluación.'}
        </p>
      </div>

      {/* Panel de contexto */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
          Contexto de evaluación
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Carrera */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Carrera
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            {cargandoCarreras ? (
              <div className="flex items-center gap-2 py-2">
                <IcSpinnerSm />
                <span className="text-xs text-slate-400">Cargando carreras...</span>
              </div>
            ) : (
              <select
                value={carreraId}
                onChange={e => { generacionRef.current += 1; setCarreraId(e.target.value); }}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
              >
                <option value="">— Seleccioná una carrera —</option>
                {carreras.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            )}
            {rol === 'DIRECTOR_CARRERA' && usuario?.carreraAsociada && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                Carrera asignada:{' '}
                <span className="font-medium text-[#0f4c81]">{usuario.carreraAsociada.nombre}</span>
              </p>
            )}
          </div>

          {/* Plan de estudio */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Plan de Estudio
              <span className="text-slate-400 font-normal ml-1">(para indicadores de plan)</span>
            </label>
            {cargandoPlanes ? (
              <div className="flex items-center gap-2 py-2">
                <IcSpinnerSm />
                <span className="text-xs text-slate-400">Cargando planes...</span>
              </div>
            ) : (
              <select
                value={planId}
                onChange={e => { generacionRef.current += 1; setPlanId(e.target.value); }}
                disabled={!carreraId || planes.length === 0}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!carreraId
                    ? '— Seleccioná una carrera primero —'
                    : planes.length === 0
                    ? '— Sin planes disponibles —'
                    : '— Seleccioná un plan —'}
                </option>
                {planes.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}{p.anio ? ` (${p.anio})` : ''}{p.version ? ` v${p.version}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Contexto activo */}
        {(carreraLabel || planLabel) && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Contexto activo:</span>
            {carreraLabel && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0f4c81]/8 text-[#0f4c81] border border-[#0f4c81]/15">
                {carreraLabel}
              </span>
            )}
            {planLabel && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                {planLabel}
              </span>
            )}
            {planId && (
              <Link
                href={`/autoevaluacion/tablero/${planId}?plan=${encodeURIComponent(planLabel ?? '')}&carrera=${encodeURIComponent(carreraLabel ?? '')}`}
                className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0f4c81] text-white hover:bg-[#0a3d6e] transition-colors"
              >
                Ver tablero →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Indicadores */}
      {cargandoIndicadores ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex items-center justify-center gap-3">
          <IcSpinnerMd />
          <span className="text-sm text-slate-500">Cargando indicadores...</span>
        </div>
      ) : errorIndicadores ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {errorIndicadores}
        </div>
      ) : indicadores.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <p className="text-sm text-slate-500">No hay indicadores disponibles.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0f4c81] text-white">
                <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide w-20">Código</th>
                <th className="text-left px-4 py-3 font-semibold uppercase tracking-wide">Nombre</th>
                <th className="text-center px-3 py-3 font-semibold uppercase tracking-wide w-24 hidden sm:table-cell">Tipo</th>
                <th className="text-center px-3 py-3 font-semibold uppercase tracking-wide w-24 hidden md:table-cell">Alcance</th>
                <th className="text-center px-3 py-3 font-semibold uppercase tracking-wide w-32 hidden lg:table-cell">Resultado</th>
                <th className="px-4 py-3 w-44"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {indicadores.map(ind => {
                const resultado   = resultados[ind.codigo];
                const estEvaluando = !!evaluando[ind.codigo];
                const errorEval   = erroresEval[ind.codigo];
                const puedeEval   = puedeEvaluar(ind);
                const estaExpandido = expandido === ind.codigo;

                return (
                  <Fragment key={ind.codigo}>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/10">
                          {ind.codigo}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-800 leading-snug">{ind.nombre}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{ind.descripcion}</p>
                        {errorEval && (
                          <p className="text-[10px] text-red-600 mt-0.5">{errorEval}</p>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${tipoCls(ind.tipo)}`}>
                          {ind.tipo}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center hidden md:table-cell">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${alcanceCls(ind.alcance)}`}>
                          {ind.alcance}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center hidden lg:table-cell">
                        {resultado ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${estadoCls(resultado.estadoCalculo, resultado.estadoImplementacion)}`}>
                            {estadoLabel(resultado.estadoCalculo, resultado.estadoImplementacion)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {resultado && (
                            <button
                              onClick={() => setExpandido(estaExpandido ? null : ind.codigo)}
                              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-[#0f4c81] hover:bg-[#0f4c81]/5 px-2 py-1.5 rounded transition-colors"
                            >
                              <IcChevron open={estaExpandido} />
                              Ver
                            </button>
                          )}
                          <button
                            onClick={() => evaluar(ind)}
                            disabled={estEvaluando || !puedeEval}
                            title={tooltipContexto(ind)}
                            className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded transition-colors ${
                              !puedeEval
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-[#0f4c81] hover:bg-[#0f4c81]/8 active:bg-[#0f4c81]/15'
                            }`}
                          >
                            {estEvaluando
                              ? <><IcSpinnerSm />Evaluando...</>
                              : resultado
                              ? <><IcRefresh />Re-evaluar</>
                              : <><IcPlay />Evaluar</>}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {estaExpandido && resultado && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={6} className="px-6 py-4">
                          <PanelResultado resultado={resultado} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Leyenda de estados */}
      {!cargandoIndicadores && !errorIndicadores && indicadores.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Estados:</span>
          {([
            ['CALCULADO',        'bg-emerald-50 text-emerald-700 border-emerald-200'],
            ['PARCIAL',          'bg-amber-50 text-amber-700 border-amber-200'],
            ['NO DETERMINABLE',  'bg-slate-100 text-slate-600 border-slate-200'],
            ['NO APLICA',        'bg-sky-50 text-sky-700 border-sky-200'],
            ['NO IMPLEMENTADO',  'bg-slate-100 text-slate-500 border-slate-200'],
          ] as [string, string][]).map(([label, cls]) => (
            <span key={label} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Panel de resultado expandido ───────────────────────────────────────────────

function PanelResultado({ resultado }: { resultado: ResultadoEvaluacion }) {
  const { estadoCalculo, estadoImplementacion } = resultado;
  const esImplementado = estadoImplementacion === 'IMPLEMENTADO';
  const [verJson, setVerJson] = useState(false);

  return (
    <div className="space-y-3 max-w-3xl">

      {/* Fila de metadatos */}
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Estado</p>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${estadoCls(estadoCalculo, estadoImplementacion)}`}>
            {estadoLabel(estadoCalculo, estadoImplementacion)}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Evaluado</p>
          <p className="text-xs text-slate-600">{formatFecha(resultado.fechaEvaluacion)}</p>
        </div>
        {resultado.tipoContexto && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Tipo de contexto</p>
            <p className="text-xs text-slate-600 font-mono">{resultado.tipoContexto}</p>
          </div>
        )}
      </div>

      {/* Pendiente de implementación */}
      {!esImplementado && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-1">
            Pendiente de implementación
          </p>
          {resultado.motivoPendiente && (
            <p className="text-xs text-amber-700">{resultado.motivoPendiente}</p>
          )}
        </div>
      )}

      {/* Detalle específico por indicador */}
      {esImplementado && (
        <ResultadoIndicadorDetalle resultado={resultado} />
      )}

      {/* Datos faltantes */}
      {resultado.datosFaltantes.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-1.5">
            Datos faltantes ({resultado.datosFaltantes.length})
          </p>
          <ul className="space-y-1">
            {resultado.datosFaltantes.map((df, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="text-amber-500 font-bold mt-0.5 flex-shrink-0">•</span>
                <span>
                  <span className="font-semibold font-mono text-[11px]">{df.campo}</span>
                  {df.descripcion && <span className="text-slate-400"> — {df.descripcion}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Observaciones */}
      {resultado.observaciones && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Observaciones</p>
          <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 leading-relaxed">{resultado.observaciones}</p>
        </div>
      )}

      {/* Evidencias */}
      {resultado.evidencias && resultado.evidencias.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Evidencias</p>
          <ul className="space-y-1">
            {resultado.evidencias.map((ev, i) => (
              <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                <span className="text-[#0f4c81] font-bold mt-0.5 flex-shrink-0">•</span>
                {ev}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Datos técnicos */}
      <div className="border-t border-slate-100 pt-2">
        <button
          onClick={() => setVerJson(v => !v)}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          <IcChevron open={verJson} />
          Ver datos técnicos
        </button>
        {verJson && (
          resultado.valor !== null && resultado.valor !== undefined ? (
            <pre className="mt-2 text-xs bg-slate-100 text-slate-700 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap max-h-64 leading-relaxed">
              {JSON.stringify(resultado.valor, null, 2)}
            </pre>
          ) : (
            <p className="mt-2 text-xs text-slate-400 italic">Sin datos de valor disponibles para este resultado.</p>
          )
        )}
      </div>
    </div>
  );
}
