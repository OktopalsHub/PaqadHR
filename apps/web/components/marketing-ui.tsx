import type { ReactNode } from 'react';

/**
 * The first 60 words and this block are what answer engines lift. Keep each one
 * self-contained: no "as mentioned above", no pronouns that need the rest of the page.
 */
export function AnswerBlock({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 rounded-[1.4rem] border border-primary/15 bg-[#f2f8f4] px-6 py-6 md:px-8">
      <p className="text-base leading-relaxed text-foreground md:text-lg">{children}</p>
    </div>
  );
}

export function PageSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-14 scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">{title}</h2>
      <div className="mt-5 space-y-4 text-base leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export function FaqList({ items }: { items: readonly { question: string; answer: string }[] }) {
  return (
    <div className="mt-6 divide-y divide-border rounded-[1.2rem] border border-border">
      {items.map((item) => (
        <div key={item.question} className="px-5 py-5 md:px-6">
          <h3 className="text-base font-semibold text-foreground">{item.question}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
        </div>
      ))}
    </div>
  );
}

export function UpdatedNote({ updated }: { updated: string }) {
  const formatted = new Date(`${updated}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return (
    <p className="mt-4 text-xs text-muted-foreground">
      Last reviewed <time dateTime={updated}>{formatted}</time>
    </p>
  );
}

export function CtaRow({
  primary = { href: '/signup', label: 'Get started' },
  secondary = { href: '/contact', label: 'Talk to us' },
}: {
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="mt-10 flex flex-wrap gap-3">
      <a
        href={primary.href}
        className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        {primary.label}
      </a>
      <a
        href={secondary.href}
        className="inline-flex h-11 items-center justify-center rounded-full border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        {secondary.label}
      </a>
    </div>
  );
}
