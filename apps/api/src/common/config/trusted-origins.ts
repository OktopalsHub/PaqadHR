/**
 * Resolves CORS / CSRF trusted origins from env.
 * TRUSTED_ORIGINS is canonical (Teamlyf-style); older names are supported.
 */
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
