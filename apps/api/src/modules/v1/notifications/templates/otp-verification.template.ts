import { EMAIL_BRAND, EMAIL_SIGNOFF_TEXT, escapeHtml } from './brand';
import { renderEmailLayout } from './layout';
import { emailDanielSignOff, emailHeading, emailMuted, emailParagraph } from './shared';
import type { RenderedEmailTemplate } from './types';

export interface OtpVerificationEmailVariables {
  code: string;
  purposeLabel: string;
}

export function renderOtpVerificationEmail(
  vars: OtpVerificationEmailVariables,
): RenderedEmailTemplate {
  const code = escapeHtml(vars.code);
  const purposeLabel = escapeHtml(vars.purposeLabel);

  const bodyHtml = [
    emailHeading('Your verification code'),
    emailParagraph(`Use this code to confirm ${purposeLabel} on Paqad:`),
    `<div style="margin:0 0 24px;padding:20px;background-color:${EMAIL_BRAND.highlightBg};border-radius:8px;text-align:center;"><span style="font-size:32px;font-weight:700;letter-spacing:0.25em;color:${EMAIL_BRAND.text};">${code}</span></div>`,
    emailMuted(
      'This code expires in 10 minutes. If you did not request this, you can ignore this email.',
    ),
    emailDanielSignOff(),
  ].join('');

  return {
    subject: `${vars.code} is your Paqad verification code`,
    html: renderEmailLayout({
      preheader: `Your verification code is ${vars.code}`,
      content: bodyHtml,
    }),
    text: `Your Paqad verification code for ${vars.purposeLabel} is ${vars.code}. It expires in 10 minutes.\n\n${EMAIL_SIGNOFF_TEXT}`,
  };
}
