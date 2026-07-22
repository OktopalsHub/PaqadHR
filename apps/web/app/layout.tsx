import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { brandFaviconUrls } from '@/lib/brand';
import { AuthProvider } from '@/providers/auth-provider';
import { CsrfBootstrap } from '@/providers/csrf-bootstrap';
import { QueryProvider } from '@/providers/query-provider';
import { TenantProvider } from '@/providers/tenant-provider';
import { ThemeProvider } from '@/providers/theme-provider';

export const metadata: Metadata = {
  title: {
    default: 'PaqadHR',
    template: '%s · PaqadHR',
  },
  description:
    'Simplify hiring, empower teams, and run people operations with one calm workspace — recruitment, payroll, leave, and recognition',
  icons: {
    icon: [{ url: brandFaviconUrls.light, type: 'image/png' }],
    apple: [{ url: brandFaviconUrls.light, type: 'image/png' }],
    shortcut: [{ url: brandFaviconUrls.light, type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased font-sans">
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthProvider>
              <CsrfBootstrap />
              <TenantProvider>{children}</TenantProvider>
            </AuthProvider>
            <Toaster position="top-center" invert richColors closeButton />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
