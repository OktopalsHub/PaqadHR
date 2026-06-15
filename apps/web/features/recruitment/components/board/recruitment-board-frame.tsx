"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LandingMockSidebar } from "@/features/navigations/components/landing-mock-sidebar";

type RecruitmentBoardFrameProps = {
  children: ReactNode;
  className?: string;
  variant?: "marketing" | "app";
  activeHref?: string;
  onNavSelect?: (href: string, name: string) => void;
};

export function RecruitmentBoardFrame({
  children,
  className,
  variant = "marketing",
  activeHref = "/app/recruitment",
  onNavSelect,
}: RecruitmentBoardFrameProps) {
  const isMarketing = variant === "marketing";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border shadow-xl",
        isMarketing
          ? "border-border/80 bg-card shadow-black/10"
          : "border-border/60 bg-card shadow-black/20",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2 rounded-full bg-red-400/80" />
          <span className="size-2 rounded-full bg-amber-400/80" />
          <span className="size-2 rounded-full bg-emerald-400/80" />
        </div>
        <span className="text-[11px] text-muted-foreground">app.paqad.com</span>
      </div>

      <div className="flex min-h-[520px] lg:min-h-[560px]">
        <div className="hidden h-full lg:block">
          <LandingMockSidebar
            activeHref={activeHref}
            onNavSelect={onNavSelect ?? (() => undefined)}
          />
        </div>

        <div className="min-w-0 flex-1 p-4 md:p-5">{children}</div>
      </div>
    </div>
  );
}
