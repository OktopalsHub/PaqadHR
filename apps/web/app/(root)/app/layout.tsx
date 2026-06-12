import { Card } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/navigations/components/app-sidebar";
import { AppTopBar } from "@/features/navigations/components/app-topbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider className="!bg-card">
      <AppSidebar />
      <SidebarInset className="relative">
        <div className="sticky top-0 z-40 w-full">
          <header className="flex h-10 shrink-0 items-center gap-2 border-b bg-Card backdrop-blur supports-[backdrop-filter]:bg-card">
            <AppTopBar />
          </header>
        </div>
        <Card className="flex flex-1 flex-col p-0 rounded-none py-2">
          {children}
        </Card>
      </SidebarInset>
    </SidebarProvider>
  );
}
