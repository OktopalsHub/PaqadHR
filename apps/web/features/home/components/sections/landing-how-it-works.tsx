const steps = [
  {
    title: 'Create your workspace',
    description: 'Sign up, add your company details, and lock your billing region.',
  },
  {
    title: 'Invite your team',
    description: 'Add employees, set up departments, and configure leave policies.',
  },
  {
    title: 'Run operations',
    description: 'Manage leave, payroll exports, shoutouts, and day-to-day HR from one app.',
  },
];

export const LandingHowItWorks = () => {
  return (
    <section className="border-b border-border/60" id="how-it-works">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
          <p className="mt-3 text-muted-foreground">
            Three steps from signup to running your team.
          </p>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="space-y-3">
              <div className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-medium text-primary">
                {index + 1}
              </div>
              <h3 className="font-medium">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
