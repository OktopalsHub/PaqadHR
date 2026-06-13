import {
  Briefcase,
  Calendar,
  Heart,
  Shield,
  Users,
  Wallet,
} from "lucide-react";

export const features = [
  {
    icon: <Users className="size-8" />,
    title: "Employee management",
    description:
      "Directory, org structure, documents, and employment records in one place.",
    color: "from-emerald-500 to-emerald-600",
    benefits: ["Employee profiles", "Org structure", "Document storage"],
  },
  {
    icon: <Briefcase className="size-8" />,
    title: "Recruitment",
    description:
      "Publish job openings, track candidates, and manage interviews.",
    color: "from-green-500 to-green-600",
    benefits: ["Job postings", "Candidate pipeline", "Interview scheduling"],
  },
  {
    icon: <Wallet className="size-8" />,
    title: "Manual payroll",
    description:
      "Calculate payroll runs, export bank files, and mark salaries paid offline.",
    color: "from-teal-500 to-teal-600",
    benefits: ["Payroll runs", "Bank exports", "Offline disbursement"],
  },
  {
    icon: <Shield className="size-8" />,
    title: "Access & security",
    description:
      "Role-based access, audit logs, and tenant-scoped data isolation.",
    color: "from-emerald-600 to-emerald-700",
    benefits: ["RBAC", "Audit trail", "Tenant isolation"],
  },
  {
    icon: <Calendar className="size-8" />,
    title: "Leave & calendar",
    description:
      "Request time off, track balances, and see team availability.",
    color: "from-lime-500 to-lime-600",
    benefits: ["Leave requests", "Balance tracking", "Team calendar"],
  },
  {
    icon: <Heart className="size-8" />,
    title: "Shoutouts",
    description:
      "Recognize teammates with points and a shared appreciation feed.",
    color: "from-green-400 to-green-500",
    benefits: ["Peer recognition", "Points system", "Team feed"],
  },
];
