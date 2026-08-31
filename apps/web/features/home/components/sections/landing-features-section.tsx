import { services } from '../../constants/landing-content';

export const LandingFeaturesSection = () => {
  return (
    <section id="features" className="border-t border-border py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Features</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
            Engineered for high performance
          </h2>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground">
            A calm, compliant operations system loaded with micro-utilities to save hours of manual
            payroll sheets, job site management, and holiday requests.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {services.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="group relative bg-card p-7 transition-colors hover:bg-black/[0.01]"
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-all group-hover:border-primary/40 group-hover:bg-primary/15 group-hover:shadow-[0_0_16px_var(--brand-glow)]">
                  <Icon className="size-[18px]" />
                </div>
                <h3 className="mb-1 text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
