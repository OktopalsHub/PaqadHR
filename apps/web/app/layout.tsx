import type { Metadata } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import './globals.css';
import { brandFaviconUrls } from '@/lib/brand';
import { ObservabilityProvider } from '@/providers/observability-provider';
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

// NEXT_PUBLIC_APP_URL can be absent or malformed (CI passes it through from repo
// vars), and this runs at module scope while Next collects page data, so an
// unparseable value here fails the whole build. Fall back to Next's default.
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const metadataBase =
  appUrl && URL.canParse(appUrl) ? new URL(appUrl) : new URL('http://localhost:3000');

export const metadata: Metadata = {
  metadataBase,
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The layout deliberately does not read request headers. Calling `headers()`
  // here would opt every route in the tree into dynamic rendering, so the
  // public marketing pages could never be prerendered or edge-cached.
  //
  // The per-request CSP nonce is still applied to the framework's inline
  // scripts: Next.js extracts it from the `Content-Security-Policy` request
  // header that the middleware sets (see lib/security/content-security-policy).
  // `style-src` allows `'unsafe-inline'`, so the theme provider's injected
  // style tag needs no nonce.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${montserrat.variable} ${inter.variable} antialiased font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ObservabilityProvider>{children}</ObservabilityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
