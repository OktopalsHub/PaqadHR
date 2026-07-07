import { EMAIL_BRAND, escapeHtml } from './brand';
import { renderEmailLayout } from './layout';
import type { RenderedEmailTemplate } from './types';

export interface InvitationEmailVariables {
  tenantName: string;
  inviterName: string;
  inviteLink: string;
  firstName: string;
}

export function renderInvitationEmail(vars: InvitationEmailVariables): RenderedEmailTemplate {
  const tenantName = escapeHtml(vars.tenantName);
  const inviterName = escapeHtml(vars.inviterName);
  const firstName = escapeHtml(vars.firstName);
  const inviteLink = escapeHtml(vars.inviteLink);

  const bodyHtml = `
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:${EMAIL_BRAND.text};">You're invited to join ${tenantName}</h1>
<p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi ${firstName},</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#3f3f46;">
  <strong>${inviterName}</strong> invited you to join <strong>${tenantName}</strong> on PaqadHR.
</p>
<div style="margin:0 0 24px;padding:16px;background-color:${EMAIL_BRAND.highlightBg};border-radius:8px;font-size:14px;line-height:1.5;color:#065f46;">
  Accept the invitation to access your workspace, team directory, and HR tools.
</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
  <tr>
    <td align="center" bgcolor="${EMAIL_BRAND.primary}" style="border-radius:8px;">
      <a href="${inviteLink}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${EMAIL_BRAND.primary};">Accept invitation</a>
    </td>
  </tr>
</table>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${EMAIL_BRAND.muted};">
  Or copy this link into your browser:
</p>
<p style="margin:0 0 20px;font-size:13px;line-height:1.5;word-break:break-all;">
  <a href="${inviteLink}" style="color:${EMAIL_BRAND.primary};text-decoration:underline;">${inviteLink}</a>
</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#a1a1aa;">
  This invitation expires in 7 days. If you weren't expecting this email, you can ignore it.
</p>`;

  const subject = `You're invited to join ${vars.tenantName}`;
  const preheader = `${vars.inviterName} invited you to join ${vars.tenantName} on PaqadHR.`;

  return {
    subject,
    html: renderEmailLayout({ preheader, content: bodyHtml }),
    text: [
      `You're invited to join ${vars.tenantName}`,
      '',
      `Hi ${vars.firstName},`,
      `${vars.inviterName} invited you to join ${vars.tenantName} on PaqadHR.`,
      '',
      `Accept invitation: ${vars.inviteLink}`,
      '',
      'This invitation expires in 7 days.',
    ].join('\n'),
  };
}
