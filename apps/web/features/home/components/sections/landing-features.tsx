const features = [
  {
    title: "Employee management",
    description:
      "Directory, org structure, documents, and employment records in one place.",
  },
  {
    title: "Leave & calendar",
    description:
      "Request time off, track balances, and see team availability at a glance.",
  },
  {
    title: "Manual payroll",
    description:
      "Calculate runs, export bank files, and mark salaries paid offline.",
  },
  {
    title: "Shoutouts",
    description:
      "Recognize teammates with points and a shared appreciation feed.",
  },
  {
    title: "Teams & analytics",
    description:
      "Departments, reporting lines, and lightweight workforce insights.",
  },
  {
    title: "Trial-first billing",
    description:
      "Start on a free trial. Upgrade manually when you are ready — no card required.",
  },
];

export const LandingFeatures = () => {
  return (
    <section className="border-b" id="features">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">
            Everything your HR team needs
          </h2>
          <p className="mt-3 text-muted-foreground">
            Focused modules that work together — not a bloated suite you will
            never fully configure.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border bg-card p-6"
            >
              <h3 className="font-medium">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
