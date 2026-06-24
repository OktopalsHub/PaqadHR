'use client';

import { motion, useInView } from 'framer-motion';
import { Briefcase, Calendar, Heart, Shield, Users, Wallet } from 'lucide-react';
import { useRef } from 'react';
import { fadeUp, stagger } from '../../constants/landing-motion';
import '../landing.css';

const features = [
  {
    icon: Users,
    title: 'Employee management',
    description: 'Directory, org structure, documents, and employment records in one place.',
    tags: ['Profiles', 'Org chart', 'Documents'],
  },
  {
    icon: Briefcase,
    title: 'Recruitment',
    description: 'Publish job openings, track candidates, and manage your hiring pipeline.',
    tags: ['Job postings', 'Pipeline', 'Interviews'],
  },
  {
    icon: Wallet,
    title: 'Payroll exports',
    description: 'Calculate payroll runs, export bank-ready files, and mark salaries paid offline.',
    tags: ['Runs', 'Bank files', 'Approval'],
  },
  {
    icon: Shield,
    title: 'Access & security',
    description: 'Role-based access, audit logs, and tenant-scoped data isolation built in.',
    tags: ['RBAC', 'Audit trail', 'Isolation'],
  },
  {
    icon: Calendar,
    title: 'Leave & calendar',
    description: 'Request time off, track balances, and see team availability at a glance.',
    tags: ['Leave requests', 'Balances', 'Calendar'],
  },
  {
    icon: Heart,
    title: 'Shoutouts',
    description: 'Recognize teammates with Paq points and a shared appreciation feed.',
    tags: ['Recognition', 'Paq points', 'Feed'],
  },
];

export const LandingFeatures = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section id="features" ref={ref} className="landing-section">
      <motion.div
        initial="hidden"
        animate={inView ? 'show' : 'hidden'}
        variants={stagger}
      >
        <div className="landing-section-header">
          <p className="landing-section-eyebrow">Features</p>
          <h2 className="landing-section-title">
            Built for how teams actually work.
          </h2>
          <p className="landing-section-desc">
            Six core modules. One clean interface. Zero spreadsheet chaos.
          </p>
        </div>

        <div className="landing-features-grid">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div key={f.title} variants={fadeUp} className="landing-feature-card">
                <div className="landing-feature-icon">
                  <Icon />
                </div>
                <h3 className="landing-feature-name">{f.title}</h3>
                <p className="landing-feature-desc">{f.description}</p>
                <div className="landing-feature-tags">
                  {f.tags.map((tag) => (
                    <span key={tag} className="landing-feature-tag">{tag}</span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
};
