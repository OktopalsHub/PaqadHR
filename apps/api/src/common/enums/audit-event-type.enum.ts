export enum AuditEventType {
    PAYROLL_CREATED = 'payroll_created',
    PAYROLL_PROCESSED = 'payroll_processed',
    PAYROLL_CANCELLED = 'payroll_cancelled',
    PAYMENT_SENT = 'payment_sent',
    PAYMENT_FAILED = 'payment_failed',
    TAX_CALCULATED = 'tax_calculated',
    DEDUCTION_APPLIED = 'deduction_applied',
    BONUS_APPLIED = 'bonus_applied',
    COMPLIANCE_CHECK = 'compliance_check'
}
