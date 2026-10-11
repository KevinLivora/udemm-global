'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export interface SolicitudConversacion {
  id: string;
  estado: string;
  programa: {
    materiaId: string;
    materia: {
      id: string;
      nombre: string;
      planEstudio: {
        nombre: string;
        carrera: { nombre: string; facultad: { nombre: string } };
      };
    };
  };
  aprobador?: { id: string; nombre: string; apellido: string } | null;
}

interface Mensaje {
  id: string;
  solicitudId: string;
  usuarioId: string;
  rolNombre: string;
  contenido: string;
  tipo: 'CORRECCION' | 'RESPUESTA';
  leido: boolean;
  fechaCreacion: string;
  usuario: { id: string; nombre: string; apellido: string };
}

interface Props {
  solicitud: SolicitudConversacion;
  rolUsuario: string;
  onCerrar: () => void;
  onMensajeEnviado?: () => void;
}

const IcClose = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IcSend = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);
const IcDoc = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const IcSpinner = () => (
  <div className="w-4 h-4 rounded-full border-2 border-blue-200 border-t-[#0f4c81] animate-spin" />
);

function formatFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function ModalConversacion({ solicitud, rolUsuario, onCerrar, onMensajeEnviado }: Props) {
  const [mensajes, setMensajes]   = useState<Mensaje[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [texto, setTexto]         = useState('');
  const [enviando, setEnviando]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const esDocente                 = rolUsuario === 'DOCENTE';
  const materia                   = solicitud.programa.materia;
  const puedeResponder =
    esDocente
      ? solicitud.estado === 'CORRECCIONES_SOLICITADAS'
      : true;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await apiFetch(`${API}/programas/solicitudes/${solicitud.id}/mensajes`);
      if (res.ok) {
        const data = await res.json();
        setMensajes(Array.isArray(data) ? data : []);
      }
      // Marcar como leídos
      await apiFetch(`${API}/programas/solicitudes/${solicitud.id}/mensajes/leer`, { method: 'PATCH' });
    } finally {
      setCargando(false);
    }
  }, [solicitud.id]);

  useEffect(() => { cargar(); }, [cargar]);

  // Scroll al fondo cuando cambian los mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await apiFetch(`${API}/programas/solicitudes/${solicitud.id}/mensajes`, {
        method: 'POST',
        body: JSON.stringify({ contenido: texto.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Error ${res.status}`);
      }
      const nuevo = await res.json();
      setMensajes(prev => [...prev, nuevo]);
      setTexto('');
      onMensajeEnviado?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const urlPrograma = `/plan-estudios/ficha-asignatura?id=${materia.id}&tab=programa`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
           style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
              {materia.nombre}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {materia.planEstudio.carrera.nombre} — {materia.planEstudio.nombre}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={urlPrograma}
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[#0f4c81] dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-700/40 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors whitespace-nowrap"
            >
              <IcDoc /> Ver Programa
            </Link>
            <button
              onClick={onCerrar}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <IcClose />
            </button>
          </div>
        </div>

        {/* Hilo de mensajes */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
          {cargando ? (
            <div className="flex justify-center py-10 text-slate-400">
              <IcSpinner />
            </div>
          ) : mensajes.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">Sin mensajes aún.</p>
          ) : (
            mensajes.map(m => {
              const esCorreccion = m.tipo === 'CORRECCION';
              const alineacion   = esCorreccion ? 'items-start' : 'items-end';
              const burbuja      = esCorreccion
                ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-700/40 text-orange-900 dark:text-orange-100'
                : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-700/30 text-blue-900 dark:text-blue-100';
              const etiqueta     = esCorreccion
                ? `${m.usuario.nombre} ${m.usuario.apellido} (${m.rolNombre.replace('_', ' ')})`
                : `${m.usuario.nombre} ${m.usuario.apellido} (Docente)`;

              return (
                <div key={m.id} className={`flex flex-col ${alineacion} gap-0.5`}>
                  <span className="text-[10px] text-slate-400 px-1">{etiqueta}</span>
                  <div className={`rounded-xl px-3.5 py-2.5 text-sm leading-snug max-w-[85%] ${burbuja}`}>
                    {m.contenido}
                  </div>
                  <span className="text-[9px] text-slate-400 px-1">{formatFechaHora(m.fechaCreacion)}</span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input respuesta */}
        {puedeResponder && (
          <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 flex-shrink-0">
            {esDocente && solicitud.estado === 'CORRECCIONES_SOLICITADAS' && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-2">
                Respondé al directivo para informar las correcciones realizadas.
              </p>
            )}
            {error && (
              <p className="text-[11px] text-red-600 dark:text-red-400 mb-2">{error}</p>
            )}
            <div className="flex gap-2">
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar();
                }}
                rows={2}
                maxLength={2000}
                placeholder={esDocente ? 'Informá las correcciones realizadas… (Ctrl+Enter para enviar)' : 'Escribí una observación adicional… (Ctrl+Enter para enviar)'}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-blue-400/15 resize-none bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition"
              />
              <button
                onClick={enviar}
                disabled={enviando || !texto.trim()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#0f4c81] text-white rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-end"
              >
                {enviando ? <IcSpinner /> : <IcSend />}
                {enviando ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
