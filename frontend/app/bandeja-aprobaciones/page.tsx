'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { useNotificaciones } from '@/lib/notificaciones-context';
import { ModalRechazar } from './_components/ModalRechazar';
import { ModalDetalle } from './_components/ModalDetalle';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Vinculacion {
  id: string;
  estado: string;
  observaciones?: string;
  fechaCreacion: string;
  fechaAprobacion?: string;
  motivoRechazo?: string;
  horasSemana?: number | null;
  anioInicio?: number | null;
  facultad:    { nombre: string };
  carrera:     { nombre: string };
  planEstudio: { nombre: string; codigo?: string };
  materia:     { nombre: string; codigo?: string };
  docente:     { nombre: string; apellido: string };
  catedra:     { nombre: string };
  cargo:       { nombre: string };
  modalidad:   { nombre: string };
  designacion: { nombre: string };
  usuarioSolicitante: { nombre: string; apellido: string };
  aprobador?: { nombre: string; apellido: string } | null;
}

interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  leida: boolean;
  fechaLectura?: string | null;
  vinculacionId?: string | null;
  fechaCreacion: string;
}

interface DatosNotificacion {
  resultado?: string;
  facultad?: string;
  carrera?: string;
  plan?: string;
  asignatura?: string;
  catedra?: string;
  cargo?: string;
  modalidad?: string;
  designacion?: string;
  horasSemana?: number | null;
  anioInicio?: number | null;
  fechaAprobacion?: string;
  fechaRechazo?: string;
  fechaDesvinculacion?: string;
  motivo?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const ESTADO_MAP: Record<string, { label: string; cls: string }> = {
  PENDIENTE_DE_APROBACION: { label: 'Pendiente',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APROBADA:                { label: 'Aprobada',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  RECHAZADA:               { label: 'Rechazada',    cls: 'bg-red-50 text-red-700 border-red-200' },
  DESVINCULADA:            { label: 'Desvinculada', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  INACTIVA:                { label: 'Inactiva',     cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function BadgeEstado({ estado }: { estado: string }) {
  const { label, cls } = ESTADO_MAP[estado] ?? { label: estado, cls: 'bg-slate-100 text-slate-500 border-slate-200' };
  return <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>{label}</span>;
}

function formatFecha(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatFechaHora(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function parsarDatos(cuerpo: string): DatosNotificacion {
  try { return JSON.parse(cuerpo); } catch { return {}; }
}

// ── Iconos ────────────────────────────────────────────────────────────────────

const IcCheck = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const IcX = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IcXModal = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IcEye = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const IcSpinner = () => (
  <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
);
const IcBell = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

// ── Campo de detalle (modal informativa) ──────────────────────────────────────

function Campo({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">
        {valor ?? <span className="text-slate-400 italic text-xs font-normal">—</span>}
      </dd>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function BandejaAprobacionesPage() {
  const { usuario } = useAuth();
  const { recargarContador }            = useNotificaciones();

  const rolNombre = usuario?.rol?.nombre ?? '';
  const esAdmin   = rolNombre === 'ADMINISTRADOR_SISTEMA';
  const esDocente = rolNombre === 'DOCENTE';

  // ── Estado compartido ──────────────────────────────────────────────────────
  const [vinculaciones, setVinculaciones] = useState<Vinculacion[]>([]);
  const [cargando, setCargando]           = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  // ── Estado DOCENTE ─────────────────────────────────────────────────────────
  const [notificaciones, setNotificaciones]   = useState<Notificacion[]>([]);
  const [verNotif, setVerNotif]               = useState<Notificacion | null>(null);
  const [marcandoNotifId, setMarcandoNotifId] = useState<string | null>(null);
  const [paginaNotif, setPaginaNotif]         = useState(1);

  // ── Estado ADMIN ───────────────────────────────────────────────────────────
  const [buscar, setBuscar]   = useState('');
  const [estado, setEstado]   = useState('');

  // ── Modales compartidos ────────────────────────────────────────────────────
  const [detalle, setDetalle]           = useState<Vinculacion | null>(null);
  const [rechazarTarget, setRechazarTarget] = useState<Vinculacion | null>(null);
  const [accionandoId, setAccionandoId] = useState<string | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function mostrarToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Carga de vinculaciones ─────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (!esDocente && estado) params.set('estado', estado);

      const res = await apiFetch(`${API}/vinculaciones-catedra?${params}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setVinculaciones(Array.isArray(data) ? data : (data.data ?? []));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [esDocente, estado]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Carga de notificaciones (solo DOCENTE) ─────────────────────────────────
  const cargarNotificaciones = useCallback(async () => {
    if (!esDocente) return;
    try {
      const res = await apiFetch(`${API}/notificaciones`);
      if (res.ok) setNotificaciones(await res.json());
    } catch { /* silencioso */ }
  }, [esDocente]);

  useEffect(() => { cargarNotificaciones(); }, [cargarNotificaciones]);

  // ── Acciones ───────────────────────────────────────────────────────────────

  async function aprobar(v: Vinculacion) {
    if (!window.confirm(`¿Aprobar la vinculación de ${v.docente.apellido}, ${v.docente.nombre} para "${v.materia.nombre}"?`)) return;
    setAccionandoId(v.id);
    try {
      const res = await apiFetch(`${API}/vinculaciones-catedra/${v.id}/aprobar`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Error ${res.status}`);
      }
      mostrarToast('Vinculación aprobada correctamente.');
      await Promise.all([cargar(), cargarNotificaciones()]);
      await recargarContador();
    } catch (e) {
      mostrarToast((e as Error).message, false);
    } finally {
      setAccionandoId(null);
    }
  }

  async function rechazar(v: Vinculacion, motivo: string) {
    const res = await apiFetch(`${API}/vinculaciones-catedra/${v.id}/rechazar`, {
      method: 'PATCH',
      body: JSON.stringify({ motivo }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? `Error ${res.status}`);
    }
    setRechazarTarget(null);
    mostrarToast('Vinculación rechazada.');
    await Promise.all([cargar(), cargarNotificaciones()]);
    await recargarContador();
  }

  async function abrirNotificacion(n: Notificacion) {
    setVerNotif(n);
    if (!n.leida) {
      setMarcandoNotifId(n.id);
      try {
        const res = await apiFetch(`${API}/notificaciones/${n.id}/leer`, {
          method: 'PATCH',
        });
        if (res.ok) {
          setNotificaciones(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x));
          setVerNotif(prev => prev ? { ...prev, leida: true } : prev);
          await recargarContador();
        }
      } finally {
        setMarcandoNotifId(null);
      }
    }
  }

  // ── Derivados ADMIN ────────────────────────────────────────────────────────
  const filtradas = vinculaciones.filter(v => {
    if (!buscar.trim()) return true;
    const q = buscar.toLowerCase();
    return (
      v.docente.apellido.toLowerCase().includes(q) ||
      v.docente.nombre.toLowerCase().includes(q)   ||
      v.materia.nombre.toLowerCase().includes(q)   ||
      v.carrera.nombre.toLowerCase().includes(q)   ||
      v.facultad.nombre.toLowerCase().includes(q)  ||
      v.catedra.nombre.toLowerCase().includes(q)
    );
  });

  // ── Derivados DOCENTE ──────────────────────────────────────────────────────
  const pendientes    = vinculaciones.filter(v => v.estado === 'PENDIENTE_DE_APROBACION');
  const noLeidas      = notificaciones.filter(n => !n.leida).length;
  const totalNovedades = pendientes.length + noLeidas;

  const NOTIF_POR_PAG     = 10;
  const totalPaginasNotif = Math.ceil(notificaciones.length / NOTIF_POR_PAG);
  const notifsPagina      = notificaciones.slice((paginaNotif - 1) * NOTIF_POR_PAG, paginaNotif * NOTIF_POR_PAG);

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA DOCENTE
  // ══════════════════════════════════════════════════════════════════════════

  if (esDocente) {
    return (
      <div className="p-6 sm:p-8 max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-7">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-bold text-slate-800">Bandeja de Aprobaciones</h1>
            {totalNovedades > 0 && (
              <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                {totalNovedades} novedad{totalNovedades !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">Novedades de tu actividad académica en UDEMM.</p>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
            <IcSpinner /> <span className="text-sm">Cargando…</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
        ) : (
          <div className="space-y-6">

            {/* ── SECCIÓN 1: Pendientes de acción ── */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Pendientes de acción</span>
                  {pendientes.length > 0 && (
                    <span className="text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                      {pendientes.length}
                    </span>
                  )}
                </div>
              </div>

              {pendientes.length === 0 ? (
                <div className="flex items-center gap-3 px-5 py-6 text-slate-400">
                  <svg className="w-4 h-4 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm">Sin solicitudes pendientes de resolución.</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {pendientes.map(v => (
                    <div key={v.id} className="px-5 py-4 hover:bg-amber-50/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 leading-snug mb-1">
                            {v.materia.nombre}
                            {v.materia.codigo && <span className="ml-1.5 text-[10px] font-normal text-slate-400">{v.materia.codigo}</span>}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                            <span>{v.carrera.nombre} · {v.planEstudio.nombre}</span>
                            <span>{v.catedra.nombre} · {v.cargo.nombre}</span>
                            {v.horasSemana != null && <span>{v.horasSemana} h/sem</span>}
                            {v.anioInicio   != null && <span>Año {v.anioInicio}</span>}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1.5">{formatFecha(v.fechaCreacion)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                          <button
                            onClick={() => setDetalle(v)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <IcEye /><span className="hidden sm:inline">Ver</span>
                          </button>
                          <button
                            onClick={() => aprobar(v)}
                            disabled={accionandoId === v.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                          >
                            {accionandoId === v.id ? <IcSpinner /> : <IcCheck />}
                            <span className="hidden sm:inline">Aprobar</span>
                          </button>
                          <button
                            onClick={() => setRechazarTarget(v)}
                            disabled={accionandoId === v.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            <IcX /><span className="hidden sm:inline">Rechazar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── SECCIÓN 2: Notificaciones ── */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <IcBell />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Notificaciones</span>
                  {noLeidas > 0 && (
                    <span className="text-[9px] font-bold bg-[#0f4c81] text-white px-1.5 py-0.5 rounded-full">
                      {noLeidas} sin leer
                    </span>
                  )}
                </div>
              </div>

              {notificaciones.length === 0 ? (
                <div className="flex items-center gap-3 px-5 py-6 text-slate-400">
                  <IcBell />
                  <span className="text-sm">Sin notificaciones.</span>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-50">
                    {notifsPagina.map(n => (
                      <div
                        key={n.id}
                        className={`flex items-center justify-between gap-3 px-5 py-3 transition-colors ${
                          !n.leida ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="flex-shrink-0 mt-1">
                            {!n.leida
                              ? <span className="block w-2 h-2 rounded-full bg-[#0f4c81]" />
                              : <span className="block w-2 h-2 rounded-full bg-slate-200" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm leading-snug ${!n.leida ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                              {n.titulo}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{formatFechaHora(n.fechaCreacion)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!n.leida
                            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0f4c81]/10 text-[#0f4c81] border border-[#0f4c81]/20 whitespace-nowrap">No leída</span>
                            : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 whitespace-nowrap">Leída</span>
                          }
                          <button
                            onClick={() => abrirNotificacion(n)}
                            disabled={marcandoNotifId === n.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                          >
                            <IcEye /><span className="hidden sm:inline">Ver</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalPaginasNotif > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                      <span className="text-xs text-slate-400">
                        Página {paginaNotif} de {totalPaginasNotif} · {notificaciones.length} registros
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setPaginaNotif(p => Math.max(1, p - 1))}
                          disabled={paginaNotif === 1}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          ← Anterior
                        </button>
                        <button
                          onClick={() => setPaginaNotif(p => Math.min(totalPaginasNotif, p + 1))}
                          disabled={paginaNotif === totalPaginasNotif}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Siguiente →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

          </div>
        )}

        {/* Modal detalle vinculación */}
        {detalle && <ModalDetalle vinculacion={detalle} onCerrar={() => setDetalle(null)} />}

        {/* Modal rechazar */}
        {rechazarTarget && (
          <ModalRechazar
            asignatura={rechazarTarget.materia.nombre}
            docente={`${rechazarTarget.docente.apellido}, ${rechazarTarget.docente.nombre}`}
            onConfirmar={motivo => rechazar(rechazarTarget, motivo)}
            onCerrar={() => setRechazarTarget(null)}
          />
        )}

        {/* Modal notificación (aprobación / rechazo / desvinculación) */}
        {verNotif && (() => {
          const datos = parsarDatos(verNotif.cuerpo);
          const tipo  = verNotif.tipo;

          const badgeCfg: Record<string, { label: string; cls: string }> = {
            APROBACION:    { label: 'Aprobación',    cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            RECHAZO:       { label: 'Rechazo',       cls: 'text-red-700 bg-red-50 border-red-200' },
            DESVINCULACION:{ label: 'Desvinculación', cls: 'text-[#0f4c81] bg-[#0f4c81]/10 border-[#0f4c81]/20' },
          };
          const { label: tipoLabel, cls: tipoCls } =
            badgeCfg[tipo] ?? { label: tipo, cls: 'text-slate-600 bg-slate-100 border-slate-200' };

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

                <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${tipoCls}`}>
                        {tipoLabel}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatFechaHora(verNotif.fechaCreacion)}</span>
                    </div>
                    <h2 className="text-sm font-bold text-slate-800 leading-snug">{verNotif.titulo}</h2>
                  </div>
                  <button
                    onClick={() => setVerNotif(null)}
                    className="flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <IcXModal />
                  </button>
                </div>

                <div className="overflow-y-auto px-6 py-5 flex-1">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">

                    {/* Resultado — siempre al tope cuando existe */}
                    {datos.resultado && (
                      <div className="sm:col-span-2">
                        <span className={`inline-flex text-[11px] font-bold px-3 py-1 rounded-full border ${
                          datos.resultado.includes('APROBADA')  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          datos.resultado.includes('RECHAZADA') ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {datos.resultado}
                        </span>
                      </div>
                    )}

                    {/* Campos académicos comunes */}
                    {(tipo === 'APROBACION' || tipo === 'RECHAZO') && (
                      <Campo label="Facultad" valor={datos.facultad} />
                    )}
                    <Campo label="Carrera"    valor={datos.carrera} />
                    <Campo label="Plan"       valor={datos.plan} />
                    <Campo label="Asignatura" valor={datos.asignatura} />
                    <Campo label="Cátedra"    valor={datos.catedra} />
                    <Campo label="Cargo"      valor={datos.cargo} />
                    {(tipo === 'APROBACION' || tipo === 'RECHAZO') && (
                      <>
                        <Campo label="Modalidad"   valor={datos.modalidad} />
                        <Campo label="Designación" valor={datos.designacion} />
                      </>
                    )}

                    {/* Campos exclusivos de APROBACION */}
                    {tipo === 'APROBACION' && (
                      <>
                        <Campo label="Horas semanales" valor={datos.horasSemana != null ? `${datos.horasSemana} h/sem` : undefined} />
                        <Campo label="Año de inicio"   valor={datos.anioInicio   != null ? String(datos.anioInicio)    : undefined} />
                        <Campo label="Fecha y hora de aprobación" valor={formatFechaHora(datos.fechaAprobacion)} />
                      </>
                    )}

                    {/* Campos exclusivos de RECHAZO */}
                    {tipo === 'RECHAZO' && (
                      <Campo label="Fecha y hora del rechazo" valor={formatFechaHora(datos.fechaRechazo)} />
                    )}

                    {/* Campos exclusivos de DESVINCULACION */}
                    {tipo === 'DESVINCULACION' && (
                      <Campo label="Fecha de desvinculación" valor={formatFecha(datos.fechaDesvinculacion)} />
                    )}

                    {/* Motivo — RECHAZO y DESVINCULACION (sin truncar) */}
                    {(tipo === 'RECHAZO' || tipo === 'DESVINCULACION') && datos.motivo && (
                      <div className="sm:col-span-2">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Motivo</dt>
                        <dd className="text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                          {datos.motivo}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <p className="text-[11px] text-slate-400 italic mt-4 pt-3 border-t border-slate-100">
                    Esta notificación es únicamente informativa. No requiere acción de tu parte.
                  </p>
                </div>

                <div className="flex justify-end px-6 py-4 border-t border-slate-100 flex-shrink-0">
                  <button
                    onClick={() => setVerNotif(null)}
                    className="px-5 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold ${
            toast.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            {toast.ok
              ? <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            }
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA ADMIN (sin cambios respecto al diseño original)
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="p-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Bandeja de Aprobaciones</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Gestioná las solicitudes de vinculación docente-cátedra pendientes de resolución.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            placeholder="Buscar…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15 transition bg-white"
          />
        </div>
        <select
          value={estado}
          onChange={e => setEstado(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white text-slate-700"
        >
          <option value="">Todos los estados</option>
          <option value="PENDIENTE_DE_APROBACION">Pendiente</option>
          <option value="APROBADA">Aprobada</option>
          <option value="RECHAZADA">Rechazada</option>
          <option value="DESVINCULADA">Desvinculada</option>
          <option value="INACTIVA">Inactiva</option>
        </select>
        <span className="ml-auto text-xs text-slate-400 font-medium">
          {filtradas.length} registro{filtradas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {cargando ? (
          <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
            <IcSpinner /><span className="text-sm">Cargando…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <p className="text-sm text-red-500 font-medium">{error}</p>
            <button onClick={cargar} className="px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition">Reintentar</button>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-2">
            <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No hay vinculaciones para mostrar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Docente</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Asignatura</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Carrera</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Cátedra</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Cargo</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3 hidden lg:table-cell">H/SEM · Año</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Estado</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Fecha solicitud</th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtradas.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                      {v.docente.apellido}, {v.docente.nombre}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px]">
                      <span className="truncate block">{v.materia.nombre}</span>
                      {v.materia.codigo && <span className="text-[10px] text-slate-400">{v.materia.codigo}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[160px]">
                      <span className="truncate block text-xs">{v.carrera.nombre}</span>
                      <span className="text-[10px] text-slate-400">{v.facultad.nombre}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{v.catedra.nombre}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{v.cargo.nombre}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-slate-700 font-medium text-xs">
                        {v.horasSemana != null ? `${v.horasSemana} h/sem` : <span className="text-slate-400 italic">—</span>}
                      </span>
                      <span className="block text-[10px] text-slate-400">{v.anioInicio ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3"><BadgeEstado estado={v.estado} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatFecha(v.fechaCreacion)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setDetalle(v)}
                          title="Ver detalle"
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <IcEye /><span className="hidden sm:inline">Ver</span>
                        </button>
                        {v.estado === 'PENDIENTE_DE_APROBACION' && (
                          <>
                            <button
                              onClick={() => aprobar(v)}
                              disabled={accionandoId === v.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                            >
                              {accionandoId === v.id ? <IcSpinner /> : <IcCheck />}
                              <span className="hidden sm:inline">Aprobar</span>
                            </button>
                            <button
                              onClick={() => setRechazarTarget(v)}
                              disabled={accionandoId === v.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              <IcX /><span className="hidden sm:inline">Rechazar</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {detalle && <ModalDetalle vinculacion={detalle} onCerrar={() => setDetalle(null)} />}

      {/* Modal rechazar */}
      {rechazarTarget && (
        <ModalRechazar
          asignatura={rechazarTarget.materia.nombre}
          docente={`${rechazarTarget.docente.apellido}, ${rechazarTarget.docente.nombre}`}
          onConfirmar={motivo => rechazar(rechazarTarget, motivo)}
          onCerrar={() => setRechazarTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold ${
          toast.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {toast.ok
            ? <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          }
          {toast.msg}
        </div>
      )}
    </div>
  );
}
