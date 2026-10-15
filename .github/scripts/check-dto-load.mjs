#!/usr/bin/env node
/**
 * emitDecoratorMetadata bakes eager class references into @Body() DTO metadata.
 * A DTO that references a class declared later in the same file throws
 * "Cannot access 'X' before initialization" at require time — invisible to tsc/nest build.
 * Requiring each compiled DTO reproduces that runtime load, so CI fails before deploy.
 */
import { createRequire } from 'node:module';
import { globSync } from 'node:fs';

const require = createRequire(import.meta.url);
const distRoot = new URL('../../apps/api/dist', import.meta.url).pathname;
const dtoFiles = globSync('**/*.dto.js', { cwd: distRoot });

if (dtoFiles.length === 0) {
  console.error('check-dto-load: no compiled DTOs found — run `pnpm --filter api build` first');
  process.exit(1);
}

let failed = false;
for (const file of dtoFiles) {
  try {
    require(`${distRoot}/${file}`);
  } catch (err) {
    console.error(`${file}: ${err.message}`);
    failed = true;
  }
}

if (failed) {
  console.error('\nFix: declare DTO classes before any sibling DTO that references them.');
  process.exit(1);
}

console.log(`check-dto-load: ${dtoFiles.length} compiled DTO(s) loaded OK`);
