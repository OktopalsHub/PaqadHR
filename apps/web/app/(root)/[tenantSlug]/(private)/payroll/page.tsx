import { AdminOnlyGate } from '@/features/navigations/components/admin-only-gate';
import { PayrollPage } from '@/features/payroll/components/payroll-page';

export default function Page() {
  return (
    <AdminOnlyGate>
      <PayrollPage />
    </AdminOnlyGate>
  );
}
