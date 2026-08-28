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
  invitations: {
    all: ['invitations'] as const,
  },
  positions: {
    all: ['positions'] as const,
  },
  leaves: {
    all: ['leaves'] as const,
    balances: ['leaves', 'balances'] as const,
    assignments: ['leaves', 'assignments'] as const,
  },
  departments: {
    all: ['departments'] as const,
  },
  attendance: {
    policies: ['attendance', 'policies'] as const,
    clockInInfo: ['attendance', 'clock-in-info'] as const,
    myRecords: ['attendance', 'my-records'] as const,
    teamRecords: ['attendance', 'team-records'] as const,
    monthly: ['attendance', 'monthly'] as const,
    today: ['attendance', 'today'] as const,
    stats: ['attendance', 'stats'] as const,
    exceptions: ['attendance', 'exceptions'] as const,
    dailyReport: ['attendance', 'daily-report'] as const,
    monthlyReport: ['attendance', 'monthly-report'] as const,
    sessionLimit: ['attendance', 'session-limit'] as const,
    sessionCount: ['attendance', 'session-count'] as const,
  },
  calendar: {
    events: ['calendar', 'events'] as const,
  },
  settings: {
    tenant: ['settings', 'tenant'] as const,
    leavePolicy: ['settings', 'leave-policy'] as const,
    leaveTypes: ['settings', 'leave-types'] as const,
    shoutoutCategories: ['settings', 'shoutout-categories'] as const,
    membersPoints: ['settings', 'members-points'] as const,
    holidays: ['settings', 'holidays'] as const,
    holidayCountries: ['settings', 'holiday-countries'] as const,
  },
  shoutouts: {
    all: ['shoutouts'] as const,
    categories: ['shoutouts', 'categories'] as const,
    points: (tenantId: string) => ['shoutouts', 'points', tenantId] as const,
  },
  integrations: {
    shoutoutSlackStatus: (tenantId: string) =>
      ['integrations', 'shoutout-slack', tenantId] as const,
    slackChannels: (integrationId: string) =>
      ['integrations', 'slack-channels', integrationId] as const,
    syncStatus: (integrationId: string) => ['integrations', 'sync-status', integrationId] as const,
    unmatchedUsers: (integrationId: string) =>
      ['integrations', 'unmatched-users', integrationId] as const,
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
  plans: {
    all: ['plans', 'all'] as const,
    detect: ['plans', 'detect'] as const,
    country: (code: string) => ['plans', 'country', code] as const,
    admin: ['plans', 'admin'] as const,
    prices: (countryCode: string) => ['plans', 'prices', countryCode] as const,
  },
  billing: {
    status: (tenantId: string) => ['billing', tenantId] as const,
    overview: (tenantId: string) => ['billing', 'overview', tenantId] as const,
  },
  paymentMethods: {
    all: ['payment-methods'] as const,
    currencies: ['payment-methods', 'currencies'] as const,
    pending: ['payment-methods', 'pending'] as const,
    passcodeStatus: ['payment-methods', 'passcode-status'] as const,
    banks: (tenantId: string) => ['payment-methods', 'banks', tenantId] as const,
  },
  member: {
    profile: (tenantId: string) => ['member', 'profile', tenantId] as const,
  },
  onboarding: {
    pricing: (country?: string) => ['onboarding', 'pricing', country ?? 'auto'] as const,
    slugAvailability: (slug: string) => ['onboarding', 'slug-availability', slug] as const,
  },
  analytics: {
    overview: ['analytics', 'overview'] as const,
  },
  notifications: {
    list: ['notifications', 'list'] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  privacy: {
    consent: ['privacy', 'consent'] as const,
  },
  activities: {
    list: (tenantId: string) => ['activities', 'list', tenantId] as const,
  },
  rewards: {
    catalog: ['rewards', 'catalog'] as const,
    claims: ['rewards', 'claims'] as const,
    allClaims: ['rewards', 'all-claims'] as const,
    wallet: ['rewards', 'wallet'] as const,
    walletTransactions: ['rewards', 'wallet-transactions'] as const,
    custom: ['rewards', 'custom'] as const,
    providers: (tenantId: string) => ['rewards', 'providers', tenantId] as const,
  },
} as const;
