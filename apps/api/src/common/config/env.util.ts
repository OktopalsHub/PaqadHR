export function getRequired(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value.trim();
}

export function getOptional(key: string, defaultValue = ''): string {
  return process.env[key]?.trim() || defaultValue;
}

export function getRequiredNumber(key: string): number {
  const value = getRequired(key);
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
  }
  return num;
}

export function getOptionalNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    return defaultValue;
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
  }
  return num;
}

export function getRequiredBoolean(key: string): boolean {
  return getRequired(key).toLowerCase() === 'true';
}

export function getOptionalBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}
