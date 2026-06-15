import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';

export const LandingFooter = () => {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <PaqadLogo />
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href="/signin" className="hover:text-foreground">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-foreground">
            Get started
          </Link>
          <a href="#" className="hover:text-foreground">
            Privacy
          </a>
          <a href="#" className="hover:text-foreground">
            Terms
          </a>
        </div>
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Paqad</p>
      </div>
    </footer>
  );
};
