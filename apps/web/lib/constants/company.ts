/**
 * Public company details for the marketing site.
 *
 * `social` feeds `Organization.sameAs` and the marketing footer. Leave a profile
 * empty until it is live — empty entries are omitted everywhere rather than
 * publishing a dead link or an unverifiable identity claim.
 */
export const COMPANY = {
  legalName: 'Oktopals Limited',
  productName: 'Paqad',
  productFullName: 'PaqadHR',
  poweredBy: 'Paqad powered by Oktopals Limited',
  email: 'info@paqadhr.com',
  website: 'https://paqadhr.com',
  social: {
    linkedin: '',
    x: '',
    youtube: '',
    github: '',
    g2: '',
    capterra: '',
    crunchbase: '',
  },
  /**
   * People who are publicly attributable to the company. Empty by default: an
   * entry without a name is not a fact, and inventing one would end up in a
   * model's answer as a claim. Add a person with their own `sameAs` profiles and
   * the `Person` schema appears on the about page automatically.
   */
  team: [] as Array<{ name: string; role: string; sameAs: string[] }>,
} as const;

export function companySameAs(): string[] {
  return Object.values(COMPANY.social).filter((url) => url.length > 0);
}

export function companyTeam() {
  return COMPANY.team.filter((person) => person.name.trim().length > 0);
}
