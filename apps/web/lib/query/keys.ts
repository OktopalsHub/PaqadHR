export const queryKeys = {
  auth: {
    session: ["auth", "session"] as const,
  },
  tenants: {
    all: ["tenants"] as const,
    current: ["tenants", "current"] as const,
  },
  employees: {
    all: ["employees"] as const,
    detail: (id: string) => ["employees", id] as const,
  },
  leaves: {
    all: ["leaves"] as const,
    balances: ["leaves", "balances"] as const,
  },
  departments: {
    all: ["departments"] as const,
  },
  calendar: {
    events: ["calendar", "events"] as const,
  },
} as const;
