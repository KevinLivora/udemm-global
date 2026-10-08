import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { SidebarProvider } from '@/lib/sidebar-context';
import { NotificacionesProvider } from '@/lib/notificaciones-context';
import { ThemeProvider } from '@/lib/theme-context';
import { LayoutClient } from './layout-client';
import { UppercaseInputGuard } from '@/components/UppercaseInputGuard';

export const metadata: Metadata = {
  title: 'UDEMM Global',
  description: 'Plataforma institucional académica para procesos de acreditación CONEAU.'
};

// Script anti-flash: lee localStorage y aplica .dark ANTES de que React hidrate.
const themeScript = `
(function(){
  try{
    if(localStorage.getItem('udemm-theme')==='dark'){
      document.documentElement.classList.add('dark');
    }
  }catch(e){}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-slate-50 dark:bg-slate-900">
        <ThemeProvider>
          <AuthProvider>
            <SidebarProvider>
              <NotificacionesProvider>
                <UppercaseInputGuard />
                <LayoutClient>{children}</LayoutClient>
              </NotificacionesProvider>
            </SidebarProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
