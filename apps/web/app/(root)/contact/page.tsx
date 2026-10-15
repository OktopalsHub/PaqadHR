import type { Metadata } from 'next';
import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';
import { ContactForm } from '@/features/home/components/contact-form';
import { COMPANY } from '@/lib/constants/company';

export const metadata: Metadata = {
  title: 'Contact — Paqad',
  description: 'Contact Paqad.',
};

export default function ContactPage() {
  return (
    <div className="theme-marketing min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" aria-label="Paqad home">
            <PaqadLogo />
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
        <p className="mt-2 text-muted-foreground">{COMPANY.poweredBy}</p>

        <div className="mt-10 grid gap-12 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Email</p>
            <a href={`mailto:${COMPANY.email}`} className="block hover:text-foreground">
              {COMPANY.email}
            </a>
          </div>
          <ContactForm />
        </div>
      </main>
    </div>
  );
}
