#!/usr/bin/env node
/**
 * Dependabot #133 — CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm.
 *
 * `braces` <= 3.0.3 caps input *length* (MAX_LENGTH = 10000) but not brace nesting
 * *depth*, so a short, deeply nested pattern drives the recursive AST walkers in
 * compile.js / expand.js into stack exhaustion. No fixed release exists yet, so the
 * guard is applied locally via pnpm `patchedDependencies` (see patches/braces@3.0.3.patch).
 *
 * This check fails if the patch is dropped, stops applying, or starts rejecting
 * patterns the build tools legitimately feed to micromatch.
 */
import { existsSync, globSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';

const repoRoot = new URL('../../', import.meta.url).pathname;
const workspace = readFileSync(`${repoRoot}pnpm-workspace.yaml`, 'utf8');
const PATCH = 'patches/braces@3.0.3.patch';

let failed = false;
const fail = (msg) => {
  console.error(`check-braces-patch: ${msg}`);
  failed = true;
};

/**
 * 1. The patch must be registered and present, otherwise the vulnerable copy is used.
 */
if (!workspace.includes(`braces@3.0.3: ${PATCH}`)) {
  fail(`pnpm-workspace.yaml does not register patchedDependencies."braces@3.0.3" -> ${PATCH}`);
}
if (!existsSync(`${repoRoot}${PATCH}`)) {
  fail(`${PATCH} is missing`);
}

/**
 * 2. Resolve braces the way consumers do — through micromatch's own node_modules —
 * so we assert on the copy fast-glob and ts-loader actually load, not a store orphan.
 */
const micromatches = globSync('micromatch@*/node_modules/braces', {
  cwd: `${repoRoot}node_modules/.pnpm`,
});
if (micromatches.length === 0) {
  fail('could not locate braces under node_modules/.pnpm — was pnpm install run?');
}

for (const link of micromatches) {
  const linkPath = `${repoRoot}node_modules/.pnpm/${link}`;
  const resolved = realpathSync(linkPath);
  if (!existsSync(`${resolved}/lib/parse.js`)) {
    fail(`unresolved micromatch -> braces link: ${link}`);
    continue;
  }
  if (!readlinkSync(linkPath).includes('_patch_hash=')) {
    fail(`micromatch resolves to an UNPATCHED braces: ${readlinkSync(linkPath)}`);
    continue;
  }
  if (!readFileSync(`${resolved}/lib/parse.js`, 'utf8').includes('MAX_DEPTH')) {
    fail(`patch did not apply: ${link}/lib/parse.js has no MAX_DEPTH guard`);
  }
}

if (failed) {
  fail(
    'Re-apply with: pnpm patch braces@3.0.3 && pnpm patch-commit <dir> ' +
      '(or delete the patchedDependencies block once braces ships a fixed release).',
  );
  process.exit(1);
}

/**
 * 3. The guard must hold: deeply nested patterns are rejected with a SyntaxError
 *    (as the existing MAX_LENGTH guard does) rather than an uncaught RangeError.
 */
const require = createRequire(`${repoRoot}node_modules/.pnpm/${micromatches[0]}/`);
const braces = require('braces');
const nested = (n) => `${'{'.repeat(n)}a${'}'.repeat(n)}`;

for (const n of [101, 1000, 4999]) {
  for (const expand of [false, true]) {
    try {
      braces(nested(n), { expand });
      fail(`depth=${n} expand=${expand} was accepted — MAX_DEPTH guard is not applied`);
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        fail(`depth=${n} expand=${expand} threw ${error.constructor.name}, expected SyntaxError`);
      }
    }
  }
}

/**
 * 4. Patterns the build tools legitimately produce must keep working.
 */
for (const [pattern, expected] of [
  ['{1..3}', '1,2,3'],
  ['src/*.{ts,tsx}', 'src/*.ts,src/*.tsx'],
  ['{a,b}/**/*.js', 'a/**/*.js,b/**/*.js'],
]) {
  const got = braces(pattern, { expand: true }).join(',');
  if (got !== expected) {
    fail(`expand("${pattern}") -> "${got}", expected "${expected}"`);
  }
}

if (failed) process.exit(1);

console.log(`check-braces-patch: CVE-2026-93687 guarded, ${micromatches.length} consumer link(s) OK`);