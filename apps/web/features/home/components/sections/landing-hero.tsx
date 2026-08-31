import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const ProductDemoShell = dynamic(
  () => import('../product-demo/product-demo-shell').then((mod) => mod.ProductDemoShell),
  {
    loading: () => (
      <div
        className="mx-auto mt-12 h-[420px] max-w-6xl animate-pulse rounded-2xl bg-muted/40 px-6 md:mt-16"
        aria-hidden="true"
      />
    ),
  },
);

export const LandingHero = () => {
  return (
    <section className="relative overflow-hidden pt-12 pb-8 md:pt-16 md:pb-12">
      <div className="landing-beam pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-foreground md:text-5xl md:leading-[1.08] lg:text-[3.25rem]">
          HR and payroll built for modern teams.
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Hire, pay, and recognize your people in one workspace without spreadsheet chaos.
        </p>

        <div className="mt-8 flex justify-center">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Link href="/signup">Get started for free</Link>
          </Button>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">14 days free · No card required</p>
      </div>

      <ProductDemoShell className="relative mx-auto mt-12 max-w-6xl px-6 md:mt-16" />
    </section>
  );
};
