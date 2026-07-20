import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const branch = process.env.WORKERS_CI_BRANCH ?? process.env.GITHUB_REF_NAME ?? 'dev';
const isProd = branch === 'main';
const wranglerArgs = isProd
  ? ['--env', 'production', '--keep-vars']
  : ['--env', '', '--keep-vars'];
const target = isProd ? 'paqadhr-prod' : 'paqadhr-dev';

console.log(`[cf-deploy] branch=${branch} worker=${target}`);

const result = spawnSync(
  'pnpm',
  ['exec', 'opennextjs-cloudflare', 'deploy', '--', ...wranglerArgs],
  { cwd: webRoot, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
