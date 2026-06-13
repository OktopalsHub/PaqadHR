"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { fadeUp } from "../../constants/landing-motion";

const gallery = [
  {
    src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80",
    alt: "Team collaborating in an office",
  },
  {
    src: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80",
    alt: "Professional at work",
  },
  {
    src: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=80",
    alt: "Business team meeting",
  },
];

export function LandingHeroGallery() {
  return (
    <motion.div
      variants={fadeUp}
      className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-4 px-6 sm:grid-cols-3 md:mt-20"
    >
      {gallery.map((item, index) => (
        <div
          key={item.src}
          className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted sm:aspect-[3/4]"
        >
          <Image
            src={item.src}
            alt={item.alt}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 33vw"
            priority={index === 0}
          />
        </div>
      ))}
    </motion.div>
  );
}
