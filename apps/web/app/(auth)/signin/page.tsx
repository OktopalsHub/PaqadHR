import { Suspense } from 'react';
import { LoadingBlock } from '@/components/loading-block';
import { Login } from '@/features/auth/components/login';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[280px] items-center justify-center">
          <LoadingBlock />
        </div>
      }
    >
      <Login />
    </Suspense>
  );
}
