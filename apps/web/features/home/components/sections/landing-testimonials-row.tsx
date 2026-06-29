'use client';

import { motion, useInView } from 'framer-motion';
import { Star } from 'lucide-react';
import { useRef } from 'react';
import { fadeUp, stagger } from '../../constants/landing-motion';
import { testimonials } from '../../constants/testimonals';
import '../landing.css';

export const LandingTestimonials = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section id="testimonials" ref={ref} className="landing-testimonials-section">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <motion.div initial="hidden" animate={inView ? 'show' : 'hidden'} variants={stagger}>
          <div className="landing-section-header">
            <p className="landing-section-eyebrow">Testimonials</p>
            <h2 className="landing-section-title">Trusted by people teams.</h2>
          </div>

          <div
            className="landing-testimonials-grid"
            style={{ borderRadius: 16, overflow: 'hidden' }}
          >
            {testimonials.map((t) => (
              <motion.div key={t.name} variants={fadeUp} className="landing-testimonial-card">
                <div className="landing-testimonial-stars">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={`star-${t.name}-${i}`} size={14} />
                  ))}
                </div>
                <p className="landing-testimonial-quote">&ldquo;{t.content}&rdquo;</p>
                <div className="landing-testimonial-author">
                  <span className="landing-testimonial-avatar">{t.avatar}</span>
                  <div>
                    <p className="landing-testimonial-name">{t.name}</p>
                    <p className="landing-testimonial-role">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
