import { Login } from '@/features/auth/components/login';

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[]; redirect?: string | string[] }>;
};

function readSearchParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <Login
      googleSignInFailed={readSearchParam(params.error) === 'google'}
      redirect={readSearchParam(params.redirect)}
    />
  );
}
