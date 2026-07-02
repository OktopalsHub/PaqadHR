import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const branch = process.env.WORKERS_CI_BRANCH ?? process.env.GITHUB_REF_NAME ?? 'dev';
// main → paqadhr-prod wrangler env, everything else → paqadhr-dev default
const wranglerArgs = branch === 'main' ? ['--env', 'production'] : [];

const result = spawnSync(
  'pnpm',
  ['exec', 'opennextjs-cloudflare', 'deploy', '--', ...wranglerArgs],
  { cwd: webRoot, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
