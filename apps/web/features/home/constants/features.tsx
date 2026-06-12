import { DollarSign, Globe, Shield, Star, Users, Zap } from "lucide-react";

export const features = [
  {
    icon: <Users className="w-8 h-8" />,
    title: "Complete HR Suite",
    description:
      "Employee management, time tracking, performance reviews, and compliance - all integrated seamlessly.",
    color: "from-blue-500 to-blue-600",
    benefits: [
      "360° employee profiles",
      "Automated workflows",
      "Compliance tracking",
    ],
  },
  {
    icon: <Zap className="w-8 h-8" />,
    title: "AI-Powered Recruitment",
    description:
      "Smart candidate matching, automated screening, and bias-free hiring with our advanced AI algorithms.",
    color: "from-green-500 to-green-600",
    benefits: ["CV screening", "Skill matching", "Interview scheduling"],
  },
  {
    icon: <DollarSign className="w-8 h-8" />,
    title: "Multi-Currency Payroll",
    description:
      "Pay globally in 150+ currencies including crypto (USDT, ETH, BTC) with automated tax calculations.",
    color: "from-purple-500 to-purple-600",
    benefits: ["Crypto payments", "Global compliance", "Instant transfers"],
  },
  {
    icon: <Shield className="w-8 h-8" />,
    title: "Enterprise Security",
    description:
      "Bank-grade security with SOC 2 compliance, 2FA, audit logs, and granular access controls.",
    color: "from-red-500 to-red-600",
    benefits: ["SOC 2 certified", "Zero-trust architecture", "Data encryption"],
  },
  {
    icon: <Globe className="w-8 h-8" />,
    title: "Global Remote Teams",
    description:
      "Manage distributed teams with timezone tracking, virtual attendance, and cultural insights.",
    color: "from-indigo-500 to-indigo-600",
    benefits: [
      "Multi-timezone support",
      "Virtual check-ins",
      "Cultural calendar",
    ],
  },
  {
    icon: <Star className="w-8 h-8" />,
    title: "Performance Analytics",
    description:
      "Data-driven insights with customizable dashboards, predictive analytics, and ROI tracking.",
    color: "from-yellow-500 to-yellow-600",
    benefits: ["Predictive insights", "Custom reports", "ROI tracking"],
  },
];
