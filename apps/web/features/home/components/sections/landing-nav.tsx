'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';

const navLinks = [
  { label: 'The workspace', href: '#product' },
  { label: 'What it handles', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
];

export const LandingNav = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderAuthCta = (mobile: boolean) => {
    return (
      <>
        <Link
          href="/signin"
          className={
            mobile
              ? 'text-sm font-medium cursor-pointer'
              : 'text-sm font-medium transition-colors hover:text-muted-foreground cursor-pointer'
          }
          onClick={mobile ? () => setMobileOpen(false) : undefined}
        >
          Sign in
        </Link>
        <Button
          asChild
          size="sm"
          className={
            mobile
              ? 'w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90'
              : 'h-9 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90'
          }
        >
          <Link href="/signup" onClick={mobile ? () => setMobileOpen(false) : undefined}>
            Sign up
          </Link>
        </Button>
      </>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto grid h-[4.5rem] max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-6 lg:px-8">
        <Link href="/" aria-label="Paqad home" className="justify-self-start">
          <PaqadLogo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-foreground transition-colors hover:text-muted-foreground cursor-pointer"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center justify-self-end gap-5 md:flex">
          {renderAuthCta(false)}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="col-start-3 justify-self-end md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-border px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium cursor-pointer"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            {renderAuthCta(true)}
          </div>
        </div>
      ) : null}
    </header>
  );
};
