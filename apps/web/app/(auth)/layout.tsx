import Link from 'next/link';
import type { ReactNode } from 'react';
import { PaqadLogo } from '@/components/paqad-logo';
import { ForceLightTheme } from '@/providers/force-light-theme';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ForceLightTheme>
      <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#edf8f3_0%,#f8fbfa_46%,#ebf7f1_100%)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,160,112,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,143,101,0.08),transparent_24%)]"
        />

        <div className="relative mx-auto grid min-h-screen w-full max-w-[1720px] gap-4 px-4 py-4 sm:gap-5 sm:px-5 sm:py-5 lg:grid-cols-[minmax(0,1.04fr)_minmax(470px,0.96fr)] lg:gap-6 lg:px-6 lg:py-6 xl:px-8 xl:py-8">
          <div className="hidden lg:flex">
            <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[34px] border border-white/15 bg-[linear-gradient(150deg,#072823_0%,#0a5446_48%,#00a070_100%)] px-10 py-9 text-white shadow-[0_50px_140px_-72px_rgba(6,24,24,0.92)] xl:px-14 xl:py-12">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(102,255,213,0.18),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(0,160,112,0.16),transparent_28%)]"
              />
              <div
                aria-hidden="true"
                className="absolute -right-24 top-8 h-64 w-64 rounded-full border border-white/10 bg-white/6 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="absolute bottom-16 left-[-3.5rem] h-52 w-52 rounded-full border border-white/10 bg-[#00a070]/16 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,transparent_62%,rgba(255,255,255,0.04)_100%)]"
              />

              <Link
                href="/"
                aria-label="Paqad home"
                className="relative inline-flex w-fit rounded-full border border-white/35 bg-white/95 px-5 py-3 shadow-[0_18px_48px_-28px_rgba(8,42,40,0.55)]"
              >
                <PaqadLogo className="h-9 w-auto" />
              </Link>

              <div className="relative mt-auto max-w-[34rem] pt-12">
                <p className="inline-flex rounded-full border border-white/16 bg-white/8 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/78 backdrop-blur-sm">
                  14 days free · No card required
                </p>
                <h1 className="mt-7 text-[clamp(2.5rem,4vw,4.15rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-white">
                  Get better at people operations with Paqad.
                </h1>
                <p className="mt-5 max-w-[28rem] text-base leading-8 text-white/76 xl:text-[17px]">
                  Hire, pay, and support your team in a workspace built for focus.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center py-2 sm:py-4 lg:py-0">
            <div className="mx-auto w-full max-w-xl lg:hidden">
              <div className="relative mb-5 overflow-hidden rounded-[26px] border border-white/70 bg-[linear-gradient(140deg,rgba(7,40,35,0.98)_0%,rgba(0,143,101,0.92)_100%)] px-5 py-5 text-white shadow-[0_28px_76px_-52px_rgba(8,42,40,0.8)]">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(102,255,213,0.16),transparent_28%)]"
                />
                <Link
                  href="/"
                  aria-label="Paqad home"
                  className="relative inline-flex rounded-full border border-white/35 bg-white/94 px-4 py-2.5"
                >
                  <PaqadLogo className="h-8 w-auto" />
                </Link>
                <div className="relative mt-5">
                  <p className="inline-flex rounded-full border border-white/16 bg-white/8 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/76">
                    14 days free · No card required
                  </p>
                  <h1 className="mt-5 text-[2rem] font-semibold leading-tight tracking-[-0.05em]">
                    Get better at people operations with Paqad.
                  </h1>
                  <p className="mt-3 text-sm leading-7 text-white/74">
                    Hire, pay, and support your team in a workspace built for focus.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[31.5rem]">
              <div
                aria-hidden="true"
                className="absolute inset-x-8 top-6 -z-10 h-24 rounded-full bg-[#00a070]/22 blur-3xl"
              />
              <div className="rounded-[28px] border border-white/75 bg-white/90 p-5 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.3)] backdrop-blur-xl sm:p-6 lg:p-7">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ForceLightTheme>
  );
}
