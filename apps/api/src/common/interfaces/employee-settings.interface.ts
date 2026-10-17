export interface EmployeeSettings {
  numberPrefix: string;
  numberPadding: number;
  /**
   * Retained for a workspace's prior choice. No longer honoured: BVN/NIN collection is
   * hidden from the UI, so see `TenantConfigService.requireIdentityForPayroll`.
   */
  requireIdentityForPayroll?: boolean;
}
