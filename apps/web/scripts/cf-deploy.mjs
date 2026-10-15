import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWorkerConfig } from './cf-config.mjs';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const branch = process.env.WORKERS_CI_BRANCH ?? process.env.GITHUB_REF_NAME ?? 'dev';

// A main build must never silently fall back to the dev worker: the target
// worker, its vars and its routes all come from the build environment.
if (branch === 'main' && !process.env.CF_WORKER_NAME?.trim()) {
  console.error(
    '[cf-deploy] CF_WORKER_NAME is required for main builds — set it in the build environment variables.',
  );
  process.exit(1);
}

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
