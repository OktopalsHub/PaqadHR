export const paymentProvidersConfig = {
  environment: process.env.PAYMENT_ENVIRONMENT || 'sandbox',
  nomba: {
    enabled: false,
    apiKey: process.env.NOMBA_CLIENT_ID,
    secretKey: process.env.NOMBA_CLIENT_SECRET,
    webhookSecret: process.env.NOMBA_WEBHOOK_SIGNATURE_KEY,
    baseUrl: process.env.NOMBA_BASE_URL || 'https://api.nomba.com',
  },
};
