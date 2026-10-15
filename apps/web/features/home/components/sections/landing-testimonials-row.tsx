'use client';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useRef } from 'react';
import { fadeUp, stagger } from '../../constants/landing-motion';
import { testimonials } from '../../constants/testimonals';

const avatarPalettes = [
  'bg-[#c6e8dc] text-[#1a5746]',
  'bg-[#e3d6fa] text-[#62438f]',
  'bg-[#f6d5bd] text-[#934e2b]',
  'bg-[#d8edf2] text-[#2d7187]',
  'bg-[#f7e5b5] text-[#90621c]',
  'bg-[#f1d7e0] text-[#9e4c6d]',
  'bg-[#d5e5ca] text-[#4e7443]',
];

export const LandingTestimonials = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="testimonials"
      ref={ref}
      className="relative overflow-hidden bg-[#173c32] py-24 md:py-32"
    >
      <div className="pointer-events-none absolute -left-28 top-0 size-[26rem] rounded-full bg-[#2c6c58] opacity-60 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-0 size-[24rem] rounded-full bg-[#b5825a] opacity-30 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div initial="hidden" animate={inView ? 'show' : 'hidden'} variants={stagger}>
          <div className="mb-12 grid gap-5 md:grid-cols-[0.72fr_1.28fr] md:items-end md:gap-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a9d8c6]">
              In their words
            </p>
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.045em] text-white md:text-5xl md:leading-[1.03]">
                Trusted by people teams.
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-[#c8dcd4]">
                A calmer way of working leaves a mark on the whole company.
              </p>
            </div>
          </div>

          <motion.div
            variants={fadeUp}
            className="relative -mx-6 overflow-hidden px-6 lg:-mx-8 lg:px-8"
          >
            <motion.div
              className="flex w-max"
              animate={reduceMotion ? { x: '0%' } : { x: ['0%', '-50%'] }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 58, ease: 'linear', repeat: Number.POSITIVE_INFINITY }
              }
            >
              {[false, true].map((isDuplicate) => (
                <div key={String(isDuplicate)} className="flex gap-4 pr-4">
                  {testimonials.map((testimonial, index) => (
                    <article
                      key={`${testimonial.name}-${isDuplicate ? 'duplicate' : 'original'}`}
                      aria-hidden={isDuplicate || undefined}
                      className="flex min-h-[272px] w-[18rem] shrink-0 flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.09] p-7 backdrop-blur-sm sm:w-[22rem] md:w-[24rem] md:p-8"
                    >
                      <div className="flex gap-1 text-[#f3c866]">
                        {[1, 2, 3, 4, 5].slice(0, testimonial.rating).map((star) => (
                          <Star
                            key={`star-${testimonial.name}-${star}`}
                            size={14}
                            fill="currentColor"
                          />
                        ))}
                      </div>
                      <p className="mt-6 flex-1 text-[15px] leading-relaxed text-white/90">
                        &ldquo;{testimonial.content}&rdquo;
                      </p>
                      <div className="mt-7 flex items-center gap-3 border-t border-white/10 pt-5">
                        <span
                          className={`flex size-10 items-center justify-center rounded-full text-xs font-bold ${avatarPalettes[index]}`}
                        >
                          {testimonial.avatar}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                          <p className="mt-0.5 text-xs text-[#b8d0c6]">{testimonial.role}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
