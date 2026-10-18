'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, mensajeErrorHttp } from '@/lib/api';
import type { EstadoCalculo, TablroCarreraResponse } from './types';

// ── Helpers visuales ─────────────────────────────────────────────────────────

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

// ── Iconos ───────────────────────────────────────────────────────────────────

const IcSpinner = ({ sm }: { sm?: boolean }) => (
  <span className={`inline-block rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin flex-shrink-0 ${sm ? 'w-3.5 h-3.5' : 'w-5 h-5'}`} />
);

const IcRefresh = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// ── Componentes compartidos ──────────────────────────────────────────────────

function EstadoBadge({ ec }: { ec: EstadoCalculo }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${estadoCls(ec)}`}>
      {estadoLabel(ec)}
    </span>
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

// ── Componente interno (necesita Suspense por useSearchParams) ────────────────

function TablroCarreraInner() {
  const params       = useParams<{ carreraId: string }>();
  const searchParams = useSearchParams();
  const carreraId    = params.carreraId;
  const carreraLabel = searchParams.get('carrera') ?? '';

  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [dato,     setDato]     = useState<TablroCarreraResponse | null>(null);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const res  = await apiFetch(`/autoevaluacion/tablero/carrera/${carreraId}`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al cargar el tablero de carrera'));
      setDato(data as TablroCarreraResponse);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [carreraId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ip01 = dato?.ip01;
  const ip02 = dato?.ip02;
  const ip03 = dato?.ip03;
  const ip08 = dato?.ip08;

  // IP-03: derivar sin cobertura y porcentaje solo cuando hay datos reales
  const sinCobertura = ip03 && ip03.total > 0 ? ip03.total - ip03.cubiertas : null;
  const pctCobertura = ip03 && ip03.total > 0
    ? Math.round((ip03.cubiertas / ip03.total) * 100)
    : null;

  return (
    <div className="max-w-4xl mx-auto">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <Link href="/autoevaluacion" className="hover:text-slate-600 transition-colors">Autoevaluación</Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">Tablero de carrera</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
            MOD-AUT · Tablero de carrera
          </p>
          <h1 className="text-xl font-bold text-slate-800">
            {carreraLabel || 'Carrera'}
          </h1>
          {dato && (
            <p className="mt-1 text-[11px] text-slate-400">
              Evaluado el {formatFecha(dato.fechaEvaluacion)}
            </p>
          )}
        </div>
        <button
          onClick={cargar}
          disabled={cargando}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/8 active:bg-[#0f4c81]/15 px-3 py-2 rounded-lg border border-[#0f4c81]/15 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {cargando ? <IcSpinner sm /> : <IcRefresh />}
          Actualizar
        </button>
      </div>

      {/* Estado general */}
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
          <span className="text-sm text-slate-500">Calculando indicadores de la carrera...</span>
        </div>
      )}

      {/* Error */}
      {error && !cargando && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Indicadores */}
      {dato && ip01 && ip02 && ip03 && ip08 && (
        <div className="space-y-4">

          {/* IP-01 + IP-02 — Plantel vigente (fila compacta) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* IP-01 — Docentes vigentes */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <EtiquetaIndicador codigo="IP-01" titulo="Docentes vigentes" />

              {ip01.estadoCalculo === 'NO_APLICA' ? (
                <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                  <p className="text-xs text-sky-700">
                    Sin docentes activos con asignaciones aprobadas. No aplica la evaluación.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center py-3">
                    <div className="text-center">
                      <p className="text-3xl font-bold tabular-nums text-[#0f4c81]">{ip01.total}</p>
                      <p className="text-[10px] text-slate-500 mt-1">docentes activos con asignación vigente</p>
                    </div>
                  </div>
                  <div className="flex justify-end mt-1">
                    <EstadoBadge ec={ip01.estadoCalculo} />
                  </div>
                </>
              )}
            </div>

            {/* IP-02 — Cargos docentes vigentes */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <EtiquetaIndicador codigo="IP-02" titulo="Cargos docentes vigentes" />

              {ip02.estadoCalculo === 'NO_APLICA' ? (
                <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                  <p className="text-xs text-sky-700">
                    Sin cargos docentes clasificables activos. No aplica la evaluación.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center py-3">
                    <div className="text-center">
                      <p className="text-3xl font-bold tabular-nums text-[#0f4c81]">{ip02.total}</p>
                      <p className="text-[10px] text-slate-500 mt-1">cargos P+A con docente activo</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      P = Titular, Asociado, Adjunto · A = JTP, Ayudante Graduado, No Graduado.
                      No incluye cargos de gestión.
                    </p>
                  </div>
                  <div className="flex justify-end mt-1">
                    <EstadoBadge ec={ip02.estadoCalculo} />
                  </div>
                </>
              )}
            </div>

          </div>

          {/* IP-03 — Materias cubiertas */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <EtiquetaIndicador codigo="IP-03" titulo="Materias cubiertas" />

            {ip03.estadoCalculo === 'NO_APLICA' ? (
              <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                <p className="text-xs text-sky-700">
                  Sin planes o materias evaluables en esta carrera. No aplica la evaluación.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Metrica
                    label="Total de materias"
                    valor={ip03.total}
                  />
                  <Metrica
                    label="Con cobertura"
                    valor={ip03.cubiertas}
                  />
                  <Metrica
                    label="Sin cobertura"
                    valor={sinCobertura !== null ? sinCobertura : '—'}
                    destaca={(sinCobertura ?? 0) > 0}
                  />
                  <Metrica
                    label="Cobertura %"
                    valor={pctCobertura !== null ? `${pctCobertura}%` : '—'}
                  />
                </div>

                {ip03.cubiertas === ip03.total && ip03.estadoCalculo === 'CALCULADO' && (
                  <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5">
                    <span className="text-emerald-500">✓</span>
                    Todas las materias tienen al menos una asignación docente activa.
                  </p>
                )}
                {(sinCobertura ?? 0) > 0 && (
                  <p className="mt-2 text-xs text-red-700 flex items-center gap-1.5">
                    <span className="text-red-500">✗</span>
                    {sinCobertura} materia{(sinCobertura ?? 0) !== 1 ? 's' : ''} sin asignación docente aprobada.
                  </p>
                )}

                <div className="flex justify-end mt-2">
                  <EstadoBadge ec={ip03.estadoCalculo} />
                </div>
              </>
            )}
          </div>

          {/* IP-08 — Relación profesores / auxiliares */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <EtiquetaIndicador codigo="IP-08" titulo="Relación profesores / auxiliares" />

            {ip08.estadoCalculo === 'NO_APLICA' ? (
              <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                <p className="text-xs text-sky-700">
                  Sin vinculaciones activas en la carrera. No aplica la evaluación.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Metrica
                    label="Profesores (P)"
                    valor={ip08.profesores}
                  />
                  <Metrica
                    label="Auxiliares (A)"
                    valor={ip08.auxiliares}
                  />
                  <div className="rounded-lg px-3 py-2 border border-slate-200 bg-slate-50 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5 leading-tight">
                      Relación P : A
                    </p>
                    {ip08.ratio !== null ? (
                      <p className="text-sm font-bold tabular-nums text-[#0f4c81]">
                        {ip08.ratio} : 1
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No calculable</p>
                    )}
                  </div>
                </div>

                {ip08.ratio === null && ip08.auxiliares === 0 && ip08.profesores > 0 && (
                  <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-[11px] text-amber-700">
                      No hay cargos auxiliares registrados. La relación P/A no puede calcularse (división por cero).
                    </p>
                  </div>
                )}

                <div className="mt-2 pt-2 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    P = Titular, Asociado, Adjunto · A = JTP, Ayudante Graduado, Ayudante No Graduado.
                    Cargos de gestión y «Otros» no se contabilizan.
                  </p>
                </div>

                <div className="flex justify-end mt-2">
                  <EstadoBadge ec={ip08.estadoCalculo} />
                </div>
              </>
            )}
          </div>

          {/* Nota metodológica */}
          <p className="text-[10px] text-slate-400 text-center">
            Indicadores FSD §7 — Plantel de la carrera.
            IP-01 e IP-02 incluyen solo docentes activos (docente.activo=true).
            IP-03 e IP-08 basados en vinculaciones con estado APROBADA.
          </p>

        </div>
      )}
    </div>
  );
}

// ── Exportación con Suspense (requerido por useSearchParams en Next.js 14) ───

export default function TablroCarreraPage() {
  return (
    <Suspense fallback={null}>
      <TablroCarreraInner />
    </Suspense>
  );
}
