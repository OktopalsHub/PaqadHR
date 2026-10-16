/**
 * Cloudflare Workers configuration is supplied by the environment.
 * Local values come from apps/web/.env; Workers Builds values come from the
 * branch-specific build environment in the Cloudflare dashboard.
 */

const requiredEnv = (env, key) => {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

const toBool = (raw, fallback = false) => {
  const value = raw?.trim().toLowerCase();
  if (!value) return fallback;
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
};

const parseRoutes = (raw) => {
  const value = raw?.trim();
  if (!value) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`CF_ROUTES must be a JSON array of route objects (${error.message})`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('CF_ROUTES must be a JSON array of route objects');
  }
  return parsed;
};

/**
 * Validate and normalize values before Next.js inlines public variables.
 * No production/development URL or Worker name is embedded in this script.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {Record<string, string | undefined>}
 */
export function resolveBuildEnvironment(env = process.env) {
  return {
    ...env,
    CF_WORKER_NAME: requiredEnv(env, 'CF_WORKER_NAME'),
    NEXT_PUBLIC_API_URL: requiredEnv(env, 'NEXT_PUBLIC_API_URL'),
    NEXT_PUBLIC_APP_URL: requiredEnv(env, 'NEXT_PUBLIC_APP_URL'),
    NEXT_PUBLIC_APP_DOMAIN: requiredEnv(env, 'NEXT_PUBLIC_APP_DOMAIN'),
    NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS: requiredEnv(env, 'NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS'),
    CF_COMPAT_DATE: requiredEnv(env, 'CF_COMPAT_DATE'),
  };
}

/**
 * Resolve the Wrangler config exclusively from environment values.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {Record<string, unknown>}
 */
export function resolveWorkerConfig(env = process.env) {
  const buildEnv = resolveBuildEnvironment(env);
  return {
    name: buildEnv.CF_WORKER_NAME,
    main: '.open-next/worker.js',
    compatibility_date: buildEnv.CF_COMPAT_DATE,
    compatibility_flags: ['nodejs_compat', 'global_fetch_strictly_public'],
    workers_dev: toBool(env.CF_WORKERS_DEV),
    preview_urls: false,
    keep_names: false,
    assets: {
      directory: '.open-next/assets',
      binding: 'ASSETS',
    },
    observability: {
      enabled: true,
      head_sampling_rate: 1,
      redact_query_string: true,
      logs: {
        enabled: true,
        head_sampling_rate: 1,
        persist: true,
        invocation_logs: true,
      },
      traces: {
        enabled: true,
        persist: true,
        head_sampling_rate: 1,
      },
    },
    vars: {
      NEXT_PUBLIC_API_URL: buildEnv.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_APP_URL: buildEnv.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_APP_DOMAIN: buildEnv.NEXT_PUBLIC_APP_DOMAIN,
      NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS: buildEnv.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS,
    },
    routes: parseRoutes(env.CF_ROUTES),
  };
}
