import type { Metadata } from "next";
import { LandingPage } from "@/features/home/components/landing-page";
import { LandingJsonLd } from "@/features/home/components/landing-json-ld";

export const metadata: Metadata = {
  title: "Paqad — People operations for modern teams",
  description:
    "Hire, pay, and support your team with calm HR software. Recruitment, payroll, leave, and recognition in one workspace. Start your 14-day trial.",
  keywords: [
    "HR software",
    "people operations",
    "recruitment software",
    "payroll management",
    "leave management",
    "employee management",
    "HR platform Nigeria",
    "team shoutouts",
  ],
  openGraph: {
    title: "Paqad — People operations for modern teams",
    description:
      "Calm HR software for hiring, payroll, leave, and team recognition. Start your 14-day trial.",
    type: "website",
    siteName: "Paqad",
  },
  twitter: {
    card: "summary_large_image",
    title: "Paqad — People operations for modern teams",
    description:
      "Calm HR software for hiring, payroll, leave, and team recognition.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function Home() {
  return (
    <LandingJsonLd>
      <LandingPage />
    </LandingJsonLd>
  );
}
