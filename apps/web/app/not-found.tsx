import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="theme-marketing flex min-h-svh flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" aria-label="Paqad home">
            <PaqadLogo />
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <ArrowLeft className="size-4" /> Back to home
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">404</p>
        <h1 className="mt-4 max-w-lg text-3xl font-semibold tracking-[-0.045em] md:text-5xl md:leading-[1.03]">
          This page has moved on.
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
          The address you followed does not exist, or it may have been renamed. Head back home and
          pick up from there.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-11 rounded-full px-6">
            <Link href="/">Go to home</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 rounded-full px-6">
            <Link href="/contact">Contact support</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
