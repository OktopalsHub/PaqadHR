import { EMAIL_BRAND, escapeHtml } from './brand';
import { renderEmailLayout } from './layout';
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

  const bodyHtml = `
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:${EMAIL_BRAND.text};">Your verification code</h1>
<p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#3f3f46;">
  Use this code to confirm ${purposeLabel} on PaqadHR:
</p>
<div style="margin:0 0 24px;padding:20px;background-color:${EMAIL_BRAND.highlightBg};border-radius:8px;text-align:center;">
  <span style="font-size:32px;font-weight:700;letter-spacing:0.25em;color:${EMAIL_BRAND.text};">${code}</span>
</div>
<p style="margin:0;font-size:13px;line-height:1.5;color:#a1a1aa;">
  This code expires in 10 minutes. If you did not request this, you can ignore this email.
</p>`;

  return {
    subject: `${vars.code} is your Paqad verification code`,
    html: renderEmailLayout({
      preheader: `Your verification code is ${vars.code}`,
      content: bodyHtml,
    }),
    text: `Your Paqad verification code for ${vars.purposeLabel} is ${vars.code}. It expires in 10 minutes.`,
  };
}
