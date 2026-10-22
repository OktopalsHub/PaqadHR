import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';
import { COMPANY } from '@/lib/constants/company';
import { MARKETING_PAGES } from '@/lib/constants/marketing-pages';

const NAV_PATHS = ['/payroll', '/employee-recognition', '/pricing', '/security', '/about'] as const;

const navItems = NAV_PATHS.map((path) => {
  const page = MARKETING_PAGES.find((entry) => entry.path === path);
  return { href: path, label: page?.label ?? path };
});

const footerGroups = [
  {
    title: 'Product',
    links: [
      { href: '/payroll', label: 'Payroll' },
      { href: '/employee-recognition', label: 'Recognition' },
      { href: '/hr-software', label: 'HR software' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/security', label: 'Security' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/dpa', label: 'DPA' },
      { href: '/cookies', label: 'Cookies' },
    ],
  },
] as const;

/**
 * Shared chrome for every marketing page. A single header/footer keeps internal
 * links consistent — which matters twice over here: for crawl paths and for the
 * passage extraction AI systems do on every page.
 */
export function MarketingShell({
  children,
  backHref = '/',
  backLabel = 'Back to home',
}: {
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="theme-marketing flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
          <Link href="/" aria-label="PaqadHR home">
            <PaqadLogo priority />
          </Link>
          <nav aria-label="Marketing" className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full px-4">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-[#f7faf8]">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
          <div>
            <PaqadLogo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              HR, payroll, and recognition in one workspace for growing teams.
            </p>
            <a
              href={`mailto:${COMPANY.email}`}
              className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground"
            >
              {COMPANY.email}
            </a>
          </div>
          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                {group.title}
              </p>
              <ul className="mt-4 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {COMPANY.legalName}. All rights reserved.
            </p>
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> {backLabel}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
