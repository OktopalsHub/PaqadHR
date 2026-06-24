'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { DemoNavId } from '../../constants/landing-demo-data';
import { demoNavOrder } from '../../constants/landing-demo-data';
import { DemoSidebar } from './demo-sidebar';
import { DemoTopbar } from './demo-topbar';
import { DemoWindowChrome } from './demo-window-chrome';
import { DashboardDemoView } from './views/dashboard-demo-view';
import { LeavesDemoView } from './views/leaves-demo-view';
import { PayrollDemoView } from './views/payroll-demo-view';
import { RecruitmentDemoView } from './views/recruitment-demo-view';
import { ShoutoutsDemoView } from './views/shoutouts-demo-view';

const ROTATE_MS = 8000;

type ProductDemoShellProps = {
  compact?: boolean;
  className?: string;
};

export function ProductDemoShell({ compact, className }: ProductDemoShellProps) {
  const baseId = useId();
  const navIds = demoNavOrder.map((nav) => `${baseId}-nav-${nav}`);
  const [activeNav, setActiveNav] = useState<DemoNavId>('dashboard');
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  const rotateNext = useCallback(() => {
    setActiveNav((current) => {
      const index = demoNavOrder.indexOf(current);
      return demoNavOrder[(index + 1) % demoNavOrder.length];
    });
  }, []);

  useEffect(() => {
    if (reduceMotion || paused) return;
    const timer = window.setInterval(rotateNext, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, reduceMotion, rotateNext]);

  const renderView = () => {
    switch (activeNav) {
      case 'dashboard':
        return <DashboardDemoView compact={compact} />;
      case 'payroll':
        return <PayrollDemoView compact={compact} />;
      case 'shoutouts':
        return <ShoutoutsDemoView compact={compact} />;
      case 'leaves':
        return <LeavesDemoView compact={compact} />;
      default:
        return <RecruitmentDemoView compact={compact} />;
    }
  };

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) {
          setPaused(false);
        }
      }}
    >
      <DemoWindowChrome>
        <div className="flex min-h-[360px] md:min-h-[420px]" role="tablist" aria-label="Product demo sections">
          <DemoSidebar
            activeNav={activeNav}
            onNavChange={setActiveNav}
            navIds={navIds}
            compact={compact}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <DemoTopbar activeNav={activeNav} />
            <div className="relative min-h-0 flex-1 overflow-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeNav}
                  id={`demo-panel-${activeNav}`}
                  role="tabpanel"
                  aria-labelledby={`${baseId}-nav-${activeNav}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderView()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </DemoWindowChrome>
    </div>
  );
}
