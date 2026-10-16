import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalEnv } from './load-local-env.mjs';
import { resolveWorkerConfig } from './cf-config.mjs';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
loadLocalEnv(webRoot);
const branch = process.env.WORKERS_CI_BRANCH ?? process.env.GITHUB_REF_NAME ?? 'local';

// The target worker and public URLs are required environment values. There are
// no branch-specific URL or Worker defaults in the repository.
const config = resolveWorkerConfig();

// Wrangler receives a generated config based on the selected environment.
const configPath = join(webRoot, '.wrangler.deploy.jsonc');
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

console.log(
  `[cf-deploy] branch=${branch} worker=${config.name} routes=${config.routes.length} config=${configPath}`,
);

// --keep-vars preserves vars configured directly on the Worker in the
// Cloudflare dashboard (PostHog, Sentry, …) that are not part of the config.
const result = spawnSync(
  'pnpm',
  ['exec', 'opennextjs-cloudflare', 'deploy', '--config', configPath, '--', '--keep-vars'],
  { cwd: webRoot, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
