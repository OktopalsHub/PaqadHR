import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ForgottenSessionModal } from '@/features/attendance/components/forgotten-session-modal';
import { SubscriptionGate } from '@/features/billing/components/subscription-gate';
import { AppGate } from '@/features/navigations/components/app-gate';
import { AppSidebar } from '@/features/navigations/components/app-sidebar';
import { AppTopBar } from '@/features/navigations/components/app-topbar';
import { TenantSlugGate } from '@/features/navigations/components/tenant-slug-gate';
import { BreadcrumbProvider } from '@/providers/breadcrumb-provider';

export default function TenantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppGate>
      <TenantSlugGate>
        <SubscriptionGate>
          <SidebarProvider>
            <BreadcrumbProvider>
              <AppSidebar />
              <SidebarInset className="min-h-svh bg-background">
                <AppTopBar />
                <main className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5">{children}</main>
              </SidebarInset>
              <ForgottenSessionModal />
            </BreadcrumbProvider>
          </SidebarProvider>
        </SubscriptionGate>
      </TenantSlugGate>
    </AppGate>
  );
}
