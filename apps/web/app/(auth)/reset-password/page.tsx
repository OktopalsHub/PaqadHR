import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  return <ResetPasswordForm token={typeof token === 'string' ? token : ''} />;
}
