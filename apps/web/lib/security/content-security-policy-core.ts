type ContentSecurityPolicyOptions = {
  apiOrigin: string;
  brandOrigin: string;
  isDevelopment: boolean;
  r2PublicOrigin?: string;
};

export function buildContentSecurityPolicyFromSources(
  options: ContentSecurityPolicyOptions,
): string {
  const imageSources = [
    "'self'",
    'data:',
    'blob:',
    options.brandOrigin,
    'https://images.unsplash.com',
    'https://cdn.reloadly.com',
    'https://*.r2.dev',
  ];

  if (options.r2PublicOrigin) {
    imageSources.push(options.r2PublicOrigin);
  }

  const connectSources = [
    "'self'",
    options.apiOrigin,
    'https://challenges.cloudflare.com',
    'https://cloudflareinsights.com',
    'https://*.r2.cloudflarestorage.com',
    'https://*.r2.dev',
  ];

  if (options.r2PublicOrigin) {
    connectSources.push(options.r2PublicOrigin);
  }

  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    'https://challenges.cloudflare.com',
    'https://static.cloudflareinsights.com',
  ];

  if (options.isDevelopment) {
    scriptSources.push("'unsafe-eval'");
    connectSources.push('ws:', 'wss:');
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `img-src ${imageSources.join(' ')}`,
    `connect-src ${connectSources.join(' ')}`,
    'frame-src https://challenges.cloudflare.com',
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
