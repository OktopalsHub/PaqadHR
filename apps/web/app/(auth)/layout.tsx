import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  // title: string;
  // subtitle: string;
}
export default async function AuthLayout({
  children,
  // title,
  // subtitle,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-modern-purple-600 via-modern-blue-600 to-modern-emerald-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="max-w-md">
            <h1 className="text-4xl font-bold mb-6">Welcome to Modern HRMS</h1>
            <p className="text-xl text-white/90 mb-8">
              Streamline your workforce management with our comprehensive HR
              platform. Manage employees, track attendance, handle payroll, and
              boost productivity all in one place.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-white rounded-full" />
                <span>Employee Management & Onboarding</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-white rounded-full" />
                <span>Attendance & Leave Tracking</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-white rounded-full" />
                <span>Performance Reviews & Analytics</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-white rounded-full" />
                <span>Payroll & Recruitment Management</span>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
      </div>

      {/* Right side - Auth Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 bg-background">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl h-12 w-12 flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
              HR
            </div>
            {/* <h2 className="text-3xl font-bold text-foreground">{title}</h2> */}
            {/* <p className="text-muted-foreground mt-2">{subtitle}</p> */}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
