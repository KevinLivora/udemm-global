'use client';

import { useAuth } from '@/lib/auth-context';
import { useSidebar } from '@/lib/sidebar-context';
import { useNotificaciones } from '@/lib/notificaciones-context';
import { ThemeToggle } from '@/components/ThemeToggle';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';

// ── Iconos SVG ──────────────────────────────────────────────────────────────

const IcHome = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const IcUsers = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const IcDocument = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IcInbox = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
  </svg>
);

const IcSettings = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IcManage = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const IcLogout = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const IcChevron = ({ down }: { down: boolean }) => (
  <svg className={`w-3 h-3 flex-shrink-0 transition-transform duration-150 ${down ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const IcPlanEstudios = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const IcGestionAcademica = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const IcVinculacion = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899l4-4a4 4 0 115.656 5.656l-1.1 1.1" />
  </svg>
);

const IcBell = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const IcNormativas = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
  </svg>
);

const IcMenuOpen = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
);

const IcMenuClosed = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);

// ── Tipos ────────────────────────────────────────────────────────────────────

interface MenuItemType {
  label: string;
  icon: ReactNode;
  href?: string;
  badge?: number;
  submenu?: { label: string; href: string }[];
}

// ── Componente ───────────────────────────────────────────────────────────────

export function Sidebar() {
  const { usuario, logout } = useAuth();
  const pathname = usePathname();
  const { isOpen, setIsOpen } = useSidebar();
  const { contadorNovedades } = useNotificaciones();
  const [expandedMenu, setExpandedMenu] = useState<string | null>('docentes');

  if (!usuario || pathname === '/login') return null;

  function handleLogout() {
    if (window.confirm('¿Deseas cerrar sesión?')) logout();
  }

  const getMenuByRole = (): MenuItemType[] => {
    const SUBMENU_GESTION_ACADEMICA = {
      label: 'Gestión Académica',
      icon: <IcGestionAcademica />,
      submenu: [
        { label: 'Facultades', href: '/gestion-academica/facultades' },
        { label: 'Carreras',   href: '/gestion-academica/carreras'   },
      ],
    };

    const SUBMENU_PLAN_ESTUDIOS = {
      label: 'Plan de Estudios',
      icon: <IcPlanEstudios />,
      submenu: [
        { label: 'Carreras',                         href: '/plan-estudios/carreras'            },
        { label: 'Programas de Asignatura',          href: '/plan-estudios/programas-asignatura' },
        { label: 'Información de Planes de Estudio', href: '/plan-estudios/informacion-planes'  },
      ],
    };

    const ITEM_REPOSITORIO: MenuItemType = {
      label: 'Repositorio de Normativas',
      icon: <IcNormativas />,
      href: '/repositorio-normativas',
    };

    if (usuario.rol?.nombre === 'DOCENTE') {
      return [
        { label: 'Inicio', icon: <IcHome />, href: '/' },
        { label: 'Mi Ficha Docente', icon: <IcDocument />, href: '/docentes/mi-ficha' },
        {
          label: 'Bandeja de Aprobaciones',
          icon: <IcInbox />,
          href: '/bandeja-aprobaciones',
          badge: contadorNovedades > 0 ? contadorNovedades : undefined,
        },
        SUBMENU_PLAN_ESTUDIOS,
        ITEM_REPOSITORIO,
      ];
    }

    const ITEM_VINCULACION: MenuItemType = {
      label: 'Vinculación a Cátedra',
      icon:  <IcVinculacion />,
      href:  '/vinculaciones-catedra',
    };

    if (usuario.rol?.nombre === 'ADMINISTRADOR_SISTEMA') {
      return [
        { label: 'Inicio', icon: <IcHome />, href: '/' },
        {
          label: 'Docentes',
          icon: <IcUsers />,
          submenu: [{ label: 'Listado de Docentes', href: '/docentes' }],
        },
        SUBMENU_PLAN_ESTUDIOS,
        ITEM_REPOSITORIO,
        SUBMENU_GESTION_ACADEMICA,
        ITEM_VINCULACION,
        { label: 'Bandeja de Aprobaciones', icon: <IcInbox />, href: '/bandeja-aprobaciones' },
        {
          label: 'Configuración',
          icon: <IcSettings />,
          submenu: [
            { label: 'Usuarios',             href: '/configuracion/usuarios'          },
            { label: 'Roles',                href: '/configuracion/roles'             },
            { label: 'Parámetros Generales', href: '/configuracion/parametros'        },
            { label: 'Tablas Maestras',      href: '/configuracion/tablas-maestras'   },
          ],
        },
      ];
    }

    const ITEM_BANDEJA_APROBACIONES: MenuItemType = {
      label: 'Bandeja de Aprobaciones',
      icon: <IcInbox />,
      href: '/bandeja-aprobaciones',
      badge: contadorNovedades > 0 ? contadorNovedades : undefined,
    };

    if (usuario.rol?.nombre === 'SECRETARIA_ACADEMICA') {
      return [
        { label: 'Inicio', icon: <IcHome />, href: '/' },
        {
          label: 'Docentes',
          icon: <IcUsers />,
          submenu: [{ label: 'Listado de Docentes', href: '/docentes' }],
        },
        SUBMENU_PLAN_ESTUDIOS,
        ITEM_REPOSITORIO,
        SUBMENU_GESTION_ACADEMICA,
        ITEM_VINCULACION,
        ITEM_BANDEJA_APROBACIONES,
        {
          label: 'Configuración',
          icon: <IcSettings />,
          submenu: [{ label: 'Tablas Maestras', href: '/configuracion/tablas-maestras' }],
        },
      ];
    }

    if (usuario.rol?.nombre === 'DIRECTOR_CARRERA') {
      return [
        { label: 'Inicio', icon: <IcHome />, href: '/' },
        {
          label: 'Docentes',
          icon: <IcUsers />,
          submenu: [{ label: 'Listado de Docentes', href: '/docentes' }],
        },
        SUBMENU_PLAN_ESTUDIOS,
        ITEM_REPOSITORIO,
        SUBMENU_GESTION_ACADEMICA,
        ITEM_VINCULACION,
        ITEM_BANDEJA_APROBACIONES,
        {
          label: 'Configuración',
          icon: <IcSettings />,
          submenu: [{ label: 'Tablas Maestras', href: '/configuracion/tablas-maestras' }],
        },
      ];
    }

    if (usuario.rol?.nombre === 'DECANO' || usuario.rol?.nombre === 'RECTORADO') {
      return [
        { label: 'Inicio', icon: <IcHome />, href: '/' },
        {
          label: 'Docentes',
          icon: <IcUsers />,
          submenu: [{ label: 'Listado de Docentes', href: '/docentes' }],
        },
        SUBMENU_PLAN_ESTUDIOS,
        ITEM_REPOSITORIO,
        SUBMENU_GESTION_ACADEMICA,
        ITEM_VINCULACION,
        ITEM_BANDEJA_APROBACIONES,
      ];
    }

    const base: MenuItemType[] = [{ label: 'Inicio', icon: <IcHome />, href: '/' }];

    if (usuario.rol?.nombre === 'ADMINISTRATIVO') {
      base.push({
        label: 'Gestión Docentes',
        icon: <IcManage />,
        submenu: [
          { label: 'Listado de Docentes',        href: '/docentes'              },
          { label: 'Bandeja de Aprobaciones',    href: '/docentes/aprobaciones' },
        ],
      });
    } else {
      base.push({
        label: 'Docentes',
        icon: <IcUsers />,
        submenu: [{ label: 'Listado de Docentes', href: '/docentes' }],
      });
    }

    base.push(SUBMENU_PLAN_ESTUDIOS);
    base.push(ITEM_REPOSITORIO);
    base.push(SUBMENU_GESTION_ACADEMICA);

    return base;
  };

  const menuItems = getMenuByRole();

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const isMenuActive = (submenu?: { label: string; href: string }[]) =>
    submenu?.some(item => pathname.startsWith(item.href)) ?? false;

  // Para subitems: gana el prefijo más largo que coincide,
  // evitando que /docentes active también /docentes/aprobaciones y vice-versa.
  const activeSubItemHref = (subitems: { label: string; href: string }[]): string | null => {
    const matches = subitems.filter(
      (s) => pathname === s.href || pathname.startsWith(s.href + '/'),
    );
    if (!matches.length) return null;
    return matches.reduce((best, s) => (s.href.length > best.href.length ? s : best)).href;
  };

  return (
    <aside className={`${isOpen ? 'w-64' : 'w-14'} bg-[#0d2244] border-r border-white/5 shadow-xl transition-all duration-200 flex flex-col h-screen fixed left-0 top-0 z-40`}>

      {/* Cabecera */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1a5ea8] flex-shrink-0 shadow-sm">
            <span className="text-xs font-bold text-white tracking-wide">U</span>
          </div>
          {isOpen && (
            <div className="min-w-0">
              <span className="text-sm font-semibold text-white block truncate leading-tight">UDEMM Global</span>
              <span className="text-[10px] text-blue-300/50 block truncate leading-tight">Sistema de Gestión</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-blue-300/40 hover:text-blue-200 transition-colors flex-shrink-0 p-1 rounded"
          title={isOpen ? 'Contraer menú' : 'Expandir menú'}
        >
          {isOpen ? <IcMenuOpen /> : <IcMenuClosed />}
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {menuItems.map((item) => (
          <div key={item.label}>
            {item.href ? (
              <Link
                href={item.href}
                title={!isOpen ? item.label : undefined}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                  isActive(item.href)
                    ? 'bg-[#1a5ea8] text-white font-medium'
                    : 'text-blue-100/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="relative flex-shrink-0">
                  {item.icon}
                  {!isOpen && item.badge != null && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[#0d2244]" />
                  )}
                </span>
                {isOpen && (
                  <span
                    className="flex-1 min-w-0"
                    style={{ whiteSpace: 'normal', overflowWrap: 'break-word', wordBreak: 'break-word' }}
                  >
                    {item.label}
                  </span>
                )}
                {isOpen && item.badge != null && item.badge > 0 && (
                  <span className="flex-shrink-0 text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            ) : (
              <>
                <button
                  onClick={() => setExpandedMenu(expandedMenu === item.label ? null : item.label)}
                  title={!isOpen ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                    isMenuActive(item.submenu)
                      ? 'bg-white/8 text-white font-medium'
                      : 'text-blue-100/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {item.icon}
                  {isOpen && (
                    <>
                      <span className="flex-1 min-w-0 text-left whitespace-normal break-words">{item.label}</span>
                      <IcChevron down={expandedMenu === item.label} />
                    </>
                  )}
                </button>

                {isOpen && expandedMenu === item.label && item.submenu && (
                  <div className="ml-3 mt-0.5 mb-1 space-y-0.5 border-l border-white/8 pl-3">
                    {(() => {
                      const activeHref = activeSubItemHref(item.submenu);
                      return item.submenu.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                            activeHref === sub.href
                              ? 'bg-[#1a5ea8] text-white font-medium'
                              : 'text-blue-200/50 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span className="w-1 h-1 rounded-full bg-current flex-shrink-0 opacity-50" />
                          <span className="flex-1 min-w-0 whitespace-normal break-words leading-snug">{sub.label}</span>
                        </Link>
                      ));
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Usuario, tema y cierre de sesión */}
      <div className="border-t border-white/5 p-2 space-y-1">
        {isOpen && (
          <div className="px-2.5 py-1.5 rounded-lg bg-white/3">
            <p className="text-xs font-semibold text-white/90 truncate leading-tight">
              {usuario.nombre} {usuario.apellido}
            </p>
            <p className="text-[10px] text-blue-300/40 truncate mt-0.5 leading-tight">
              {usuario.rol?.nombre?.replace(/_/g, ' ')}
            </p>
          </div>
        )}
        <ThemeToggle showLabel={isOpen} />
        <button
          onClick={handleLogout}
          title={!isOpen ? 'Cerrar sesión' : undefined}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-red-300/60 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <IcLogout />
          {isOpen && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
