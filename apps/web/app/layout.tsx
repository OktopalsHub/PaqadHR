import type { Metadata } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import { AppVersionWatcher } from '@/components/app-version-watcher';
import { Toaster } from '@/components/ui/sonner';
import { brandFaviconUrls } from '@/lib/brand';
import { CSP_NONCE_HEADER } from '@/lib/security/csp-nonce';
import { AuthProvider } from '@/providers/auth-provider';
import { CsrfBootstrap } from '@/providers/csrf-bootstrap';
import { ObservabilityBridge } from '@/providers/observability-bridge';
import { QueryProvider } from '@/providers/query-provider';
import { TenantProvider } from '@/providers/tenant-provider';
import { ThemeProvider } from '@/providers/theme-provider';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? ''),
  title: {
    default: 'PaqadHR',
    template: '%s · PaqadHR',
  },
  description:
    'Simplify hiring, empower teams, and run people operations with one calm workspace — recruitment, payroll, leave, and recognition',
  openGraph: {
    type: 'website',
    siteName: 'PaqadHR',
    title: 'PaqadHR',
    description: 'Hire, pay, and support your team in one workspace with PaqadHR.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'PaqadHR: hire, pay, and support your team in one workspace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PaqadHR',
    description: 'Hire, pay, and support your team in one workspace with PaqadHR.',
    images: ['/opengraph-image'],
  },
  icons: {
    icon: [{ url: brandFaviconUrls.light, type: 'image/png' }],
    apple: [{ url: brandFaviconUrls.light, type: 'image/png' }],
    shortcut: [{ url: brandFaviconUrls.light, type: 'image/png' }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get(CSP_NONCE_HEADER) ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning nonce={nonce}>
      <body className={`${montserrat.variable} ${inter.variable} antialiased font-sans`}>
        <QueryProvider>
          <AppVersionWatcher />
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            nonce={nonce}
          >
            <AuthProvider>
              <CsrfBootstrap />
              <ObservabilityBridge>
                <TenantProvider>{children}</TenantProvider>
              </ObservabilityBridge>
            </AuthProvider>
            <Toaster position="top-center" invert richColors closeButton />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
