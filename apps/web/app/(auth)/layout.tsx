import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-2">
        <div className="hidden flex-col justify-between border-r p-12 lg:flex">
          <div>
            <p className="text-sm font-semibold tracking-tight">Paqad</p>
            <h1 className="mt-16 text-3xl font-semibold tracking-tight">
              People operations, simplified.
            </h1>
            <p className="mt-4 max-w-md text-muted-foreground">
              Manage employees, leave, payroll exports, and team recognition in
              one focused workspace.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            14-day trial · No card required
          </p>
        </div>
        <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
