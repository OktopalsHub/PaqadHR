import { Suspense } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
