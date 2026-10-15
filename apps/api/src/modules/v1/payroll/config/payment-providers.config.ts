import { getNombaBaseUrl, isNombaLive } from '../../../../common/config/nomba.config';

export const paymentProvidersConfig = {
  environment: process.env.PAYMENT_ENVIRONMENT || (isNombaLive() ? 'production' : 'sandbox'),
  nomba: {
    enabled: false,
    apiKey: process.env.NOMBA_CLIENT_ID,
    secretKey: process.env.NOMBA_CLIENT_SECRET,
    webhookSecret: process.env.NOMBA_WEBHOOK_SIGNATURE_KEY,
    baseUrl: getNombaBaseUrl(),
  },
};
