export const queryKeys = {
  auth: {
    session: ['auth', 'session'] as const,
  },
  tenants: {
    all: ['tenants'] as const,
    current: ['tenants', 'current'] as const,
  },
  employees: {
    all: ['employees'] as const,
    detail: (id: string) => ['employees', id] as const,
  },
  leaves: {
    all: ['leaves'] as const,
    balances: ['leaves', 'balances'] as const,
  },
  departments: {
    all: ['departments'] as const,
  },
  calendar: {
    events: ['calendar', 'events'] as const,
  },
  shoutouts: {
    all: ['shoutouts'] as const,
    categories: ['shoutouts', 'categories'] as const,
    points: (tenantId: string) => ['shoutouts', 'points', tenantId] as const,
  },
  integrations: {
    shoutoutSlackStatus: (tenantId: string) => ['integrations', 'shoutout-slack', tenantId] as const,
    slackChannels: (integrationId: string) => ['integrations', 'slack-channels', integrationId] as const,
  },
  payroll: {
    all: ['payroll'] as const,
    detail: (id: string) => ['payroll', id] as const,
  },
  recruitment: {
    jobs: ['recruitment', 'jobs'] as const,
    job: (id: string) => ['recruitment', 'jobs', id] as const,
    candidates: (jobId: string) => ['recruitment', 'candidates', jobId] as const,
    allCandidates: ['recruitment', 'allCandidates'] as const,
  },
  billing: {
    status: (tenantId: string) => ['billing', tenantId] as const,
    overview: (tenantId: string) => ['billing', 'overview', tenantId] as const,
  },
  paymentMethods: {
    all: ['payment-methods'] as const,
    currencies: ['payment-methods', 'currencies'] as const,
    pending: ['payment-methods', 'pending'] as const,
  },
  member: {
    profile: (tenantId: string) => ['member', 'profile', tenantId] as const,
  },
  onboarding: {
    pricing: ['onboarding', 'pricing'] as const,
    slugAvailability: (slug: string) => ['onboarding', 'slug-availability', slug] as const,
  },
  analytics: {
    overview: ['analytics', 'overview'] as const,
  },
} as const;
