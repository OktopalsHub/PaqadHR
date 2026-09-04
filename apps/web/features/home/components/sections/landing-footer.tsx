import Link from 'next/link';
import { PaqadLogo } from '@/components/paqad-logo';
import { COMPANY } from '@/lib/constants/company';

const companyLinks = [
  { href: '/contact', label: 'Contact' },
  { href: '/signin', label: 'Sign in' },
  { href: '/signup', label: 'Get started' },
] as const;

const legalLinks = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms and Conditions' },
] as const;

export const LandingFooter = () => {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3 sm:col-span-2 lg:col-span-1">
            <PaqadLogo />
            <p className="text-sm text-muted-foreground">{COMPANY.poweredBy}</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Company</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Legal</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Contact</p>
            <a href={`mailto:${COMPANY.email}`} className="block hover:text-foreground">
              {COMPANY.email}
            </a>
          </div>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          © {new Date().getFullYear()} {COMPANY.legalName}
        </p>
      </div>
    </footer>
  );
};
