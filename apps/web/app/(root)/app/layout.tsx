import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/navigations/components/app-sidebar";
import { AppTopBar } from "@/features/navigations/components/app-topbar";
import { AppGate } from "@/features/navigations/components/app-gate";
import { BreadcrumbProvider } from "@/providers/breadcrumb-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppGate>
      <SidebarProvider>
        <BreadcrumbProvider>
          <AppSidebar />
          <SidebarInset className="min-h-svh bg-background">
            <AppTopBar />
            <main className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
              {children}
            </main>
          </SidebarInset>
        </BreadcrumbProvider>
      </SidebarProvider>
    </AppGate>
  );
}
