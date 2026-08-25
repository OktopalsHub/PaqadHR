import Link from 'next/link';
import type { ReactNode } from 'react';
import { PaqadLogo } from '@/components/paqad-logo';
import { ForceLightTheme } from '@/providers/force-light-theme';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ForceLightTheme>
      <div className="relative min-h-svh overflow-x-hidden overflow-y-auto bg-white sm:bg-[linear-gradient(135deg,#edf8f3_0%,#f8fbfa_46%,#ebf7f1_100%)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden sm:block bg-[radial-gradient(circle_at_top_left,rgba(0,160,112,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,143,101,0.08),transparent_24%)]"
        />

        <div className="relative mx-auto grid min-h-svh w-full max-w-[1720px] gap-4 px-4 py-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-5 sm:px-5 sm:py-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,32rem)] xl:gap-6 xl:px-6 xl:py-6 2xl:grid-cols-[minmax(0,1.04fr)_minmax(29rem,0.96fr)] 2xl:px-8 2xl:py-8">
          <div className="hidden sm:flex">
            <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-white/15 bg-[linear-gradient(150deg,#072823_0%,#0a5446_48%,#00a070_100%)] px-5 py-5 text-white shadow-[0_50px_140px_-72px_rgba(6,24,24,0.92)] lg:px-8 lg:py-8 xl:rounded-[34px] xl:px-14 xl:py-12">
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
                className="relative inline-flex w-fit rounded-full border border-white/35 bg-white/95 px-3 py-2 shadow-[0_18px_48px_-28px_rgba(8,42,40,0.55)] lg:px-4 lg:py-2.5 xl:px-5 xl:py-3"
              >
                <PaqadLogo className="h-6 w-auto lg:h-7 xl:h-9" />
              </Link>

              <div className="relative mt-auto max-w-[34rem] pt-8 lg:pt-10 xl:pt-12">
                <p className="inline-flex rounded-full border border-white/16 bg-white/8 px-2.5 py-1 text-[8px] font-medium uppercase tracking-[0.12em] text-white/78 backdrop-blur-sm lg:px-3 lg:py-1.5 lg:text-[9px] xl:px-4 xl:py-2 xl:text-[11px] xl:tracking-[0.18em]">
                  14 days free · No card required
                </p>
                <h1 className="mt-4 text-[1.55rem] font-semibold leading-[1.02] tracking-[-0.05em] text-white lg:mt-5 lg:text-[2.1rem] xl:mt-7 xl:text-[clamp(2.5rem,4vw,4.15rem)] xl:leading-[0.96]">
                  Get better at people operations with Paqad.
                </h1>
                <p className="mt-3 max-w-[28rem] text-xs leading-5 text-white/76 lg:text-sm lg:leading-6 xl:mt-5 xl:text-[17px] xl:leading-8">
                  Hire, pay, and support your team in a workspace built for focus.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center py-2 sm:py-0">
            <div className="mx-auto mb-2 w-full max-w-[34rem] px-1 sm:hidden">
              <Link href="/" aria-label="Paqad home" className="inline-flex items-center gap-2.5">
                <PaqadLogo showWordmark={false} className="size-8" />
                <span className="text-base font-semibold tracking-[-0.03em] text-slate-950">
                  Paqad HR
                </span>
              </Link>
            </div>

            <div className="relative mx-auto w-full max-w-[34rem] xl:max-w-[31.5rem]">
              <div
                aria-hidden="true"
                className="absolute inset-x-8 top-6 -z-10 hidden h-24 rounded-full bg-[#00a070]/22 blur-3xl sm:block"
              />
              <div className="rounded-[28px] border border-white/75 bg-white/90 p-4 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.3)] backdrop-blur-xl sm:p-6 xl:p-7">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ForceLightTheme>
  );
}
