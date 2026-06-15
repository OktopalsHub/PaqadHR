import { stats } from '../../constants';

export const LandingStats = () => {
  return (
    <section className="border-y border-border/50 py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4 lg:gap-12">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <stat.icon className="size-5" />
              </div>
              <p className="text-2xl font-semibold tracking-tight md:text-3xl">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
