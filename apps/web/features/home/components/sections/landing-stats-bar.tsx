'use client';

import { motion, useInView } from 'framer-motion';
import { Clock, Shield, Sparkles, Users } from 'lucide-react';
import { useRef } from 'react';
import { fadeUp, stagger } from '../../constants/landing-motion';
import '../landing.css';

const stats = [
  { value: '14 days', label: 'Free trial', icon: Sparkles },
  { value: 'One app', label: 'HR to payroll', icon: Users },
  { value: 'Minutes', label: 'To first workspace', icon: Clock },
  { value: 'Tenant-scoped', label: 'Data isolation', icon: Shield },
];

export const LandingStats = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.section
      ref={ref}
      className="landing-stats-bar"
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      variants={stagger}
    >
      <div className="landing-stats-inner">
        {stats.map((s) => (
          <motion.div key={s.label} variants={fadeUp} className="landing-stat-item">
            <span className="landing-stat-value">{s.value}</span>
            <span className="landing-stat-label">{s.label}</span>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
};
