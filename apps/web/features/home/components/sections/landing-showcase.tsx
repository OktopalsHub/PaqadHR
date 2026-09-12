import { Check } from 'lucide-react';
import { showcases } from '../../constants';
import { LandingShowcasePanel } from './landing-showcase-panel';

const showcasePalettes = [
  { card: 'border-[#d8e9e2] bg-[#eff9f4]', eyebrow: 'bg-white/75 text-[#26765c]' },
  { card: 'border-[#e6def5] bg-[#f7f3fc]', eyebrow: 'bg-white/75 text-[#7356a4]' },
  { card: 'border-[#f2dfcf] bg-[#fff7ef]', eyebrow: 'bg-white/75 text-[#ae6537]' },
];

export const LandingShowcase = () => {
  return (
    <section
      className="landing-showcase-section relative overflow-hidden py-24 md:py-32"
      id="product"
    >
      <div className="pointer-events-none absolute -left-40 top-40 size-[31rem] rounded-full bg-[#ebe4ff]/55 blur-3xl" />
      <div className="pointer-events-none absolute -right-48 bottom-0 size-[31rem] rounded-full bg-[#d9f4e8]/70 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-8 rounded-[2rem] border border-[#e3e6ed] bg-white/80 p-8 shadow-[0_24px_70px_-52px_rgba(48,39,91,0.45)] backdrop-blur-sm md:grid-cols-[0.72fr_1.28fr] md:items-end md:p-12">
          <div>
            <p className="inline-flex rounded-full bg-[#eeeaff] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#5f4ca5]">
              One source of truth
            </p>
            <p className="mt-5 max-w-[14rem] text-sm leading-relaxed text-[#64726e]">
              The details stay connected, so your team can keep moving.
            </p>
          </div>
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[#17211e] md:text-5xl md:leading-[1.03]">
              Less chasing. More room to lead.
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">
              The work does not arrive in neat categories. Your people system should not make you
              force it into them.
            </p>
          </div>
        </div>

        <div className="mt-12 space-y-8 md:mt-16">
          {showcases.map((item, index) => {
            const reversed = index % 2 === 1;
            const palette = showcasePalettes[index];
            return (
              <div
                key={item.title}
                className={`grid items-center gap-10 rounded-[2rem] border p-7 shadow-[0_22px_60px_-52px_rgba(17,39,31,0.7)] md:p-10 lg:grid-cols-2 lg:gap-16 ${palette.card} ${
                  reversed ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                <div className="max-w-md">
                  <p
                    className={`inline-flex rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${palette.eyebrow}`}
                  >
                    {item.eyebrow}
                  </p>
                  <h3 className="mt-5 text-2xl font-semibold tracking-[-0.045em] text-[#17211e] md:text-3xl">
                    {item.title}
                  </h3>
                  <p className="mt-4 leading-relaxed text-[#5e6b67]">{item.description}</p>
                  <ul className="mt-7 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
                    {item.highlights.map((point) => (
                      <li
                        key={point}
                        className="flex items-center gap-2 text-sm font-medium text-[#42534d]"
                      >
                        <span className="flex size-5 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm">
                          <Check className="size-3" />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative">
                  <div className="absolute -inset-4 rounded-[2rem] bg-white/45 blur-xl" />
                  <div className="relative overflow-hidden rounded-[1.35rem] border border-white/80 bg-white/85 p-1.5 shadow-[0_18px_42px_-30px_rgba(26,57,46,0.7)]">
                    <LandingShowcasePanel variant={item.panel} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
