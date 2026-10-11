'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface HistorialEntry {
  id: string;
  accion: string;
  seccion?: string | null;
  descripcion?: string | null;
  fecha: string;
  usuario: { id: string; nombre: string; apellido: string };
}

interface Mensaje {
  id: string;
  tipo: 'CORRECCION' | 'RESPUESTA';
  contenido: string;
  fechaCreacion: string;
  leido: boolean;
  usuario: { id: string; nombre: string; apellido: string };
}

interface SolicitudHistorial {
  id: string;
  estado: string;
  fechaCreacion: string;
  fechaResolucion?: string | null;
  observaciones?: string | null;
  aprobador?: { id: string; nombre: string; apellido: string } | null;
  mensajes: Mensaje[];
}

interface HistorialData {
  historial: HistorialEntry[];
  solicitudes: SolicitudHistorial[];
}

interface Props {
  materiaId: string;
  materiaNombre: string;
  onCerrar: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

const ESTADO_SOL_CFG: Record<string, { label: string; cls: string }> = {
  PENDIENTE_APROBACION:   { label: 'En revisión',       cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APROBADO:               { label: 'Aprobado',          cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CORRECCIONES_SOLICITADAS:{ label: 'Correcciones',     cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  INVALIDADA:             { label: 'Invalidada',        cls: 'bg-slate-100 text-slate-400 border-slate-200' },
};

const ACCION_CFG: Record<string, { label: string; dot: string }> = {
  ACTUALIZACION:          { label: 'Actualización',     dot: 'bg-blue-400' },
  APROBACION:             { label: 'Aprobación',        dot: 'bg-emerald-500' },
  CORRECCIONES_SOLICITADAS:{ label: 'Correcciones',     dot: 'bg-orange-400' },
};

// ── Iconos ────────────────────────────────────────────────────────────────────

const IcClose = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IcSpinner = () => (
  <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-[#0f4c81] animate-spin" />
);

// ── Componente ────────────────────────────────────────────────────────────────

export function ModalHistorialPrograma({ materiaId, materiaNombre, onCerrar }: Props) {
  const [datos, setDatos] = useState<HistorialData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'circuito' | 'cambios'>('circuito');

  useEffect(() => {
    setCargando(true);
    apiFetch(`${API}/programas/materia/${materiaId}/historial`)
      .then(r => r.json())
      .then(d => setDatos(d))
      .catch(() => setError('No se pudo cargar el historial.'))
      .finally(() => setCargando(false));
  }, [materiaId]);

  const totalSolicitudes = datos?.solicitudes.length ?? 0;
  const totalCambios     = datos?.historial.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
              Historial del Programa
            </p>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
              {materiaNombre}
            </h2>
          </div>
          <button
            onClick={onCerrar}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 transition-colors ml-3 flex-shrink-0"
          >
            <IcClose />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-100 dark:border-slate-700 px-5">
          <button
            onClick={() => setTab('circuito')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              tab === 'circuito'
                ? 'border-[#0f4c81] text-[#0f4c81]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Solicitudes y conversaciones
            {totalSolicitudes > 0 && (
              <span className="ml-1.5 text-[9px] font-bold bg-[#0f4c81]/10 text-[#0f4c81] px-1.5 py-0.5 rounded-full">
                {totalSolicitudes}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('cambios')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              tab === 'cambios'
                ? 'border-[#0f4c81] text-[#0f4c81]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Registro de cambios
            {totalCambios > 0 && (
              <span className="ml-1.5 text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                {totalCambios}
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {cargando ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
              <IcSpinner /> <span className="text-sm">Cargando historial…</span>
            </div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-red-500">{error}</div>
          ) : tab === 'circuito' ? (
            <TabCircuito solicitudes={datos?.solicitudes ?? []} />
          ) : (
            <TabCambios historial={datos?.historial ?? []} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Solicitudes y conversaciones ─────────────────────────────────────────

function TabCircuito({ solicitudes }: { solicitudes: SolicitudHistorial[] }) {
  if (solicitudes.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-xs text-slate-400 italic">Sin solicitudes de aprobación registradas.</p>
      </div>
    );
  }

  const ordenadas = [...solicitudes].sort(
    (a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime(),
  );

  return (
    <div className="divide-y divide-slate-50 dark:divide-slate-700">
      {ordenadas.map((sol, idx) => {
        const cfg = ESTADO_SOL_CFG[sol.estado] ?? { label: sol.estado, cls: 'bg-slate-100 text-slate-500 border-slate-200' };
        return (
          <div key={sol.id} className="px-5 py-4">
            {/* Cabecera de la solicitud */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Solicitud #{ordenadas.length - idx}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Creada {fmtFecha(sol.fechaCreacion)}
                  {sol.aprobador && (
                    <span className="ml-1">
                      · Revisada por {sol.aprobador.apellido}, {sol.aprobador.nombre}
                      {sol.fechaResolucion && <> el {fmtFecha(sol.fechaResolucion)}</>}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Mensajes de la conversación */}
            {sol.mensajes.length > 0 && (
              <div className="ml-3 pl-3 border-l-2 border-slate-100 dark:border-slate-700 space-y-2 mt-3">
                {sol.mensajes.map(msg => (
                  <div key={msg.id} className={`rounded-lg px-3 py-2 text-xs ${
                    msg.tipo === 'CORRECCION'
                      ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-700/30'
                      : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-700/30'
                  }`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[9px] font-bold uppercase tracking-wide ${
                        msg.tipo === 'CORRECCION' ? 'text-orange-600' : 'text-blue-600'
                      }`}>
                        {msg.tipo === 'CORRECCION' ? 'Directivo' : 'Docente'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {msg.usuario.apellido}, {msg.usuario.nombre}
                        <span className="mx-1">·</span>
                        {fmtFecha(msg.fechaCreacion)}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {msg.contenido}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {sol.mensajes.length === 0 && sol.observaciones && (
              <div className="ml-3 pl-3 border-l-2 border-orange-100 mt-2">
                <p className="text-xs text-slate-600 dark:text-slate-300 italic">{sol.observaciones}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Registro de cambios ───────────────────────────────────────────────────

function TabCambios({ historial }: { historial: HistorialEntry[] }) {
  if (historial.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-xs text-slate-400 italic">Sin modificaciones registradas.</p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <div className="relative">
        {/* Línea vertical del timeline */}
        <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-600" />

        <div className="space-y-4">
          {historial.map(item => {
            const cfg = ACCION_CFG[item.accion] ?? { label: item.accion, dot: 'bg-slate-400' };
            return (
              <div key={item.id} className="flex gap-4 relative">
                {/* Punto en la línea */}
                <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 flex-shrink-0 ${cfg.dot}`} />

                <div className="ml-8 flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {cfg.label}
                        {item.seccion && (
                          <span className="text-slate-400 font-normal ml-1">— {item.seccion}</span>
                        )}
                      </span>
                      {item.descripcion && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {item.descripcion}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">
                      {fmtFecha(item.fecha)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {item.usuario.apellido}, {item.usuario.nombre}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
