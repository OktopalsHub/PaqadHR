export interface SecretConfig {
    jwt: {
        accessSecret: string;
        refreshSecret: string;
        };
    database: {
        url: string;
        testUrl?: string;
        };
    oauth: {
        google: {
          clientId: string;
          clientSecret: string;
        };
        };
    integrations: {
        slack: {
          clientId: string;
          clientSecret: string;
          signingSecret: string;
        };
        };
    email: {
        zeptomailApiKey: string;
        defaultFromEmail: string;
        };
    encryption: {
        key: string;
        };
    payments: {
        nomba: {
          apiKey: string;
          secretKey: string;
          webhookSecret: string;
        };
        };
}
