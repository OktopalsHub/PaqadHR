import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadLocalEnv } from './load-local-env.mjs';
import { resolveBuildEnvironment, resolveWorkerConfig } from './cf-config.mjs';

const webRoot = process.cwd();
loadLocalEnv(webRoot);
const buildEnv = resolveBuildEnvironment(process.env);
const configPath = join(webRoot, '.wrangler.preview.jsonc');
writeFileSync(configPath, `${JSON.stringify(resolveWorkerConfig(buildEnv), null, 2)}\n`);

const build = spawnSync('pnpm', ['exec', 'opennextjs-cloudflare', 'build'], {
  cwd: webRoot,
  env: buildEnv,
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);

const preview = spawnSync(
  'pnpm',
  ['exec', 'opennextjs-cloudflare', 'preview', '--config', configPath],
  { cwd: webRoot, env: buildEnv, stdio: 'inherit' },
);
process.exit(preview.status ?? 1);
