import { EMAIL_SIGNOFF_TEXT, escapeHtml } from './brand';
import { renderEmailLayout } from './layout';
import {
  emailButton,
  emailDanielSignOff,
  emailHeading,
  emailLink,
  emailMuted,
  emailParagraph,
} from './shared';
import type { RenderedEmailTemplate } from './types';

export interface PasswordResetEmailVariables {
  resetLink: string;
}

export function renderPasswordResetEmail(vars: PasswordResetEmailVariables): RenderedEmailTemplate {
  const _resetLink = escapeHtml(vars.resetLink);

  const bodyHtml = [
    emailHeading('Reset your password'),
    emailParagraph(
      'We received a request to reset the password for your PaqadHR account. Click the button below to choose a new one.',
    ),
    emailButton(vars.resetLink, 'Reset password'),
    emailParagraph(`Or copy this link into your browser:<br />${emailLink(vars.resetLink)}`),
    emailMuted(
      'This link expires in 1 hour. If you did not request a reset, you can ignore this email — your password will stay the same.',
    ),
    emailDanielSignOff(),
  ].join('');

  return {
    subject: 'Reset your PaqadHR password',
    html: renderEmailLayout({
      preheader: 'Reset your PaqadHR password',
      content: bodyHtml,
    }),
    text: [
      'Reset your PaqadHR password',
      '',
      'We received a request to reset your password.',
      `Reset password: ${vars.resetLink}`,
      '',
      'This link expires in 1 hour. If you did not request this, ignore this email.',
      '',
      EMAIL_SIGNOFF_TEXT,
    ].join('\n'),
  };
}
