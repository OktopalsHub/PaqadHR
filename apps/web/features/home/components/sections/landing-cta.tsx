import Link from "next/link";
import { Button } from "@/components/ui/button";

export const LandingCta = () => {
  return (
    <section className="border-b">
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">
          Start with a calmer HR stack
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Create your workspace and try Paqad free for 14 days.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/signup">Get started</Link>
        </Button>
      </div>
    </section>
  );
};
