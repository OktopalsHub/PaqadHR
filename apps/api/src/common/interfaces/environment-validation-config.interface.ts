export interface EnvironmentValidationConfig {
  critical: string[];
  productionRequired: string[];
  neverAllowFallbacks: string[];
  customValidations: Record<string, (value: string) => boolean>;
  minLengthRequirements: Record<string, number>;
}
