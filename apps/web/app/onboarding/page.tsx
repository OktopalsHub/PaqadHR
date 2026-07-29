'use client';

import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { OnboardingGate } from '@/features/onboarding/components/onboarding-gate';
import { OnboardingWizard } from '@/features/onboarding/components/onboarding-wizard';
import { cn } from '@/lib/utils';

const ONBOARDING_STEPS = ['Company', 'You', 'Plan', 'Review'] as const;

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const isExpandedStep = step >= 2;

  return (
    <OnboardingGate>
      <div
        className={cn(
          'grid h-full w-full gap-3 xl:items-stretch',
          isExpandedStep
            ? 'xl:grid-cols-[minmax(16rem,0.88fr)_52rem] xl:gap-9 2xl:grid-cols-[minmax(16rem,0.92fr)_56rem] 2xl:gap-10'
            : 'xl:grid-cols-[minmax(18rem,1fr)_43rem] xl:gap-12 2xl:grid-cols-[minmax(18rem,1fr)_45rem] 2xl:gap-14',
        )}
      >
        <section
          className={cn(
            'relative h-full overflow-hidden rounded-[28px] border border-white/16 bg-[linear-gradient(155deg,#062723_0%,#0b4b40_42%,#00a070_100%)] text-white shadow-[0_48px_140px_-80px_rgba(6,24,24,0.92)]',
            isExpandedStep ? 'p-4 sm:p-5' : 'p-5 sm:p-6',
          )}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(102,255,213,0.2),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(0,160,112,0.22),transparent_30%)]"
          />
          <div
            aria-hidden="true"
            className="absolute -right-20 top-8 h-52 w-52 rounded-full border border-white/10 bg-white/8 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute bottom-12 left-[-2.5rem] h-44 w-44 rounded-full border border-white/10 bg-[#00a070]/18 blur-3xl"
          />

          <div className={cn('relative flex h-full flex-col', isExpandedStep ? 'gap-4' : 'gap-5')}>
            <div className={cn(isExpandedStep ? 'space-y-2.5' : 'space-y-3')}>
              <span className="inline-flex rounded-full border border-white/18 bg-white/10 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur-sm">
                Create your workspace
              </span>
              <div className={cn(isExpandedStep ? 'space-y-2' : 'space-y-2.5')}>
                <h1
                  className={cn(
                    'max-w-xl font-semibold leading-[0.96] tracking-[-0.06em] text-white',
                    isExpandedStep
                      ? 'text-[clamp(1.7rem,2.65vw,2.65rem)]'
                      : 'text-[clamp(1.95rem,3.2vw,3.3rem)]',
                  )}
                >
                  Create your workspace
                </h1>
                <p
                  className={cn(
                    'max-w-lg text-sm text-white/74',
                    isExpandedStep ? 'leading-5 sm:text-sm' : 'leading-6 sm:text-[15px]',
                  )}
                >
                  A few details to get your team up and running.
                </p>
              </div>
            </div>

            <div
              className={cn(
                'grid sm:grid-cols-2 xl:grid-cols-2',
                isExpandedStep ? 'mt-auto gap-2 pt-6' : 'mt-auto gap-2.5',
              )}
            >
              {ONBOARDING_STEPS.map((label, index) => (
                <div
                  key={label}
                  className={cn(
                    'rounded-[18px] border backdrop-blur-sm transition-all duration-200',
                    isExpandedStep ? 'px-3 py-2.5' : 'px-3.5 py-3',
                    index === step &&
                      'border-white/32 bg-white/18 shadow-[0_24px_40px_-24px_rgba(255,255,255,0.3)] ring-1 ring-white/16',
                    index < step && 'border-white/20 bg-white/12',
                    index > step && 'border-white/12 bg-white/7',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p
                        className={cn(
                          'text-[10px] font-semibold uppercase tracking-[0.18em]',
                          index === step ? 'text-white/82' : 'text-white/58',
                        )}
                      >
                        Step {index + 1}
                      </p>
                      <p
                        className={cn(
                          'mt-1 text-sm font-semibold',
                          index === step ? 'text-white' : 'text-white/88',
                        )}
                      >
                        {label}
                      </p>
                    </div>

                    <div
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                        index === step && 'border-white/40 bg-white text-[#0b4b40]',
                        index < step && 'border-white/18 bg-white/12 text-white',
                        index > step && 'border-white/14 bg-transparent text-white/65',
                      )}
                    >
                      {index < step ? <CheckCircle2 className="size-4" /> : index + 1}
                    </div>
                  </div>

                  <div
                    className={cn(
                      'rounded-full bg-white/10',
                      isExpandedStep ? 'mt-2.5 h-1.25' : 'mt-3 h-1.5',
                    )}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        index === step && 'w-full bg-white',
                        index < step && 'w-full bg-emerald-200/80',
                        index > step && 'w-0 bg-transparent',
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div
          className={cn(
            'w-full xl:justify-self-end',
            isExpandedStep ? 'xl:w-[52rem] 2xl:w-[56rem]' : 'xl:w-[43rem] 2xl:w-[45rem]',
          )}
        >
          <OnboardingWizard step={step} onStepChange={setStep} />
        </div>
      </div>
    </OnboardingGate>
  );
}
