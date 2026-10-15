import { trustedLogos } from '../../constants';

export const LandingLogoStrip = () => {
  return (
    <section className="relative overflow-hidden border-y border-[#dbe9e3] bg-[#f4faf7] py-11">
      <div className="pointer-events-none absolute inset-y-0 left-[12%] w-px bg-[#cce3d9]" />
      <div className="pointer-events-none absolute inset-y-0 right-[12%] w-px bg-[#cce3d9]" />
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3d685a] md:text-left">
            Built for growing, people-first teams
          </p>
          <span className="rounded-full border border-[#cce3d9] bg-white px-3 py-1.5 text-xs font-medium text-[#356152] shadow-sm">
            One connected workspace
          </span>
        </div>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-9 gap-y-3 border-t border-[#dbe9e3] pt-6 md:justify-between">
          {trustedLogos.map((name) => (
            <span
              key={name}
              className="text-sm font-semibold tracking-[-0.02em] text-[#638177] transition-colors hover:text-[#173c32]"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
