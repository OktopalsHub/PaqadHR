export interface BillingSettings {
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
  /** Workspace BVN — used for virtual accounts (Nomba/Monnify). Encrypted at rest. */
  identityBvn?: string;
  /** Workspace NIN — used for virtual accounts (Nomba/Monnify). Encrypted at rest. */
  identityNin?: string;
  /** @deprecated migrated to identityBvn */
  monnifyBvn?: string;
  /** @deprecated migrated to identityNin */
  monnifyNin?: string;
  hasIdentityBvn?: boolean;
  hasIdentityNin?: boolean;
  /** Admin requires workspace BVN/NIN before rewards bank account creation. */
  requireWorkspaceKycForVirtualAccounts?: boolean;
}
