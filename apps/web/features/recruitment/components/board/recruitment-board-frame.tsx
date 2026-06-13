import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MOCK_SIDEBAR_ITEMS } from "./board-mock-data";

type RecruitmentBoardFrameProps = {
  children: ReactNode;
  className?: string;
  variant?: "marketing" | "app";
};

export function RecruitmentBoardFrame({
  children,
  className,
  variant = "marketing",
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

      <div className="grid lg:grid-cols-[200px_1fr]">
        <aside
          className={cn(
            "hidden border-r border-border/60 p-3 lg:block",
            isMarketing ? "bg-muted/30" : "bg-muted/20",
          )}
        >
          <div className="mb-4 flex items-center gap-2 px-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[10px] font-semibold text-primary-foreground">
              P
            </span>
            <span className="text-xs font-medium">Paqad</span>
          </div>

          <nav className="space-y-0.5">
            {MOCK_SIDEBAR_ITEMS.map((item) => (
              <div key={item.label}>
                <div
                  className={cn(
                    "rounded-lg px-2 py-1.5 text-[11px]",
                    item.active
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </div>
                {item.children ? (
                  <div className="mt-0.5 space-y-0.5 pl-3">
                    {item.children.map((child, index) => (
                      <div
                        key={child}
                        className={cn(
                          "rounded-md px-2 py-1 text-[10px]",
                          index === 0
                            ? "bg-primary/10 font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {child}
                      </div>
                    ))}
                    <div className="px-2 py-1 text-[10px] text-muted-foreground">
                      + Add board
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 p-4 md:p-5">{children}</div>
      </div>
    </div>
  );
}
