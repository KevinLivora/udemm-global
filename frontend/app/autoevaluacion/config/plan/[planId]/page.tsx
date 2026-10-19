'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, mensajeErrorHttp } from '@/lib/api';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface ConfigPlan {
  planEstudioId: string;
  horasMinTotales: number | null;
  horasMinCB: number | null;
  horasMinTB: number | null;
  horasMinTA: number | null;
  horasMinCTX: number | null;
}

type CampoUmbral = keyof Omit<ConfigPlan, 'planEstudioId'>;

// ── Metadatos de los cinco parámetros ────────────────────────────────────────

const PARAMETROS: Array<{ campo: CampoUmbral; codigo: string; nombre: string; descripcion: string }> = [
  {
    campo: 'horasMinTotales',
    codigo: 'P-10',
    nombre: 'Horas mínimas totales del plan',
    descripcion: 'Suma mínima de horas totales exigida por CONEAU (RESOL-2021-1543-APN-ME)',
  },
  {
    campo: 'horasMinCB',
    codigo: 'P-11',
    nombre: 'Horas mínimas — Ciencias Básicas (CB)',
    descripcion: 'Umbral del bloque CB. null = no configurado → R-09 no evalúa este bloque.',
  },
  {
    campo: 'horasMinTB',
    codigo: 'P-12',
    nombre: 'Horas mínimas — Tecnologías Básicas (TB)',
    descripcion: 'Umbral del bloque TB.',
  },
  {
    campo: 'horasMinTA',
    codigo: 'P-13',
    nombre: 'Horas mínimas — Tecnologías Aplicadas (TA)',
    descripcion: 'Umbral del bloque TA.',
  },
  {
    campo: 'horasMinCTX',
    codigo: 'P-14',
    nombre: 'Horas mínimas — Cs. y Tec. Complementarias (CTC/CX)',
    descripcion: 'Umbral del bloque CTC/CX.',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const IcSpinner = ({ sm }: { sm?: boolean }) => (
  <span className={`inline-block rounded-full border-2 border-slate-300 border-t-[#0f4c81] animate-spin flex-shrink-0 ${sm ? 'w-3.5 h-3.5' : 'w-5 h-5'}`} />
);

const IcRefresh = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// ── Componente interno ────────────────────────────────────────────────────────

function ConfigPlanInner() {
  const { usuario } = useAuth();
  const params       = useParams<{ planId: string }>();
  const searchParams = useSearchParams();
  const planId       = params.planId;
  const planLabel    = searchParams.get('plan')    ?? '';
  const carreraLabel = searchParams.get('carrera') ?? '';

  const esAdmin = usuario?.rol?.nombre === 'ADMINISTRADOR_SISTEMA';

  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [config,   setConfig]   = useState<ConfigPlan | null>(null);

  // Valores del formulario: string vacío = null en la petición; undefined = sin cambio
  const [form, setForm] = useState<Record<CampoUmbral, string>>({
    horasMinTotales: '',
    horasMinCB: '',
    horasMinTB: '',
    horasMinTA: '',
    horasMinCTX: '',
  });
  // Snapshot de los valores que vinieron del servidor, para detectar cambios
  const snapshotRef = useRef<Record<CampoUmbral, string>>({
    horasMinTotales: '',
    horasMinCB: '',
    horasMinTB: '',
    horasMinTA: '',
    horasMinCTX: '',
  });

  const [guardando, setGuardando] = useState(false);
  const [exito,     setExito]     = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  // ── Carga ────────────────────────────────────────────────────────────────

  async function cargar() {
    setCargando(true);
    setError(null);
    setExito(false);
    setErrorGuardar(null);
    try {
      const res  = await apiFetch(`/autoevaluacion/config/plan/${planId}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al cargar la configuración'));
      const cfg = data as ConfigPlan;
      setConfig(cfg);
      const valores: Record<CampoUmbral, string> = {
        horasMinTotales: cfg.horasMinTotales !== null ? String(cfg.horasMinTotales) : '',
        horasMinCB:      cfg.horasMinCB      !== null ? String(cfg.horasMinCB)      : '',
        horasMinTB:      cfg.horasMinTB      !== null ? String(cfg.horasMinTB)      : '',
        horasMinTA:      cfg.horasMinTA      !== null ? String(cfg.horasMinTA)      : '',
        horasMinCTX:     cfg.horasMinCTX     !== null ? String(cfg.horasMinCTX)     : '',
      };
      setForm(valores);
      snapshotRef.current = { ...valores };
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [planId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Validación de campo ──────────────────────────────────────────────────

  function validarCampo(valor: string): string | null {
    if (valor === '') return null; // vacío = null = sin umbral
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 0) return 'Debe ser un entero ≥ 0 o vacío (sin umbral)';
    return null;
  }

  const erroresCampo: Partial<Record<CampoUmbral, string>> = {};
  let hayErrores = false;
  for (const p of PARAMETROS) {
    const e = validarCampo(form[p.campo]);
    if (e) { erroresCampo[p.campo] = e; hayErrores = true; }
  }

  // ── Guardar ──────────────────────────────────────────────────────────────

  async function guardar() {
    if (!esAdmin || guardando || hayErrores) return;

    // Construir payload con solo los campos modificados
    const payload: Record<string, number | null> = {};
    let sinCambios = true;

    for (const p of PARAMETROS) {
      const valorActual  = form[p.campo];
      const valorSnap    = snapshotRef.current[p.campo];
      if (valorActual === valorSnap) continue; // sin cambio → no incluir en payload

      sinCambios = false;
      payload[p.campo] = valorActual === '' ? null : Number(valorActual);
    }

    if (sinCambios) {
      setExito(true);
      return;
    }

    setGuardando(true);
    setExito(false);
    setErrorGuardar(null);

    try {
      const res  = await apiFetch(`/autoevaluacion/config/plan/${planId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error al guardar la configuración'));

      // Actualizar snapshot con los nuevos valores confirmados
      snapshotRef.current = { ...form };
      // Reflejar la respuesta del servidor si cambia algún valor
      const cfg = data as ConfigPlan;
      const nuevosValores: Record<CampoUmbral, string> = {
        horasMinTotales: cfg.horasMinTotales !== null ? String(cfg.horasMinTotales) : '',
        horasMinCB:      cfg.horasMinCB      !== null ? String(cfg.horasMinCB)      : '',
        horasMinTB:      cfg.horasMinTB      !== null ? String(cfg.horasMinTB)      : '',
        horasMinTA:      cfg.horasMinTA      !== null ? String(cfg.horasMinTA)      : '',
        horasMinCTX:     cfg.horasMinCTX     !== null ? String(cfg.horasMinCTX)     : '',
      };
      setForm(nuevosValores);
      snapshotRef.current = { ...nuevosValores };
      setConfig(cfg);
      setExito(true);
    } catch (e) {
      setErrorGuardar((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const tableroHref = `/autoevaluacion/tablero/${planId}${planLabel || carreraLabel
    ? `?plan=${encodeURIComponent(planLabel)}&carrera=${encodeURIComponent(carreraLabel)}`
    : ''}`;

  return (
    <div className="max-w-2xl mx-auto">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <Link href="/autoevaluacion" className="hover:text-slate-600 transition-colors">Autoevaluación</Link>
        <span>/</span>
        <Link href={tableroHref} className="hover:text-slate-600 transition-colors">
          Tablero{planLabel ? ` — ${planLabel}` : ''}
        </Link>
        <span>/</span>
        <span className="text-slate-600 font-medium">Umbrales del plan</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
            MOD-AUT · Configuración de plan
          </p>
          <h1 className="text-xl font-bold text-slate-800">
            Umbrales del plan
          </h1>
          {planLabel && (
            <p className="mt-0.5 text-sm text-slate-500">{planLabel}</p>
          )}
          {carreraLabel && (
            <p className="text-xs text-slate-400">{carreraLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={tableroHref}
            className="text-xs font-semibold text-slate-500 hover:text-[#0f4c81] hover:bg-[#0f4c81]/5 px-3 py-2 rounded-lg border border-slate-200 transition-colors"
          >
            ← Volver al tablero
          </Link>
          <button
            onClick={cargar}
            disabled={cargando}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0f4c81] hover:bg-[#0f4c81]/8 active:bg-[#0f4c81]/15 px-3 py-2 rounded-lg border border-[#0f4c81]/15 transition-colors disabled:opacity-50"
          >
            {cargando ? <IcSpinner sm /> : <IcRefresh />}
            Recargar
          </button>
        </div>
      </div>

      {/* Aviso de modo lectura para roles no-admin */}
      {!esAdmin && !cargando && !error && (
        <div className="mb-4 p-3 rounded-lg bg-sky-50 border border-sky-200">
          <p className="text-xs text-sky-700">
            <span className="font-semibold">Modo lectura.</span>{' '}
            Solo el Administrador del Sistema puede modificar los umbrales del plan.
          </p>
        </div>
      )}

      {/* Cargando */}
      {cargando && !config && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex items-center justify-center gap-3">
          <IcSpinner />
          <span className="text-sm text-slate-500">Cargando configuración...</span>
        </div>
      )}

      {/* Error de carga */}
      {error && !cargando && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Formulario / vista de umbrales */}
      {config && !error && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Cabecera de la tarjeta */}
          <div className="px-5 py-4 border-b border-slate-100 bg-[#0f4c81]/3">
            <p className="text-xs font-semibold text-[#0f4c81]">Parámetros P-10 a P-14</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Cada plan tiene su propio juego de cinco valores.
              Dejar vacío un campo equivale a «sin umbral configurado»:
              R-09 no evaluará ese bloque.
            </p>
          </div>

          {/* Filas de parámetros */}
          <div className="divide-y divide-slate-50">
            {PARAMETROS.map(({ campo, codigo, nombre, descripcion }) => {
              const errCampo  = erroresCampo[campo];
              const modificado = esAdmin && form[campo] !== snapshotRef.current[campo];

              return (
                <div key={campo} className="px-5 py-4 flex items-start gap-4">
                  {/* Código + nombre */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/10">
                        {codigo}
                      </span>
                      {modificado && (
                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          modificado
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-700 leading-snug">{nombre}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{descripcion}</p>
                    {errCampo && (
                      <p className="text-[11px] text-red-600 mt-1">{errCampo}</p>
                    )}
                  </div>

                  {/* Valor */}
                  <div className="flex-shrink-0 w-36">
                    {esAdmin ? (
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={form[campo]}
                          onChange={e => {
                            setExito(false);
                            setErrorGuardar(null);
                            setForm(prev => ({ ...prev, [campo]: e.target.value }));
                          }}
                          placeholder="Sin umbral"
                          className={`w-full text-xs border rounded-lg px-3 py-2 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] ${
                            errCampo
                              ? 'border-red-300 bg-red-50'
                              : modificado
                              ? 'border-amber-300 bg-amber-50'
                              : 'border-slate-200 bg-white'
                          }`}
                        />
                        {form[campo] !== '' && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none select-none" style={{ marginRight: '1.75rem' }}>
                            h
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm font-semibold tabular-nums text-right text-slate-700">
                        {config[campo] !== null ? `${config[campo]} h` : (
                          <span className="text-slate-400 font-normal text-xs">Sin configurar</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pie del formulario (solo admin) */}
          {esAdmin && (
            <div className="px-5 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="min-h-[1.5rem]">
                {exito && !errorGuardar && (
                  <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                    <span className="text-emerald-500">✓</span>
                    Configuración guardada correctamente.
                  </p>
                )}
                {errorGuardar && (
                  <p className="text-xs text-red-700">{errorGuardar}</p>
                )}
              </div>
              <button
                onClick={guardar}
                disabled={guardando || hayErrores}
                className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-[#0f4c81] text-white hover:bg-[#0a3d6e] active:bg-[#082f55] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {guardando ? <><IcSpinner sm />Guardando...</> : 'Guardar umbrales'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Nota informativa */}
      {config && (
        <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
          Modificar los valores de este plan solo afecta a este plan.
          Los demás planes de la misma carrera conservan los suyos.
          Los cambios se reflejan en el tablero en la consulta siguiente.
        </p>
      )}
    </div>
  );
}

// ── Exportación con Suspense (requerido por useSearchParams en Next.js 14) ───

export default function ConfigPlanPage() {
  return (
    <Suspense fallback={null}>
      <ConfigPlanInner />
    </Suspense>
  );
}
