export const paymentProvidersConfig = {
  environment: process.env.PAYMENT_ENVIRONMENT || 'sandbox',
  nomba: {
    enabled: false,
    apiKey: process.env.NOMBA_API_KEY,
    secretKey: process.env.NOMBA_SECRET_KEY,
    webhookSecret: process.env.NOMBA_WEBHOOK_SECRET,
    baseUrl: process.env.NOMBA_BASE_URL || 'https://api.nomba.com',
  },
};
