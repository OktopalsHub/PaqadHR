import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Load local env files without overriding values supplied by the process.
 * Existing process variables always take precedence over local configuration.
 *
 * @param {string} directory
 */
export function loadLocalEnv(directory) {
  for (const filename of ['.env.local', '.env']) {
    const path = join(directory, filename);
    if (existsSync(path)) process.loadEnvFile(path);
  }
}
