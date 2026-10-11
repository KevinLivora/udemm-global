'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { useNotificaciones } from '@/lib/notificaciones-context';
import { ModalRechazar } from './_components/ModalRechazar';
import { ModalDetalle } from './_components/ModalDetalle';
import { ModalCorrecciones } from './_components/ModalCorrecciones';
import { ModalConversacion, SolicitudConversacion } from './_components/ModalConversacion';
import { ModalHistorialPrograma } from './_components/ModalHistorialPrograma';

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

interface SolicitudPrograma {
  id: string;
  estado: string;
  fechaCreacion: string;
  fechaResolucion?: string | null;
  observaciones?: string | null;
  aprobador?: { id: string; nombre: string; apellido: string } | null;
  programa: {
    id: string;
    materiaId: string;
    estadoPrograma: string;
    materia: {
      id: string;
      nombre: string;
      codigo: string;
      planEstudio: {
        nombre: string;
        carrera: {
          nombre: string;
          facultad: { nombre: string };
        };
      };
    };
  };
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

interface CorreccionDocente extends SolicitudConversacion {
  fechaCreacion: string;
  mensajesNoLeidos: number;
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
  // Correcciones y aprobación de programa
  solicitudId?: string;
  materiaId?: string;
  materia?: string;
  directivo?: string;
  rolDirectivo?: string;
  observaciones?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const ROLES_APROBADOR_PROGRAMA = ['SECRETARIA_ACADEMICA', 'DIRECTOR_CARRERA', 'DECANO', 'RECTORADO'];

const ITEMS_PAG = 10;

const ESTADO_MAP: Record<string, { label: string; cls: string }> = {
  PENDIENTE_DE_APROBACION: { label: 'Pendiente',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APROBADA:                { label: 'Aprobada',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  RECHAZADA:               { label: 'Rechazada',    cls: 'bg-red-50 text-red-700 border-red-200' },
  DESVINCULADA:            { label: 'Desvinculada', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  INACTIVA:                { label: 'Inactiva',     cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const ESTADO_SOLICITUD_MAP: Record<string, { label: string; cls: string }> = {
  PENDIENTE_APROBACION:      { label: 'Pendiente de aprobación', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APROBADO:                  { label: 'Aprobado',                cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CORRECCIONES_SOLICITADAS:  { label: 'Correcciones solicitadas', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  INVALIDADA:                { label: 'Invalidada',              cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function BadgeEstado({ estado }: { estado: string }) {
  const { label, cls } = ESTADO_MAP[estado] ?? { label: estado, cls: 'bg-slate-100 text-slate-500 border-slate-200' };
  return <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>{label}</span>;
}

function BadgeSolicitud({ estado }: { estado: string }) {
  const { label, cls } = ESTADO_SOLICITUD_MAP[estado] ?? { label: estado, cls: 'bg-slate-100 text-slate-500 border-slate-200' };
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
const IcDoc = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const IcChat = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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
  const { recargarContador } = useNotificaciones();

  const rolNombre = usuario?.rol?.nombre ?? '';
  const esAdmin   = rolNombre === 'ADMINISTRADOR_SISTEMA';
  const esDocente = rolNombre === 'DOCENTE';
  const esProgramaAprobador = ROLES_APROBADOR_PROGRAMA.includes(rolNombre);

  // ── Estado compartido ──────────────────────────────────────────────────────
  const [vinculaciones, setVinculaciones] = useState<Vinculacion[]>([]);
  const [cargando, setCargando]           = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  // ── Estado solicitudes programa ────────────────────────────────────────────
  const [solicitudesPrograma, setSolicitudesPrograma]         = useState<SolicitudPrograma[]>([]);
  const [cargandoSolicitudes, setCargandoSolicitudes]         = useState(false);
  const [errorSolicitudes, setErrorSolicitudes]               = useState<string | null>(null);
  const [accionandoSolicitudId, setAccionandoSolicitudId]     = useState<string | null>(null);
  const [correccionesTarget, setCorreccionesTarget]           = useState<SolicitudPrograma | null>(null);
  const [filtroProgramas, setFiltroProgramas]                 = useState('PENDIENTE_APROBACION');
  const [paginaSolicitudes, setPaginaSolicitudes]             = useState(1);
  const [paginaVinculaciones, setPaginaVinculaciones]         = useState(1);

  // ── Estado DOCENTE ─────────────────────────────────────────────────────────
  const [notificaciones, setNotificaciones]   = useState<Notificacion[]>([]);
  const [verNotif, setVerNotif]               = useState<Notificacion | null>(null);
  const [marcandoNotifId, setMarcandoNotifId] = useState<string | null>(null);
  const [paginaNotif, setPaginaNotif]         = useState(1);

  // ── Estado correcciones DOCENTE ────────────────────────────────────────────
  const [correccionesDocente, setCorreccionesDocente]   = useState<CorreccionDocente[]>([]);
  const [cargandoCorrecciones, setCargandoCorrecciones] = useState(false);

  // ── Modal conversación (DOCENTE y aprobadores) ─────────────────────────────
  const [conversacionTarget, setConversacionTarget]     = useState<SolicitudConversacion | null>(null);
  const [historialTarget, setHistorialTarget]           = useState<{ materiaId: string; materiaNombre: string } | null>(null);

  // ── Estado ADMIN/Directivos ────────────────────────────────────────────────
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('');

  // ── Modales compartidos ────────────────────────────────────────────────────
  const [detalle, setDetalle]               = useState<Vinculacion | null>(null);
  const [rechazarTarget, setRechazarTarget] = useState<Vinculacion | null>(null);
  const [accionandoId, setAccionandoId]     = useState<string | null>(null);

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

  // ── Carga de solicitudes de programas (solo aprobadores) ───────────────────
  const cargarSolicitudesPrograma = useCallback(async () => {
    if (!esProgramaAprobador) return;
    setCargandoSolicitudes(true);
    setErrorSolicitudes(null);
    try {
      const res = await apiFetch(`${API}/programas/solicitudes`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setSolicitudesPrograma(Array.isArray(data) ? data : []);
    } catch (e) {
      setErrorSolicitudes((e as Error).message);
    } finally {
      setCargandoSolicitudes(false);
    }
  }, [esProgramaAprobador]);

  useEffect(() => { cargarSolicitudesPrograma(); }, [cargarSolicitudesPrograma]);

  // Resetear a página 1 cuando cambia el filtro de programas
  useEffect(() => { setPaginaSolicitudes(1); }, [filtroProgramas]);
  // Clamp: evita página vacía cuando se resuelven solicitudes
  useEffect(() => {
    const max = Math.max(1, Math.ceil(solicitudesPrograma.length / ITEMS_PAG));
    setPaginaSolicitudes(p => (p > max ? max : p));
  }, [solicitudesPrograma]);

  // Resetear a página 1 cuando cambian filtros de vinculaciones
  useEffect(() => { setPaginaVinculaciones(1); }, [buscar, estado]);
  // Clamp vinculaciones
  useEffect(() => {
    const max = Math.max(1, Math.ceil(vinculaciones.length / ITEMS_PAG));
    setPaginaVinculaciones(p => (p > max ? max : p));
  }, [vinculaciones]);

  // ── Carga de notificaciones (solo DOCENTE) ─────────────────────────────────
  const cargarNotificaciones = useCallback(async () => {
    if (!esDocente) return;
    try {
      const res = await apiFetch(`${API}/notificaciones`);
      if (res.ok) setNotificaciones(await res.json());
    } catch { /* silencioso */ }
  }, [esDocente]);

  useEffect(() => { cargarNotificaciones(); }, [cargarNotificaciones]);

  const cargarCorreccionesDocente = useCallback(async () => {
    if (!esDocente) return;
    setCargandoCorrecciones(true);
    try {
      const res = await apiFetch(`${API}/programas/solicitudes/correcciones-docente`);
      if (res.ok) setCorreccionesDocente(await res.json());
    } catch { /* silencioso */ }
    finally { setCargandoCorrecciones(false); }
  }, [esDocente]);

  useEffect(() => { cargarCorreccionesDocente(); }, [cargarCorreccionesDocente]);

  // ── Acciones vinculaciones ─────────────────────────────────────────────────

  async function aprobar(v: Vinculacion) {
    if (!window.confirm(`¿Aprobar la vinculación de ${v.docente.apellido}, ${v.docente.nombre} para "${v.materia.nombre}"?`)) return;
    setAccionandoId(v.id);
    try {
      const res = await apiFetch(`${API}/vinculaciones-catedra/${v.id}/aprobar`, { method: 'PATCH' });
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

  // ── Acciones programas ─────────────────────────────────────────────────────

  async function aprobarPrograma(s: SolicitudPrograma) {
    const materia = s.programa.materia.nombre;
    if (!window.confirm(`¿Aprobar el programa de "${materia}"?`)) return;
    setAccionandoSolicitudId(s.id);
    try {
      const res = await apiFetch(`${API}/programas/solicitudes/${s.id}/aprobar`, { method: 'PATCH' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Error ${res.status}`);
      }
      mostrarToast(`Programa de "${materia}" aprobado correctamente.`);
      await cargarSolicitudesPrograma();
      await recargarContador();
    } catch (e) {
      mostrarToast((e as Error).message, false);
    } finally {
      setAccionandoSolicitudId(null);
    }
  }

  async function enviarCorrecciones(s: SolicitudPrograma, observaciones: string) {
    const res = await apiFetch(`${API}/programas/solicitudes/${s.id}/solicitar-correcciones`, {
      method: 'PATCH',
      body: JSON.stringify({ observaciones }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? `Error ${res.status}`);
    }
    setCorreccionesTarget(null);
    mostrarToast('Correcciones solicitadas correctamente.');
    await cargarSolicitudesPrograma();
    await recargarContador();
  }

  async function abrirNotificacion(n: Notificacion) {
    setVerNotif(n);
    if (!n.leida) {
      setMarcandoNotifId(n.id);
      try {
        const res = await apiFetch(`${API}/notificaciones/${n.id}/leer`, { method: 'PATCH' });
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

  // ── Derivados ──────────────────────────────────────────────────────────────
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

  const solicitudasFiltradas = solicitudesPrograma
    .filter(s => !filtroProgramas || s.estado === filtroProgramas)
    .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());

  const totalPagsSolicitudes = Math.max(1, Math.ceil(solicitudasFiltradas.length / ITEMS_PAG));
  const solicitudesPagina    = solicitudasFiltradas.slice(
    (paginaSolicitudes - 1) * ITEMS_PAG, paginaSolicitudes * ITEMS_PAG
  );

  const totalPagsVinc     = Math.max(1, Math.ceil(filtradas.length / ITEMS_PAG));
  const vinculacionesPagina = filtradas.slice(
    (paginaVinculaciones - 1) * ITEMS_PAG, paginaVinculaciones * ITEMS_PAG
  );

  const pendientes     = vinculaciones.filter(v => v.estado === 'PENDIENTE_DE_APROBACION');
  const noLeidas       = notificaciones.filter(n => !n.leida).length;
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
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Bandeja de Aprobaciones</h1>
            {totalNovedades > 0 && (
              <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                {totalNovedades} novedad{totalNovedades !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Novedades de tu actividad académica en UDEMM.</p>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
            <IcSpinner /> <span className="text-sm">Cargando…</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 text-red-700 dark:text-red-300 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
        ) : (
          <div className="space-y-6">

            {/* ── SECCIÓN 1: Pendientes de acción ── */}
            <section className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Pendientes de acción</span>
                  {pendientes.length > 0 && (
                    <span className="text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">{pendientes.length}</span>
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
                <div className="divide-y divide-slate-50 dark:divide-slate-700">
                  {pendientes.map(v => (
                    <div key={v.id} className="px-5 py-4 hover:bg-amber-50/20 dark:hover:bg-amber-900/10 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug mb-1">
                            {v.materia.nombre}
                            {v.materia.codigo && <span className="ml-1.5 text-[10px] font-normal text-slate-400">{v.materia.codigo}</span>}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{v.carrera.nombre} · {v.planEstudio.nombre}</span>
                            <span>{v.catedra.nombre} · {v.cargo.nombre}</span>
                            {v.horasSemana != null && <span>{v.horasSemana} h/sem</span>}
                            {v.anioInicio   != null && <span>Año {v.anioInicio}</span>}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1.5">{formatFecha(v.fechaCreacion)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                          <button onClick={() => setDetalle(v)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <IcEye /><span className="hidden sm:inline">Ver</span>
                          </button>
                          <button onClick={() => aprobar(v)} disabled={accionandoId === v.id} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50">
                            {accionandoId === v.id ? <IcSpinner /> : <IcCheck />}
                            <span className="hidden sm:inline">Aprobar</span>
                          </button>
                          <button onClick={() => setRechazarTarget(v)} disabled={accionandoId === v.id} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">
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
            <section className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80">
                <div className="flex items-center gap-2">
                  <IcBell />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Notificaciones</span>
                  {noLeidas > 0 && (
                    <span className="text-[9px] font-bold bg-[#0f4c81] text-white px-1.5 py-0.5 rounded-full">{noLeidas} sin leer</span>
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
                  <div className="divide-y divide-slate-50 dark:divide-slate-700">
                    {notifsPagina.map(n => (
                      <div key={n.id} className={`flex items-center justify-between gap-3 px-5 py-3 transition-colors ${!n.leida ? 'bg-blue-50/30 dark:bg-blue-900/10 hover:bg-blue-50/50 dark:hover:bg-blue-900/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-700/30'}`}>
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="flex-shrink-0 mt-1">
                            {!n.leida
                              ? <span className="block w-2 h-2 rounded-full bg-[#0f4c81]" />
                              : <span className="block w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-600" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm leading-snug ${!n.leida ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>{n.titulo}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{formatFechaHora(n.fechaCreacion)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!n.leida
                            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0f4c81]/10 text-[#0f4c81] border border-[#0f4c81]/20 whitespace-nowrap">No leída</span>
                            : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 border border-slate-200 dark:border-slate-600 whitespace-nowrap">Leída</span>
                          }
                          <button onClick={() => abrirNotificacion(n)} disabled={marcandoNotifId === n.id} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                            <IcEye /><span className="hidden sm:inline">Ver</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalPaginasNotif > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                      <span className="text-xs text-slate-400">Página {paginaNotif} de {totalPaginasNotif} · {notificaciones.length} registros</span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setPaginaNotif(p => Math.max(1, p - 1))} disabled={paginaNotif === 1} className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">← Anterior</button>
                        <button onClick={() => setPaginaNotif(p => Math.min(totalPaginasNotif, p + 1))} disabled={paginaNotif === totalPaginasNotif} className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Siguiente →</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ── SECCIÓN 3: Correcciones en programas ── */}
            {(cargandoCorrecciones || correccionesDocente.length > 0) && (
              <section className="bg-white dark:bg-slate-800/60 rounded-2xl border border-orange-100 dark:border-orange-700/30 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-orange-100 dark:border-orange-700/30 bg-orange-50/60 dark:bg-orange-900/10">
                  <IcChat />
                  <span className="text-xs font-bold uppercase tracking-widest text-orange-700 dark:text-orange-400">Correcciones en programas</span>
                  {correccionesDocente.some(c => c.mensajesNoLeidos > 0) && (
                    <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                      {correccionesDocente.reduce((acc, c) => acc + c.mensajesNoLeidos, 0)} sin leer
                    </span>
                  )}
                </div>
                {cargandoCorrecciones ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
                    <IcSpinner /> <span className="text-sm">Cargando…</span>
                  </div>
                ) : (
                  <div className="divide-y divide-orange-50 dark:divide-slate-700">
                    {correccionesDocente.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                            {c.programa.materia.nombre}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {c.programa.materia.planEstudio.carrera.nombre} · {c.programa.materia.planEstudio.nombre}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">{formatFecha(c.fechaCreacion)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {c.mensajesNoLeidos > 0 && (
                            <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                              {c.mensajesNoLeidos}
                            </span>
                          )}
                          <button
                            onClick={() => setConversacionTarget(c)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-600/40 bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
                          >
                            <IcChat />
                            <span>Ver conversación</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {detalle && <ModalDetalle vinculacion={detalle} onCerrar={() => setDetalle(null)} />}
        {rechazarTarget && (
          <ModalRechazar
            asignatura={rechazarTarget.materia.nombre}
            docente={`${rechazarTarget.docente.apellido}, ${rechazarTarget.docente.nombre}`}
            onConfirmar={motivo => rechazar(rechazarTarget, motivo)}
            onCerrar={() => setRechazarTarget(null)}
          />
        )}
        {conversacionTarget && (
          <ModalConversacion
            solicitud={conversacionTarget}
            rolUsuario={rolNombre}
            onCerrar={() => {
              setConversacionTarget(null);
              cargarCorreccionesDocente();
              cargarNotificaciones();
              recargarContador();
            }}
            onMensajeEnviado={() => { cargarCorreccionesDocente(); }}
          />
        )}
        {verNotif && (() => {
          const datos = parsarDatos(verNotif.cuerpo);
          const tipo  = verNotif.tipo;
          const badgeCfg: Record<string, { label: string; cls: string }> = {
            APROBACION:                  { label: 'Aprobación',             cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            RECHAZO:                     { label: 'Rechazo',                cls: 'text-red-700 bg-red-50 border-red-200' },
            DESVINCULACION:              { label: 'Desvinculación',         cls: 'text-[#0f4c81] bg-[#0f4c81]/10 border-[#0f4c81]/20' },
            CORRECCIONES_PROGRAMA:       { label: 'Corrección de programa', cls: 'text-orange-700 bg-orange-50 border-orange-200' },
            APROBACION_PROGRAMA:         { label: 'Programa aprobado',      cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            NUEVA_SOLICITUD_APROBACION:  { label: 'Nueva solicitud',        cls: 'text-amber-700 bg-amber-50 border-amber-200' },
            RESPUESTA_DOCENTE:           { label: 'Respuesta del docente',  cls: 'text-blue-700 bg-blue-50 border-blue-200' },
          };
          const { label: tipoLabel, cls: tipoCls } = badgeCfg[tipo] ?? { label: tipo, cls: 'text-slate-600 bg-slate-100 border-slate-200' };
          const esCorreccionPrograma  = tipo === 'CORRECCIONES_PROGRAMA';
          const esAprobacionPrograma  = tipo === 'APROBACION_PROGRAMA';
          const esInfoPura = !esCorreccionPrograma && !esAprobacionPrograma;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${tipoCls}`}>{tipoLabel}</span>
                      <span className="text-[10px] text-slate-400">{formatFechaHora(verNotif.fechaCreacion)}</span>
                    </div>
                    <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">{verNotif.titulo}</h2>
                  </div>
                  <button onClick={() => setVerNotif(null)} className="flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"><IcXModal /></button>
                </div>
                <div className="overflow-y-auto px-6 py-5 flex-1">
                  {esAprobacionPrograma ? (
                    <div className="space-y-4">
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <Campo label="Asignatura" valor={datos.materia} />
                        <Campo label="Carrera" valor={datos.carrera} />
                        <Campo label="Plan" valor={datos.plan} />
                        <Campo label="Aprobado por" valor={datos.directivo ? `${datos.directivo} (${datos.rolDirectivo ?? ''})` : undefined} />
                        <Campo label="Fecha de aprobación" valor={formatFechaHora(datos.fechaAprobacion)} />
                      </dl>
                    </div>
                  ) : esCorreccionPrograma ? (
                    <div className="space-y-4">
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <Campo label="Asignatura" valor={datos.materia} />
                        <Campo label="Carrera" valor={datos.carrera} />
                        <Campo label="Plan" valor={datos.plan} />
                        <Campo label="Solicitado por" valor={datos.directivo ? `${datos.directivo} (${datos.rolDirectivo ?? ''})` : undefined} />
                      </dl>
                      {datos.observaciones && (
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Observaciones / Correcciones solicitadas</dt>
                          <dd className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed bg-orange-50 dark:bg-orange-900/20 rounded-xl px-4 py-3 border border-orange-100 dark:border-orange-700/30">{datos.observaciones}</dd>
                        </div>
                      )}
                    </div>
                  ) : (
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                      {datos.resultado && (
                        <div className="sm:col-span-2">
                          <span className={`inline-flex text-[11px] font-bold px-3 py-1 rounded-full border ${datos.resultado.includes('APROBADA') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : datos.resultado.includes('RECHAZADA') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{datos.resultado}</span>
                        </div>
                      )}
                      {(tipo === 'APROBACION' || tipo === 'RECHAZO') && <Campo label="Facultad" valor={datos.facultad} />}
                      <Campo label="Carrera" valor={datos.carrera} />
                      <Campo label="Plan" valor={datos.plan} />
                      <Campo label="Asignatura" valor={datos.asignatura} />
                      <Campo label="Cátedra" valor={datos.catedra} />
                      <Campo label="Cargo" valor={datos.cargo} />
                      {(tipo === 'APROBACION' || tipo === 'RECHAZO') && (<><Campo label="Modalidad" valor={datos.modalidad} /><Campo label="Designación" valor={datos.designacion} /></>)}
                      {tipo === 'APROBACION' && (<><Campo label="Horas semanales" valor={datos.horasSemana != null ? `${datos.horasSemana} h/sem` : undefined} /><Campo label="Año de inicio" valor={datos.anioInicio != null ? String(datos.anioInicio) : undefined} /><Campo label="Fecha y hora de aprobación" valor={formatFechaHora(datos.fechaAprobacion)} /></>)}
                      {tipo === 'RECHAZO' && <Campo label="Fecha y hora del rechazo" valor={formatFechaHora(datos.fechaRechazo)} />}
                      {tipo === 'DESVINCULACION' && <Campo label="Fecha de desvinculación" valor={formatFecha(datos.fechaDesvinculacion)} />}
                      {(tipo === 'RECHAZO' || tipo === 'DESVINCULACION') && datos.motivo && (
                        <div className="sm:col-span-2">
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Motivo</dt>
                          <dd className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed bg-slate-50 dark:bg-slate-700/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-600">{datos.motivo}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                  {esInfoPura && (
                    <p className="text-[11px] text-slate-400 italic mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">Esta notificación es únicamente informativa. No requiere acción de tu parte.</p>
                  )}
                  {esAprobacionPrograma && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 italic mt-4 pt-3 border-t border-emerald-100 dark:border-emerald-700/30">El programa fue aprobado definitivamente. Podés consultarlo desde la ficha de la asignatura.</p>
                  )}
                  {esCorreccionPrograma && (
                    <p className="text-[11px] text-orange-600 dark:text-orange-400 italic mt-4 pt-3 border-t border-orange-100 dark:border-orange-700/30">Debés revisar las correcciones y responder al directivo desde la sección &quot;Correcciones en programas&quot;.</p>
                  )}
                </div>
                <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
                  {esAprobacionPrograma && datos.materiaId && (
                    <a
                      href={`/plan-estudios/ficha-asignatura?id=${datos.materiaId}&tab=programa`}
                      onClick={() => setVerNotif(null)}
                      className="px-5 py-2 text-sm font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors"
                    >
                      Ver programa
                    </a>
                  )}
                  {esCorreccionPrograma && datos.solicitudId && (() => {
                    const corr = correccionesDocente.find(c => c.id === datos.solicitudId);
                    return corr ? (
                      <button
                        onClick={() => { setVerNotif(null); setConversacionTarget(corr); }}
                        className="px-5 py-2 text-sm font-semibold text-orange-700 border border-orange-200 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors"
                      >
                        Ver correcciones
                      </button>
                    ) : null;
                  })()}
                  <button onClick={() => setVerNotif(null)} className="px-5 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cerrar</button>
                </div>
              </div>
            </div>
          );
        })()}
        {toast && (
          <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold ${toast.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
            {toast.ok ? <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA DIRECTIVOS / ADMIN
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="p-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Bandeja de Aprobaciones</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {esAdmin
            ? 'Gestión de vinculaciones docente-cátedra.'
            : 'Programas de asignatura y vinculaciones docente-cátedra pendientes de resolución.'}
        </p>
      </div>

      {/* ══ SECCIÓN PROGRAMAS (solo aprobadores: SEC, DC, DECANO, RECTORADO) ══ */}
      {esProgramaAprobador && (
        <section className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <IcDoc />
                Programas de Asignatura
                {solicitudesPrograma.filter(s => s.estado === 'PENDIENTE_APROBACION').length > 0 && (
                  <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                    {solicitudesPrograma.filter(s => s.estado === 'PENDIENTE_APROBACION').length} pendiente{solicitudesPrograma.filter(s => s.estado === 'PENDIENTE_APROBACION').length !== 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Programas completados al 100% pendientes de aprobación.</p>
            </div>
            <select
              value={filtroProgramas}
              onChange={e => setFiltroProgramas(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-blue-400 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE_APROBACION">Pendientes</option>
              <option value="APROBADO">Aprobados</option>
              <option value="CORRECCIONES_SOLICITADAS">Con correcciones</option>
              <option value="INVALIDADA">Invalidados</option>
            </select>
          </div>

          <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            {cargandoSolicitudes ? (
              <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
                <IcSpinner /><span className="text-sm">Cargando programas…</span>
              </div>
            ) : errorSolicitudes ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-sm text-red-500 dark:text-red-400 font-medium">{errorSolicitudes}</p>
                <button onClick={cargarSolicitudesPrograma} className="px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition">Reintentar</button>
              </div>
            ) : solicitudasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                <IcDoc />
                <p className="text-sm">
                  {filtroProgramas === 'PENDIENTE_APROBACION'
                    ? 'No hay programas pendientes de aprobación.'
                    : 'No hay solicitudes para mostrar.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Tipo</th>
                      <th className="text-left px-4 py-3">Asignatura</th>
                      <th className="text-left px-4 py-3">Carrera</th>
                      <th className="text-left px-4 py-3">Plan</th>
                      <th className="text-left px-4 py-3">Fecha solicitud</th>
                      <th className="text-left px-4 py-3">Estado</th>
                      <th className="text-right px-4 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                    {solicitudesPagina.map(s => {
                      const materia     = s.programa.materia;
                      const plan        = materia.planEstudio;
                      const carrera     = plan.carrera;
                      const esPendiente = s.estado === 'PENDIENTE_APROBACION';
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0f4c81]/10 text-[#0f4c81] border border-[#0f4c81]/20 whitespace-nowrap">
                              PROGRAMA
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <span className="font-medium text-slate-700 dark:text-slate-200 truncate block">{materia.nombre}</span>
                            <span className="text-[10px] text-slate-400">{materia.codigo}</span>
                          </td>
                          <td className="px-4 py-3 max-w-[160px]">
                            <span className="text-xs text-slate-600 dark:text-slate-300 truncate block">{carrera.nombre}</span>
                            <span className="text-[10px] text-slate-400">{carrera.facultad.nombre}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{plan.nombre}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatFecha(s.fechaCreacion)}</td>
                          <td className="px-4 py-3">
                            <BadgeSolicitud estado={s.estado} />
                            {s.aprobador && !esPendiente && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {s.aprobador.apellido}, {s.aprobador.nombre}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Ver programa — abre directamente la ficha en modo lectura */}
                              <a
                                href={`/plan-estudios/ficha-asignatura?id=${materia.id}&tab=programa&modo=ver`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Ver programa de asignatura"
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#0f4c81] dark:text-blue-400 border border-[#0f4c81]/30 dark:border-blue-500/30 bg-[#0f4c81]/5 dark:bg-blue-500/10 rounded-lg hover:bg-[#0f4c81]/10 dark:hover:bg-blue-500/20 transition-colors"
                              >
                                <IcDoc /><span className="hidden sm:inline">Ver</span>
                              </a>
                              <button
                                onClick={() => setHistorialTarget({ materiaId: s.programa.materiaId, materiaNombre: materia.nombre })}
                                title="Ver historial completo del programa"
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="hidden sm:inline">Historial</span>
                              </button>
                              {esPendiente && (
                                <>
                                  <button
                                    onClick={() => aprobarPrograma(s)}
                                    disabled={accionandoSolicitudId === s.id}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                  >
                                    {accionandoSolicitudId === s.id ? <IcSpinner /> : <IcCheck />}
                                    <span className="hidden sm:inline">Aprobar</span>
                                  </button>
                                  <button
                                    onClick={() => setCorreccionesTarget(s)}
                                    disabled={accionandoSolicitudId === s.id}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-700 border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                                  >
                                    <IcX /><span className="hidden sm:inline">Correcciones</span>
                                  </button>
                                </>
                              )}
                              {s.estado === 'CORRECCIONES_SOLICITADAS' && (
                                <button
                                  onClick={() => setConversacionTarget(s)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-orange-700 border border-orange-200 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                                >
                                  <IcChat /><span className="hidden sm:inline">Conversación</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {totalPagsSolicitudes > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <span className="text-xs text-slate-400">
                  Página {paginaSolicitudes} de {totalPagsSolicitudes} · {solicitudasFiltradas.length} registro{solicitudasFiltradas.length !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPaginaSolicitudes(p => Math.max(1, p - 1))}
                    disabled={paginaSolicitudes === 1}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >← Anterior</button>
                  <button
                    onClick={() => setPaginaSolicitudes(p => Math.min(totalPagsSolicitudes, p + 1))}
                    disabled={paginaSolicitudes === totalPagsSolicitudes}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >Siguiente →</button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══ SECCIÓN VINCULACIONES ══ */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Vinculaciones a Cátedra</h2>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              placeholder="Buscar…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15 transition bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            />
          </div>
          <select
            value={estado}
            onChange={e => setEstado(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-blue-400 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE_DE_APROBACION">Pendiente</option>
            <option value="APROBADA">Aprobada</option>
            <option value="RECHAZADA">Rechazada</option>
            <option value="DESVINCULADA">Desvinculada</option>
            <option value="INACTIVA">Inactiva</option>
          </select>
          <span className="ml-auto text-xs text-slate-400 font-medium">{filtradas.length} registro{filtradas.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Tabla vinculaciones */}
        <div className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          {cargando ? (
            <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
              <IcSpinner /><span className="text-sm">Cargando…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <p className="text-sm text-red-500 dark:text-red-400 font-medium">{error}</p>
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
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Docente</th>
                    <th className="text-left px-4 py-3">Asignatura</th>
                    <th className="text-left px-4 py-3">Carrera</th>
                    <th className="text-left px-4 py-3">Cátedra</th>
                    <th className="text-left px-4 py-3">Cargo</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">H/SEM · Año</th>
                    <th className="text-left px-4 py-3">Estado</th>
                    <th className="text-left px-4 py-3">Fecha solicitud</th>
                    <th className="text-right px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                  {vinculacionesPagina.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">{v.docente.apellido}, {v.docente.nombre}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px]">
                        <span className="truncate block">{v.materia.nombre}</span>
                        {v.materia.codigo && <span className="text-[10px] text-slate-400">{v.materia.codigo}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[160px]">
                        <span className="truncate block text-xs">{v.carrera.nombre}</span>
                        <span className="text-[10px] text-slate-400">{v.facultad.nombre}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs whitespace-nowrap">{v.catedra.nombre}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs whitespace-nowrap">{v.cargo.nombre}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-slate-700 dark:text-slate-200 font-medium text-xs">{v.horasSemana != null ? `${v.horasSemana} h/sem` : <span className="text-slate-400 italic">—</span>}</span>
                        <span className="block text-[10px] text-slate-400">{v.anioInicio ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3"><BadgeEstado estado={v.estado} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatFecha(v.fechaCreacion)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setDetalle(v)} title="Ver detalle" className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <IcEye /><span className="hidden sm:inline">Ver</span>
                          </button>
                          {v.estado === 'PENDIENTE_DE_APROBACION' && (
                            <>
                              <button onClick={() => aprobar(v)} disabled={accionandoId === v.id} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50">
                                {accionandoId === v.id ? <IcSpinner /> : <IcCheck />}
                                <span className="hidden sm:inline">Aprobar</span>
                              </button>
                              <button onClick={() => setRechazarTarget(v)} disabled={accionandoId === v.id} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">
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
            {totalPagsVinc > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <span className="text-xs text-slate-400">
                  Página {paginaVinculaciones} de {totalPagsVinc} · {filtradas.length} registro{filtradas.length !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPaginaVinculaciones(p => Math.max(1, p - 1))}
                    disabled={paginaVinculaciones === 1}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >← Anterior</button>
                  <button
                    onClick={() => setPaginaVinculaciones(p => Math.min(totalPagsVinc, p + 1))}
                    disabled={paginaVinculaciones === totalPagsVinc}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >Siguiente →</button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </section>

      {/* Modales */}
      {detalle && <ModalDetalle vinculacion={detalle} onCerrar={() => setDetalle(null)} />}
      {rechazarTarget && (
        <ModalRechazar
          asignatura={rechazarTarget.materia.nombre}
          docente={`${rechazarTarget.docente.apellido}, ${rechazarTarget.docente.nombre}`}
          onConfirmar={motivo => rechazar(rechazarTarget, motivo)}
          onCerrar={() => setRechazarTarget(null)}
        />
      )}
      {correccionesTarget && (
        <ModalCorrecciones
          asignatura={correccionesTarget.programa.materia.nombre}
          carrera={correccionesTarget.programa.materia.planEstudio.carrera.nombre}
          onConfirmar={obs => enviarCorrecciones(correccionesTarget, obs)}
          onCerrar={() => setCorreccionesTarget(null)}
        />
      )}
      {conversacionTarget && (
        <ModalConversacion
          solicitud={conversacionTarget}
          rolUsuario={rolNombre}
          onCerrar={() => {
            setConversacionTarget(null);
            cargarSolicitudesPrograma();
            recargarContador();
          }}
          onMensajeEnviado={() => { cargarSolicitudesPrograma(); recargarContador(); }}
        />
      )}
      {historialTarget && (
        <ModalHistorialPrograma
          materiaId={historialTarget.materiaId}
          materiaNombre={historialTarget.materiaNombre}
          onCerrar={() => setHistorialTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold ${toast.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {toast.ok ? <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
