import Signup from '@/features/auth/components/signup';

/**
 * This page looks the same to every visitor, so it is served from the edge
 * cache and revalidated every 60 seconds instead of being rendered per request.
 */
export const revalidate = 60;

export default function SignupPage() {
  return <Signup />;
}
