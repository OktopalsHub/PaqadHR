
export function resolveTrustedOrigins(): string[] {
  const raw =
    process.env.TRUSTED_ORIGINS ||
    process.env.ALLOWED_ORIGINS ||
    process.env.CORS_ALLOWED_ORIGINS ||
    '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
