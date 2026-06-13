import { Check } from "lucide-react";
import { showcases } from "../../constants";

function ShowcaseMock({ variant }: { variant: "recruitment" | "payroll" | "culture" }) {
  if (variant === "recruitment") {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xl shadow-black/20">
        <p className="text-xs font-medium text-primary">Open roles</p>
        <div className="mt-4 space-y-2">
          {[
            { role: "Product Designer", stage: "Interview", count: 4 },
            { role: "Backend Engineer", stage: "Screening", count: 12 },
            { role: "People Ops", stage: "Offer", count: 2 },
          ].map((row) => (
            <div
              key={row.role}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2.5"
            >
              <span className="text-sm">{row.role}</span>
              <span className="text-[10px] text-muted-foreground">
                {row.stage} · {row.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "payroll") {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xl shadow-black/20">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-primary">March payroll</p>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
            Approved
          </span>
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gross total</span>
            <span className="font-medium">₦ 4,820,000</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Employees</span>
            <span className="font-medium">124</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-4/5 rounded-full bg-primary" />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Bank file ready for export
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xl shadow-black/20">
      <p className="text-xs font-medium text-primary">Recent shoutouts</p>
      <div className="mt-4 space-y-3">
        {[
          { from: "Ada", to: "Kofi", msg: "Crushed the launch week" },
          { from: "Zara", to: "Team", msg: "Smooth onboarding for 3 hires" },
        ].map((item) => (
          <div
            key={item.msg}
            className="rounded-lg border border-border/50 bg-background/40 p-3"
          >
            <p className="text-[10px] text-muted-foreground">
              {item.from} → {item.to}
            </p>
            <p className="mt-1 text-sm">{item.msg}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const LandingShowcase = () => {
  return (
    <section className="py-24 md:py-28" id="solutions">
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
                  reversed ? "lg:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-primary">
                    {item.eyebrow}
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                    {item.title}
                  </h3>
                  <p className="mt-4 leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
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
                  <ShowcaseMock variant={item.mockVariant} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
