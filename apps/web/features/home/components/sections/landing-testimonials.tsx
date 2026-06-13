import { Star } from "lucide-react";
import { testimonials } from "../../constants";

export const LandingTestimonials = () => {
  return (
    <section className="py-24 md:py-28" id="testimonials">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">Testimonials</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Teams that switched to Paqad
          </h2>
          <p className="mt-4 text-muted-foreground">
            Real feedback from people ops leaders building calmer HR stacks.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <article
              key={testimonial.name}
              className="flex flex-col rounded-2xl border border-border/60 bg-card/50 p-6"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="size-4 fill-primary text-primary"
                  />
                ))}
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                &ldquo;{testimonial.content}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-border/50 pt-5">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="text-sm font-medium">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
