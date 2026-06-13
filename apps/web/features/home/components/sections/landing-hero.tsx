import Link from "next/link";
import { Button } from "@/components/ui/button";

export const LandingHero = () => {
  return (
    <section className="border-b">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-medium text-muted-foreground">
            People operations for modern teams
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-6xl md:leading-[1.1]">
            HR, payroll, and team culture in one calm workspace.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Paqad helps you manage employees, run offline payroll, track leave,
            and celebrate wins — without juggling a dozen tools.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">Get started</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/signin">Sign in</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            14-day trial · No card required · Setup in minutes
          </p>
        </div>
      </div>
    </section>
  );
};
