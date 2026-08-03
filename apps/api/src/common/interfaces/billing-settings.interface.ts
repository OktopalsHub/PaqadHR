export interface BillingSettings {
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
  /** Workspace BVN — encrypted at rest. */
  identityBvn?: string;
  /** Workspace NIN — encrypted at rest. */
  identityNin?: string;
  /** @deprecated migrated to identityBvn */
  monnifyBvn?: string;
  /** @deprecated migrated to identityNin */
  monnifyNin?: string;
  hasIdentityBvn?: boolean;
  hasIdentityNin?: boolean;
}
