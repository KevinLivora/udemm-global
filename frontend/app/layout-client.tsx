'use client';

import { Sidebar } from '@/components/Sidebar';
import { useSidebar } from '@/lib/sidebar-context';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export function LayoutClient({ children }: { children: ReactNode }) {
  const { isOpen } = useSidebar();
  const pathname = usePathname();
  const sinSidebar = pathname === '/login' || pathname.startsWith('/restablecer-contrasena');

  return (
    <div className="flex">
      <Sidebar />
      <main
        className={`flex-1 transition-all duration-200 min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 ${
          sinSidebar ? '' : (isOpen ? 'ml-64' : 'ml-14')
        }`}
      >
        {children}
      </main>
    </div>
  );
}
