export const EMAIL_FOUNDER = {
  name: 'The Paqad Team',
  title: '',
  email: 'support@paqad.com',
} as const;

export const EMAIL_BRAND = {
  logoUrl: process.env.EMAIL_LOGO_URL?.trim() || 'https://paqadhr.com/logo-lockup-light.png',
  primary: '#00a070',
  pageBg: '#f4f4f5',
  cardBg: '#ffffff',
  footerBg: '#fafafa',
  highlightBg: '#e6fbf4',
  text: '#18181b',
  muted: '#71717a',
  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const EMAIL_INTRO_TEXT = '';

export const EMAIL_SIGNOFF_TEXT = `Thank you,\nThe Paqad Team`;
