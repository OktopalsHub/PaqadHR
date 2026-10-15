#!/usr/bin/env node
/**
 * Nest ValidationPipe needs runtime class metadata on @Body() DTOs.
 * `import type` erases the class → pipe sees Object → forbidNonWhitelisted rejects fields.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { relative } from 'node:path';

const apiRoot = new URL('../../apps/api', import.meta.url).pathname;
const controllers = globSync('src/**/*.controller.ts', { cwd: apiRoot });

let failed = false;

function isDtoModulePath(importPath) {
  return importPath.includes('/dto/') || importPath.endsWith('.dto') || importPath.endsWith('.dto.ts');
}

for (const file of controllers) {
  const content = readFileSync(`${apiRoot}/${file}`, 'utf8');
  const typeImportedFromDto = new Set();

  for (const match of content.matchAll(
    /import\s+type\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
  )) {
    if (!isDtoModulePath(match[2])) continue;
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0];
      if (name) typeImportedFromDto.add(name);
    }
  }

  for (const match of content.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)) {
    if (!isDtoModulePath(match[2])) continue;
    for (const part of match[1].split(',')) {
      const trimmed = part.trim();
      if (trimmed.startsWith('type ')) {
        typeImportedFromDto.add(trimmed.slice(5).trim().split(/\s+as\s+/)[0]);
      }
    }
  }

  for (const match of content.matchAll(/@Body\([^)]*\)\s+\w+:\s*([A-Za-z0-9_]+)/g)) {
    const dtoName = match[1];
    if (typeImportedFromDto.has(dtoName)) {
      console.error(
        `${relative(process.cwd(), `${apiRoot}/${file}`)}: @Body() DTO "${dtoName}" is type-only imported from a dto module`,
      );
      failed = true;
    }
  }
}

if (failed) {
  console.error(
    '\nFix: value-import DTO classes used in @Body() (not `import type`). See tenant-settings.controller.ts.',
  );
  process.exit(1);
}

console.log(`check-body-dto-imports: ${controllers.length} controller(s) OK`);
