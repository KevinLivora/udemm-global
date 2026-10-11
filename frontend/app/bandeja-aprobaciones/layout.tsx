'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const ROLES_ACCESO = [
  'ADMINISTRADOR_SISTEMA',
  'DOCENTE',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_CARRERA',
  'DECANO',
  'RECTORADO',
];

export default function BandejaLayout({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (usuario && !ROLES_ACCESO.includes(usuario.rol?.nombre ?? '')) {
      router.replace('/');
    }
  }, [usuario, router]);

  if (!usuario || !ROLES_ACCESO.includes(usuario.rol?.nombre ?? '')) return null;

  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
