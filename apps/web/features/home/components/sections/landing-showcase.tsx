import { Check } from 'lucide-react';
import { showcases } from '../../constants';
import { LandingShowcasePanel } from './landing-showcase-panel';

export const LandingShowcase = () => {
  return (
    <section className="landing-showcase-section py-24 md:py-32" id="product">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-6 border-b border-border pb-12 md:grid-cols-[0.85fr_1.15fr] md:items-end md:pb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            One source of truth
          </p>
          <div>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.045em] md:text-5xl md:leading-[1.03]">
              Less chasing. More room to lead.
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">
              The work does not arrive in neat categories. Your people system should not make you
              force it into them.
            </p>
          </div>
        </div>

        <div className="mt-16 space-y-24 md:mt-20">
          {showcases.map((item, index) => {
            const reversed = index % 2 === 1;
            return (
              <div
                key={item.title}
                className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${
                  reversed ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    {item.eyebrow}
                  </p>
                  <h3 className="mt-4 text-2xl font-semibold tracking-[-0.035em] md:text-3xl">
                    {item.title}
                  </h3>
                  <p className="mt-4 leading-relaxed text-muted-foreground">{item.description}</p>
                  <ul className="mt-6 space-y-3">
                    {item.highlights.map((point) => (
                      <li
                        key={point}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                          <Check className="size-3" />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative">
                  <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-primary/[0.08] blur-2xl" />
                  <LandingShowcasePanel variant={item.panel} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
