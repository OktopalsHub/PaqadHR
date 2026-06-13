import Link from "next/link";

export const LandingFooter = () => {
  return (
    <footer className="py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground md:flex-row">
        <span className="font-medium text-foreground">Paqad</span>
        <div className="flex gap-6">
          <Link href="/signin">Sign in</Link>
          <Link href="/signup">Sign up</Link>
        </div>
        <p>© {new Date().getFullYear()} Paqad</p>
      </div>
    </footer>
  );
};
