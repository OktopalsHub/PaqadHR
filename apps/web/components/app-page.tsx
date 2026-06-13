import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AppPageProps = {
  children: ReactNode;
  className?: string;
};

export function AppPage({ children, className }: AppPageProps) {
  return (
    <div className={cn("w-full space-y-5", className)}>{children}</div>
  );
}
