import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWorkerConfig } from './cf-config.mjs';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const branch = process.env.WORKERS_CI_BRANCH ?? process.env.GITHUB_REF_NAME ?? 'dev';

// The target worker resolves from CF_WORKER_NAME, else the branch default
// (main -> paqadhr, dev/previews -> paqadhr-dev) inside resolveWorkerConfig,
// so a main build can never silently land on the dev worker.
const config = resolveWorkerConfig();

// wrangler only auto-detects wrangler.json(c)/toml, so the env-resolved
// config is materialised here and passed through `--config`. wrangler.jsonc
// stays the static local-dev baseline used by `wrangler dev`/`cf:preview`.
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
