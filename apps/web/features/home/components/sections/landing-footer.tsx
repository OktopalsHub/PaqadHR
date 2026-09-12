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
    <footer className="bg-[#102b24] py-14 text-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-10 border-b border-white/10 pb-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4 sm:col-span-2 lg:col-span-1">
            <div className="hidden brightness-0 invert sm:block">
              <PaqadLogo />
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-[#b8d0c6]">{COMPANY.poweredBy}</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8ec5b2]">
              Company
            </p>
            <ul className="space-y-2.5 text-sm text-[#c8dcd4]">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8ec5b2]">
              Legal
            </p>
            <ul className="space-y-2.5 text-sm text-[#c8dcd4]">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 text-sm text-[#c8dcd4]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8ec5b2]">
              Contact
            </p>
            <a
              href={`mailto:${COMPANY.email}`}
              className="block transition-colors hover:text-white"
            >
              {COMPANY.email}
            </a>
          </div>
        </div>

        <p className="mt-7 text-xs text-[#8eb7a8]">
          © {new Date().getFullYear()} {COMPANY.legalName}
        </p>
      </div>
    </footer>
  );
};
