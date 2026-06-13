"use client";

import { motion } from "framer-motion";
import { scaleIn } from "../../constants/landing-motion";

const rows = [
  { name: "Ada O.", role: "Product Designer", status: "Interview", tone: "text-primary" },
  { name: "Kofi M.", role: "Backend Engineer", status: "Offer", tone: "text-foreground" },
  { name: "Zara L.", role: "People Ops", status: "Screening", tone: "text-muted-foreground" },
];

export function LandingHeroMockup() {
  return (
    <motion.div
      className="relative mx-auto mt-16 max-w-5xl px-6 md:mt-20"
      initial="hidden"
      animate="show"
      variants={scaleIn}
    >
      <div className="landing-frame-glow absolute -inset-px rounded-2xl" />

      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{
          duration: 6,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
        className="relative"
      >
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[oklch(0.12_0.015_155)] shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
            <div className="flex gap-1.5">
              <span className="size-2 rounded-full bg-white/20" />
              <span className="size-2 rounded-full bg-white/20" />
              <span className="size-2 rounded-full bg-white/20" />
            </div>
            <span className="ml-1 text-[11px] text-muted-foreground/70">
              paqad.app
            </span>
          </div>

          <div className="grid md:grid-cols-[168px_1fr]">
            <aside className="hidden border-r border-white/[0.06] p-3 md:block">
              <div className="mb-4 flex items-center gap-2 px-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[10px] font-semibold text-primary-foreground">
                  P
                </span>
                <span className="text-xs font-medium">Paqad</span>
              </div>
              {["Dashboard", "Employees", "Recruitment", "Payroll", "Leave"].map(
                (item, i) => (
                  <div
                    key={item}
                    className={`mb-0.5 rounded-md px-2 py-1.5 text-[11px] ${
                      i === 2
                        ? "bg-white/[0.06] text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {item}
                  </div>
                ),
              )}
            </aside>

            <div className="p-5 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Recruitment</p>
                  <p className="text-xs text-muted-foreground">3 active roles</p>
                </div>
                <span className="rounded-md border border-white/[0.08] px-2 py-1 text-[10px] text-muted-foreground">
                  March 2026
                </span>
              </div>

              <div className="mt-5 space-y-2">
                {rows.map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <div>
                      <p className="text-xs font-medium">{row.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {row.role}
                      </p>
                    </div>
                    <span className={`text-[10px] ${row.tone}`}>{row.status}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { label: "Headcount", value: "124" },
                  { label: "On leave", value: "8" },
                  { label: "Open roles", value: "3" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-white/[0.06] px-3 py-2"
                  >
                    <p className="text-[10px] text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="text-sm font-medium">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
