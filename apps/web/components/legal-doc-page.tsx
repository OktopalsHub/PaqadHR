import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';
import { Button } from '@/components/ui/button';
import { LEGAL_CONTENT } from '@/lib/legal-content.generated';
import { legalMarkdownToReact } from '@/lib/legal-markdown';

type LegalDocFile = 'terms.md' | 'privacy.md' | 'dpa.md' | 'cookies.md';

type LegalDocPageProps = {
  title: string;
  description: string;
  file: LegalDocFile;
};

// The markdown is inlined at build time (see scripts/generate-legal-content.mjs)
// because the Cloudflare Worker bundle does not ship runtime `fs` reads.
const LEGAL_DOCS: Record<LegalDocFile, string> = {
  'terms.md': LEGAL_CONTENT.terms,
  'privacy.md': LEGAL_CONTENT.privacy,
  'dpa.md': LEGAL_CONTENT.dpa,
  'cookies.md': LEGAL_CONTENT.cookies,
};

export async function LegalDocPage({ title, description, file }: LegalDocPageProps) {
  const markdown = LEGAL_DOCS[file];

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
