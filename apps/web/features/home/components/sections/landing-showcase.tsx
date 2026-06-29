import { Check } from 'lucide-react';
import { showcases } from '../../constants';
import { LandingShowcasePanel } from './landing-showcase-panel';

export const LandingShowcase = () => {
  return (
    <section className="py-24 md:py-28" id="product">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">Solutions</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Built for how HR teams actually work
          </h2>
        </div>

        <div className="mt-20 space-y-24">
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
                  <p className="text-sm font-medium text-primary">{item.eyebrow}</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
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
                  <div className="absolute -inset-4 -z-10 rounded-3xl bg-primary/10 blur-2xl" />
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
