import { trustedLogos } from "../../constants";

export const LandingLogoStrip = () => {
  return (
    <section className="border-y border-border/50 py-10">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Trusted by growing teams
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {trustedLogos.map((name) => (
            <span
              key={name}
              className="text-sm font-medium text-muted-foreground/70 transition-colors hover:text-muted-foreground"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
