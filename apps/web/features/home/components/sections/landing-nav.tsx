'use client';

import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';
import { fadeIn } from '../../constants/landing-motion';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Product', href: '#product' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
];

export const LandingNav = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.header
      initial="hidden"
      animate="show"
      variants={fadeIn}
      className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md"
    >
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-6">
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
          <Link
            href="/signin"
            className="text-sm font-medium transition-colors hover:text-muted-foreground cursor-pointer"
          >
            Sign in
          </Link>
          <Button
            asChild
            size="sm"
            className="h-9 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/signup">Sign up</Link>
          </Button>
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
            <Link href="/signin" className="text-sm font-medium cursor-pointer">
              Sign in
            </Link>
            <Button
              asChild
              className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </motion.header>
  );
};
