import { COMPANY } from '@/lib/constants/company';

/**
 * RFC 9116 security contact file. It gives vulnerability reporters a machine-readable
 * way to find us, which is the first thing a security review looks for.
 */
export const dynamic = 'force-static';

export function GET() {
  const body = [
    `Contact: mailto:${COMPANY.email}`,
    'Expires: 2027-10-20T00:00:00.000Z',
    'Preferred-Languages: en',
    `Policy: ${COMPANY.website}/security#report`,
    'Canonical: https://paqadhr.com/.well-known/security.txt',
  ].join('\n');

  return new Response(`${body}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
