import type { ReactNode } from "react";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-6">
          <span className="text-sm font-semibold tracking-tight">Paqad</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">{children}</main>
    </div>
  );
}
