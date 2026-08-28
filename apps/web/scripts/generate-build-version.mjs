import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildId =
  process.env.NEXT_PUBLIC_APP_BUILD_ID?.trim() ||
  process.env.GITHUB_SHA?.slice(0, 7) ||
  `dev-${Date.now()}`;

const publicDir = join(webRoot, 'public');
mkdirSync(publicDir, { recursive: true });

const payload = {
  buildId,
  builtAt: new Date().toISOString(),
};

writeFileSync(join(publicDir, 'version.json'), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`[build-version] wrote public/version.json buildId=${buildId}`);
