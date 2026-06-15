import { services } from '../../constants';

export const LandingFeatures = () => {
  return (
    <section className="py-24 md:py-28" id="features">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">Features</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Everything HR needs in one platform
          </h2>
          <p className="mt-4 text-muted-foreground">
            Modular tools that connect your people data, hiring pipeline, and payroll workflow
            without the enterprise bloat.
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.title}
              className="group rounded-2xl border border-border/60 bg-card/50 p-6 transition-all hover:border-primary/35 hover:bg-card/80"
            >
              <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary transition-colors group-hover:bg-primary/20">
                <service.icon className="size-5" />
              </div>
              <h3 className="font-medium">{service.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {service.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
