import 'reflect-metadata';

import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';

import { EXEMPT_INPUTS } from './controller-input-types.constants';

const SRC = resolve(__dirname, '..', '..');
const VALIDATED_SOURCES = [RouteParamtypes.BODY, RouteParamtypes.QUERY];

const controllerFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return entry.endsWith('.controller.ts') ? [full] : [];
  });

const unvalidatedInputs = async (): Promise<string[]> => {
  const offenders: string[] = [];
  for (const file of controllerFiles(join(SRC, 'modules'))) {
    const loaded = (await import(file)) as Record<string, unknown>;
    for (const exported of Object.values(loaded)) {
      if (typeof exported !== 'function' || !Reflect.hasMetadata(PATH_METADATA, exported)) continue;
      const proto = exported.prototype as Record<string, unknown>;
      for (const method of Object.getOwnPropertyNames(proto)) {
        if (method === 'constructor' || typeof proto[method] !== 'function') continue;
        const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, exported, method) ?? {}) as Record<
          string,
          { index: number; data?: unknown }
        >;
        const types = (Reflect.getMetadata('design:paramtypes', proto, method) ?? []) as unknown[];
        for (const [key, arg] of Object.entries(args)) {
          const source = Number(key.split(':')[0]);
          if (!VALIDATED_SOURCES.includes(source) || arg.data !== undefined) continue;
          const type = types[arg.index];
          if (type === undefined || type === Object) {
            offenders.push(`${relative(SRC, file)}#${method}`);
          }
        }
      }
    }
  }
  return offenders.sort();
};

describe('controller input types', () => {
  it('has no @Body() or @Query() object typed as a plain Object, which the ValidationPipe skips', async () => {
    const offenders = (await unvalidatedInputs()).filter((entry) => !EXEMPT_INPUTS.includes(entry));
    expect(offenders).toEqual([]);
  });

  it('keeps the exemption list free of handlers that no longer need it', async () => {
    const offenders = await unvalidatedInputs();
    expect(EXEMPT_INPUTS.filter((entry) => !offenders.includes(entry))).toEqual([]);
  });
});
