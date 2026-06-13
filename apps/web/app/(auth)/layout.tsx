import type { ReactNode } from "react";
import { PaqadLogo } from "@/components/paqad-logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="theme-marketing hidden flex-col justify-between border-r border-border bg-background p-12 lg:flex">
          <PaqadLogo />
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.02em]">
              Get better at people operations with Paqad.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Hire, pay, and support your team in a workspace built for focus.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            14 days free · No card required
          </p>
        </div>
        <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
          <div className="mb-8 lg:hidden">
            <PaqadLogo />
          </div>
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
