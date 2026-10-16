import { spawnSync } from 'node:child_process';
import { loadLocalEnv } from './load-local-env.mjs';
import { resolveBuildEnvironment } from './cf-config.mjs';

const webRoot = process.cwd();
loadLocalEnv(webRoot);
const buildEnv = resolveBuildEnvironment(process.env);

console.log(
  `[cf-build] branch=${buildEnv.WORKERS_CI_BRANCH ?? buildEnv.GITHUB_REF_NAME ?? 'local'} app=${buildEnv.NEXT_PUBLIC_APP_URL} api=${buildEnv.NEXT_PUBLIC_API_URL}`,
);

const versionResult = spawnSync(process.execPath, ['scripts/generate-build-version.mjs'], {
  cwd: webRoot,
  env: buildEnv,
  stdio: 'inherit',
});

if (versionResult.status !== 0) {
  process.exit(versionResult.status ?? 1);
}

const buildResult = spawnSync('pnpm', ['exec', 'opennextjs-cloudflare', 'build'], {
  cwd: webRoot,
  env: buildEnv,
  stdio: 'inherit',
});

process.exit(buildResult.status ?? 1);
