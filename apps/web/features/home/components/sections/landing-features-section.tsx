'use client';

import { services } from '../../constants/landing-content';
import { useLandingReveal } from '../../lib/use-landing-reveal';

const featurePalettes = [
  'border-[#cce8db] bg-[#effaf5] hover:bg-[#e5f7ef] text-[#26765c]',
  'border-[#dcd3f0] bg-[#f5f2fc] hover:bg-[#eee9fa] text-[#7055a3]',
  'border-[#f1d9ca] bg-[#fff5ee] hover:bg-[#feecdf] text-[#ad6537]',
  'border-[#cfe3ee] bg-[#eff8fc] hover:bg-[#e6f4fa] text-[#2e718b]',
  'border-[#eee1bb] bg-[#fff9e8] hover:bg-[#fff3cf] text-[#a27122]',
  'border-[#eed3dc] bg-[#fdf2f5] hover:bg-[#fae7ed] text-[#a8516f]',
];

export const LandingFeaturesSection = () => {
  const { ref, visible } = useLandingReveal<HTMLElement>('-80px');

  return (
    <section
      id="features"
      ref={ref}
      className={`landing-features-section landing-reveal landing-deferred-paint relative overflow-hidden py-24 md:py-32 ${
        visible ? 'is-visible' : ''
      }`}
    >
      <div className="pointer-events-none absolute right-[-15rem] top-20 size-[30rem] rounded-full bg-[#fff0d9] blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="landing-reveal-item mb-12 grid gap-5 md:grid-cols-[0.72fr_1.28fr] md:items-end md:gap-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ad6537]">
            What it handles
          </p>
          <div>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.045em] text-[#17211e] md:text-5xl md:leading-[1.03]">
              Everything around the work, finally together.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#61706a]">
              Choose a clearer way to run your team: details that stay connected, fewer handoffs,
              and a workflow that holds up when the company gets busy.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={`landing-reveal-item group relative overflow-hidden rounded-[1.4rem] border p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-30px_rgba(25,50,42,0.5)] md:p-8 ${featurePalettes[index]}`}
                style={{ transitionDelay: `${index * 60}ms` }}
              >
                <div className="mb-8 flex size-11 items-center justify-center rounded-2xl border border-current/15 bg-white/80 transition-transform duration-300 group-hover:scale-110">
                  <Icon className="size-[19px]" />
                </div>
                <h3 className="mb-2 text-base font-semibold tracking-[-0.025em] text-[#1c2924]">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-[#607069]">{item.description}</p>
                <span className="absolute bottom-0 right-6 text-5xl font-semibold tracking-[-0.08em] text-current opacity-[0.07]">
                  0{index + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
