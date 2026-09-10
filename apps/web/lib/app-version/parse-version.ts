/** Strict parse of `/version.json` — only `{ buildId: string }`, reject unknown keys. */
export function parseVersionBuildId(data: unknown): string | null {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;
  const keys = Object.keys(data);
  if (keys.length !== 1 || keys[0] !== 'buildId') return null;
  const buildId = (data as { buildId: unknown }).buildId;
  return typeof buildId === 'string' && buildId.length > 0 ? buildId : null;
}
