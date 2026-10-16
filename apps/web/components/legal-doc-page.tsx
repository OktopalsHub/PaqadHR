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

/**
 * The legal markdown is traced into the server bundle, but its runtime location
 * depends on the host. Under OpenNext on Cloudflare Workers `process.cwd()` is
 * the bundle root and traced files keep their monorepo-relative path
 * (`apps/web/content/legal/...`); in local dev cwd is the app directory. Try
 * both so the page renders in every runtime.
 */
async function readLegalDoc(file: LegalDocPageProps['file']): Promise<string> {
  const candidates = [
    path.join(process.cwd(), 'content/legal', file),
    path.join(process.cwd(), 'apps/web/content/legal', file),
  ];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf8');
    } catch {
      // Try the next candidate location.
    }
  }
  throw new Error(`Legal document not found: ${file}`);
}

export async function LegalDocPage({ title, description, file }: LegalDocPageProps) {
  const markdown = await readLegalDoc(file);

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
