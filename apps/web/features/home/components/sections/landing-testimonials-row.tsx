import { Star } from 'lucide-react';
import { testimonials } from '../../constants/testimonals';
import '../landing.css';

export const LandingTestimonials = () => {
  return (
    <section id="testimonials" className="landing-testimonials-section">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <div>
          <div className="landing-section-header">
            <p className="landing-section-eyebrow">Testimonials</p>
            <h2 className="landing-section-title">Trusted by people teams.</h2>
          </div>

          <div
            className="landing-testimonials-grid"
            style={{ borderRadius: 16, overflow: 'hidden' }}
          >
            {testimonials.map((t) => (
              <div key={t.name} className="landing-testimonial-card">
                <div className="landing-testimonial-stars">
                  {[1, 2, 3, 4, 5].slice(0, t.rating).map((star) => (
                    <Star key={`star-${t.name}-${star}`} size={14} />
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
