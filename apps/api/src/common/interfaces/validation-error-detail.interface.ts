export interface ValidationErrorDetail {
  field: string;
  value: unknown;
  constraints: string[];
}
