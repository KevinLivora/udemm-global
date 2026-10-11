'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { apiFetch } from './api';

// DOCENTE: cuenta vinculaciones PENDIENTE_DE_APROBACION + notificaciones no leídas.
// Roles aprobadores de Programas: cuenta solicitudes PENDIENTE_APROBACION.
// Resto: siempre 0.

interface NotificacionesContextType {
  contadorNovedades: number;
  recargarContador: () => Promise<void>;
}

const NotificacionesContext = createContext<NotificacionesContextType>({
  contadorNovedades: 0,
  recargarContador: async () => {},
});

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const ROLES_APROBADOR_PROGRAMA = ['SECRETARIA_ACADEMICA', 'DIRECTOR_CARRERA', 'DECANO', 'RECTORADO'];

export function NotificacionesProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  const [contadorNovedades, setContadorNovedades] = useState(0);

  const rolNombre       = usuario?.rol?.nombre ?? '';
  const esDocente       = rolNombre === 'DOCENTE';
  const esAprobadorProg = ROLES_APROBADOR_PROGRAMA.includes(rolNombre);

  const recargarContador = useCallback(async () => {
    if (!usuario) return;

    if (esDocente) {
      try {
        const [resNotif, resVinc] = await Promise.all([
          apiFetch(`${API}/notificaciones/no-leidas/count`),
          apiFetch(`${API}/vinculaciones-catedra?estado=PENDIENTE_DE_APROBACION`),
        ]);

        let total = 0;
        if (resNotif.ok) {
          const d = await resNotif.json();
          total += d.count ?? 0;
        }
        if (resVinc.ok) {
          const d = await resVinc.json();
          const lista = Array.isArray(d) ? d : (d.data ?? []);
          total += lista.length;
        }
        setContadorNovedades(total);
      } catch {
        // silencioso
      }
      return;
    }

    if (esAprobadorProg) {
      try {
        const [resSolicitudes, resContadores] = await Promise.all([
          apiFetch(`${API}/programas/solicitudes`),
          apiFetch(`${API}/programas/contadores`),
        ]);
        let total = 0;
        if (resSolicitudes.ok) {
          const data = await resSolicitudes.json();
          const lista = Array.isArray(data) ? data : [];
          total += lista.filter((s: { estado: string }) => s.estado === 'PENDIENTE_APROBACION').length;
        }
        if (resContadores.ok) {
          const data = await resContadores.json();
          total += data.correcciones ?? 0;
        }
        setContadorNovedades(total);
      } catch {
        // silencioso
      }
      return;
    }

    setContadorNovedades(0);
  }, [esDocente, esAprobadorProg, usuario]);

  useEffect(() => {
    recargarContador();
    const id = setInterval(recargarContador, 30_000);
    return () => clearInterval(id);
  }, [recargarContador]);

  return (
    <NotificacionesContext.Provider value={{ contadorNovedades, recargarContador }}>
      {children}
    </NotificacionesContext.Provider>
  );
}

export const useNotificaciones = () => useContext(NotificacionesContext);
