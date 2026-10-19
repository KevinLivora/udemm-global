'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, mensajeErrorHttp } from '@/lib/api';
import type { EvaluacionBloqueIPL05, EstadoCalculo, TablroPlanResponse } from './types';

// ── Constantes ──────────────────────────────────────────────────────────────

const BLOQUE_NOMBRE: Record<string, string> = {
  CB:    'Ciencias Básicas (CB)',
  TB:    'Tecnologías Básicas (TB)',
  TA:    'Tecnologías Aplicadas (TA)',
  CX:    'Cs. y Tec. Complementarias (CX)',
  TOTAL: 'Total del plan',
};

// ── Helpers visuales ────────────────────────────────────────────────────────

function estadoCls(ec: EstadoCalculo): string {
  if (ec === 'CALCULADO')       return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (ec === 'PARCIAL')         return 'bg-amber-50 text-amber-700 border-amber-200';
  if (ec === 'NO_DETERMINABLE') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-sky-50 text-sky-700 border-sky-200'; // NO_APLICA
}

function estadoLabel(ec: EstadoCalculo): string {
  return ec.replace(/_/g, ' ');
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

// ── Iconos ──────────────────────────────────────────────────────────────────

const IcSpinner = ({ sm }: { sm?: boolean }) => (
  <span className={`inline-block rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin flex-shrink-0 ${sm ? 'w-3.5 h-3.5' : 'w-5 h-5'}`} />
);

const IcRefresh = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// ── Componentes compartidos ─────────────────────────────────────────────────

function EstadoBadge({ ec }: { ec: EstadoCalculo }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${estadoCls(ec)}`}>
      {estadoLabel(ec)}
    </span>
  );
}

function Metrica({ label, valor, destaca = false }: {
  label: string; valor: string | number; destaca?: boolean;
}) {
  return (
    <div className={`rounded-lg px-3 py-2 border text-center ${destaca ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5 leading-tight">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${destaca ? 'text-red-700' : 'text-slate-700'}`}>{valor}</p>
    </div>
  );
}

function EtiquetaIndicador({ codigo, titulo }: { codigo: string; titulo: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[11px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/10">
        {codigo}
      </span>
      <span className="text-xs font-semibold text-slate-700">{titulo}</span>
    </div>
  );
}

// ── IPL-05: fila de bloque ───────────────────────────────────────────────────

function FilaBloque({ b }: { b: EvaluacionBloqueIPL05 }) {
  const { bloque, horasReales, horasMinimas, diferencia, cumple, estadoCalculo } = b;
  const esTotal = bloque === 'TOTAL';

  let evaluacionEl: React.ReactNode;
  if (estadoCalculo === 'NO_APLICA') {
    evaluacionEl = <span className="text-slate-400 text-[11px]">Sin umbral</span>;
  } else if (estadoCalculo === 'NO_DETERMINABLE') {
    evaluacionEl = <span className="text-slate-400 text-[11px]">No determinable</span>;
  } else if (cumple === null) {
    evaluacionEl = <span className="text-slate-400">—</span>;
  } else if (cumple) {
    evaluacionEl = (
      <span className="text-emerald-600 font-semibold text-[11px]">
        ✓ Cumple{diferencia !== null && diferencia > 0 ? ` (+${diferencia} h)` : ''}
      </span>
    );
  } else {
    evaluacionEl = (
      <span className="text-red-600 font-semibold text-[11px]">
        ✗ Faltan {diferencia !== null ? Math.abs(diferencia) : '?'} h
      </span>
    );
  }

  return (
    <tr className={`hover:bg-slate-50/60 ${esTotal ? 'border-t-2 border-slate-200 bg-slate-50/40' : ''}`}>
      <td className={`px-3 py-1.5 text-xs text-slate-700 ${esTotal ? 'font-semibold' : ''}`}>
        {BLOQUE_NOMBRE[bloque] ?? bloque}
      </td>
      <td className={`px-3 py-1.5 text-right tabular-nums text-xs ${esTotal ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
        {horasReales !== null ? `${horasReales} h` : '—'}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-slate-500">
        {horasMinimas !== null ? `${horasMinimas} h` : '—'}
      </td>
      <td className="px-3 py-1.5 text-right text-xs">{evaluacionEl}</td>
    </tr>
  );
}

// ── Componente interno (necesita Suspense por useSearchParams) ──────────────

function TableroPlanInner() {
  const { usuario } = useAuth();
  const params       = useParams<{ planId: string }>();
  const searchParams = useSearchParams();
  const planId       = params.planId;
  const planLabel    = searchParams.get('plan')    ?? '';
  const carreraLabel = searchParams.get('carrera') ?? '';
  const esAdmin      = usuario?.rol?.nombre === 'ADMINISTRADOR_SISTEMA';

  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [dato,     setDato]     = useState<TablroPlanResponse | null>(null);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const res  = await apiFetch(`/autoevaluacion/tablero/plan/${planId}`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al cargar el tablero'));
      setDato(data as TablroPlanResponse);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [planId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-4xl mx-auto">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <Link href="/autoevaluacion" className="hover:text-slate-600 transition-colors">Autoevaluación</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">Tablero por plan</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">MOD-AUT · Tablero de indicadores</p>
          <h1 className="text-xl font-bold text-slate-800">
            {planLabel || 'Plan de estudio'}
          </h1>
          {carreraLabel && (
            <p className="mt-0.5 text-sm text-slate-500">{carreraLabel}</p>
          )}
          {dato && (
            <p className="mt-1 text-[11px] text-slate-400">
              Evaluado el {formatFecha(dato.fechaEvaluacion)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {esAdmin && (
            <Link
              href={`/autoevaluacion/config/plan/${planId}?plan=${encodeURIComponent(planLabel)}&carrera=${encodeURIComponent(carreraLabel)}`}
              className="flex items-center gap-1 text-xs font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/8 px-3 py-2 rounded-lg border border-[#0f4c81]/15 transition-colors"
            >
              Configurar umbrales →
            </Link>
          )}
          <button
            onClick={cargar}
            disabled={cargando}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/8 active:bg-[#0f4c81]/15 px-3 py-2 rounded-lg border border-[#0f4c81]/15 transition-colors disabled:opacity-50"
          >
            {cargando ? <IcSpinner sm /> : <IcRefresh />}
            Actualizar
          </button>
        </div>
      </div>

      {/* Estado general — dato informativo, no semáforo institucional */}
      {dato && (
        <div className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Estado general de cálculo:</span>
          <EstadoBadge ec={dato.estadoGeneralCalculo} />
          <span className="text-[10px] text-slate-400 italic">
            Estado más restrictivo entre los cuatro indicadores — no indica cumplimiento académico.
          </span>
        </div>
      )}

      {/* Loading inicial */}
      {cargando && !dato && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex items-center justify-center gap-3">
          <IcSpinner />
          <span className="text-sm text-slate-500">Calculando indicadores del plan...</span>
        </div>
      )}

      {/* Error */}
      {error && !cargando && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Indicadores */}
      {dato && (
        <div className="space-y-4">

          {/* IPL-01 — Horas totales */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <EtiquetaIndicador codigo="IPL-01" titulo="Horas totales del plan" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metrica
                label="Horas totales"
                valor={dato.ipl01.horasTotal !== null ? `${dato.ipl01.horasTotal} h` : '—'}
              />
              <Metrica
                label="Mínimo (P-10)"
                valor={dato.ipl01.horasMinimas !== null ? `${dato.ipl01.horasMinimas} h` : 'Sin configurar'}
              />
              <Metrica
                label="Diferencia"
                valor={
                  dato.ipl01.diferencia !== null
                    ? `${dato.ipl01.diferencia >= 0 ? '+' : ''}${dato.ipl01.diferencia} h`
                    : '—'
                }
                destaca={(dato.ipl01.diferencia ?? 0) < 0}
              />
              <div className="rounded-lg px-3 py-2 border border-slate-200 bg-slate-50 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Estado</p>
                <EstadoBadge ec={dato.ipl01.estadoCalculo} />
              </div>
            </div>
            {dato.ipl01.cumple === true && (
              <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5">
                <span className="text-emerald-500">✓</span> Cumple el mínimo de horas totales del plan.
              </p>
            )}
            {dato.ipl01.cumple === false && (
              <p className="mt-2 text-xs text-red-700 flex items-center gap-1.5">
                <span className="text-red-500">✗</span> El plan no alcanza las horas mínimas requeridas (P-10).
              </p>
            )}
            {dato.ipl01.horasMinimas === null && dato.ipl01.estadoCalculo !== 'NO_DETERMINABLE' && (
              <p className="mt-2 text-xs text-sky-600">Sin umbral P-10 configurado — no es posible evaluar el cumplimiento.</p>
            )}
          </div>

          {/* IPL-02 + IPL-03 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* IPL-02 — Bloques que cumplen */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <EtiquetaIndicador codigo="IPL-02" titulo="Bloques que cumplen" />
              {dato.ipl02.estadoCalculo === 'NO_APLICA' ? (
                <p className="text-xs text-sky-600">
                  Ningún bloque tiene umbral configurado (P-11 a P-14). No aplica la evaluación.
                </p>
              ) : dato.ipl02.estadoCalculo === 'NO_DETERMINABLE' ? (
                <p className="text-xs text-slate-500">No fue posible determinar los bloques.</p>
              ) : (
                <div className="space-y-2">
                  <div className="text-center py-1">
                    <p className="text-3xl font-bold tabular-nums text-[#0f4c81]">
                      {dato.ipl02.bloquesCumplen}
                      <span className="text-lg font-semibold text-slate-400 mx-1.5">de</span>
                      {dato.ipl02.bloquesConUmbral}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      bloques con umbral configurado cumplen su mínimo
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <EstadoBadge ec={dato.ipl02.estadoCalculo} />
                  </div>
                </div>
              )}
            </div>

            {/* IPL-03 — Materias sin responsable */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <EtiquetaIndicador codigo="IPL-03" titulo="Materias sin responsable" />
              <div className="grid grid-cols-2 gap-2">
                <Metrica
                  label="Sin responsable"
                  valor={dato.ipl03.sinResponsable}
                  destaca={dato.ipl03.sinResponsable > 0}
                />
                <Metrica label="Total materias" valor={dato.ipl03.totalMaterias} />
              </div>
              {dato.ipl03.sinResponsable === 0 && dato.ipl03.inciertas === 0 && dato.ipl03.estadoCalculo === 'CALCULADO' && (
                <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5">
                  <span className="text-emerald-500">✓</span> Todas las materias tienen responsable confirmado.
                </p>
              )}
              {dato.ipl03.inciertas > 0 && (
                <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-[11px] text-amber-700 font-semibold">
                    {dato.ipl03.inciertas} materia{dato.ipl03.inciertas !== 1 ? 's' : ''} con responsabilidad incierta
                  </p>
                  <p className="text-[10px] text-amber-600 mt-0.5">
                    Con vinculación APROBADA pero{' '}
                    <span className="font-mono">esResponsableCatedra</span> sin clasificar.
                  </p>
                </div>
              )}
              <div className="flex justify-end mt-2">
                <EstadoBadge ec={dato.ipl03.estadoCalculo} />
              </div>
            </div>
          </div>

          {/* IPL-05 — Horas por tipo de bloque */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <EtiquetaIndicador codigo="IPL-05" titulo="Horas por tipo de bloque" />
            {dato.ipl05.estadoCalculo === 'NO_APLICA' ? (
              <p className="text-xs text-sky-600">El plan no tiene materias registradas. No aplica.</p>
            ) : dato.ipl05.bloques.length === 0 ? (
              <p className="text-xs text-slate-500">Sin datos de bloques disponibles.</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-slate-500">Bloque</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-28">Horas</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-28">Mínimo</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-44">Evaluación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dato.ipl05.bloques.map(b => <FilaBloque key={b.bloque} b={b} />)}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between mt-2 gap-4">
                  <p className="text-[10px] text-slate-400">
                    Mínimo «—» indica que el umbral no está configurado (P-11 a P-14).
                  </p>
                  <EstadoBadge ec={dato.ipl05.estadoCalculo} />
                </div>
              </>
            )}
          </div>

          {/* Advertencias */}
          {dato.advertencias.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-1.5">
                Advertencias ({dato.advertencias.length})
              </p>
              <ul className="space-y-1">
                {dato.advertencias.map((a, i) => (
                  <li key={i} className="text-xs text-amber-700 flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Datos faltantes */}
          {dato.datosFaltantes.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                Datos faltantes ({dato.datosFaltantes.length})
              </p>
              <ul className="space-y-1">
                {dato.datosFaltantes.map((df, i) => (
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

        </div>
      )}
    </div>
  );
}

// ── Exportación con Suspense (requerido por useSearchParams en Next.js 14) ──

export default function TableroPlanPage() {
  return (
    <Suspense fallback={null}>
      <TableroPlanInner />
    </Suspense>
  );
}
