import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';
import { legalMarkdownToReact } from '@/lib/legal-markdown';

type LegalDocPageProps = {
  title: string;
  description: string;
  file: 'terms.md' | 'privacy.md' | 'dpa.md' | 'cookies.md';
};

export async function LegalDocPage({ title, description, file }: LegalDocPageProps) {
  const markdown = await readFile(path.join(process.cwd(), 'content/legal', file), 'utf8');

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
        <p className="sr-only">{description}</p>
        <nav
          aria-label="Legal documents"
          className="mb-8 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"
        >
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/dpa" className="hover:text-foreground">
            DPA
          </Link>
          <Link href="/cookies" className="hover:text-foreground">
            Cookies
          </Link>
        </nav>
        <article className="prose prose-neutral max-w-none prose-table:text-sm prose-th:text-left">
          {legalMarkdownToReact(markdown)}
        </article>
        <p className="mt-10 text-sm text-muted-foreground">Document: {title}</p>
      </main>
    </div>
  );
}
