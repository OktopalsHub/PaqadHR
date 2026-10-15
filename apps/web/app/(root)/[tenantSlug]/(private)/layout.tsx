import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ForgottenSessionModal } from '@/features/attendance/components/forgotten-session-modal';
import { SubscriptionGate } from '@/features/billing/components/subscription-gate';
import { UpgradePrompt } from '@/features/billing/components/upgrade-prompt';
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
              <SidebarInset className="min-h-svh min-w-0 bg-background">
                <AppTopBar />
                <main className="app-page-canvas flex-1 overflow-y-auto px-3 pb-3 pt-5 sm:px-4 sm:py-4 md:px-5 md:py-5 lg:px-6 lg:py-6">
                  <UpgradePrompt>{children}</UpgradePrompt>
                </main>
              </SidebarInset>
              <ForgottenSessionModal />
            </BreadcrumbProvider>
          </SidebarProvider>
        </SubscriptionGate>
      </TenantSlugGate>
    </AppGate>
  );
}
