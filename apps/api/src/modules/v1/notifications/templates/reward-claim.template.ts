import { escapeHtml } from './brand';
import { renderEmailLayout } from './layout';
import { emailButton, emailHeading, emailParagraph, greetingFirstName } from './shared';
import type { RenderedEmailTemplate } from './types';

export interface RewardClaimEmailVariables {
  employeeName?: string;
  employeeEmail: string;
  rewardName: string;
  rewardAmount: number;
  currencyCode: string;
  securityCode?: string;
  redemptionUrl: string;
  referenceId: string;
  providerName: string;
  providerLogoUrl?: string;
}

export function renderRewardClaimEmail(vars: RewardClaimEmailVariables): RenderedEmailTemplate {
  const firstName = greetingFirstName(vars.employeeName, vars.employeeEmail);
  const rewardName = escapeHtml(vars.rewardName);
  const amount = escapeHtml(String(vars.rewardAmount));
  const currency = escapeHtml(vars.currencyCode);
  const securityCode = vars.securityCode ? escapeHtml(vars.securityCode) : null;
  const redemptionUrl = vars.redemptionUrl;
  const referenceId = escapeHtml(vars.referenceId);
  const providerName = escapeHtml(vars.providerName);

  const _securityCodeSection = securityCode
    ? `
    <div style="margin:0 0 24px;padding:20px;background-color:#f8fafc;border:2px dashed #e2e8f0;border-radius:12px;text-align:center;">
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Security Code</p>
      <p style="margin:0;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:0.1em;font-family:monospace;">${securityCode}</p>
    </div>`
    : '';

  const bodyHtml = [
    emailHeading('Your reward is here!'),
    emailParagraph(`Hi ${firstName},`),
    emailParagraph(
      `Great news! Your reward <strong>${rewardName}</strong> has been successfully claimed and is ready for you.`,
    ),
    `
    <div style="margin:0 0 24px;padding:24px;background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 100%);border-radius:12px;border:1px solid #bbf7d0;">
      <div style="text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;color:#166534;font-weight:500;">${rewardName}</p>
        <p style="margin:0;font-size:36px;font-weight:800;color:#15803d;">${currency} ${amount}</p>
      </div>
    </div>
    `,
    emailParagraph('To redeem your reward, please follow these steps:'),
    `
    <div style="margin:0 0 24px;padding:20px;background-color:#f8fafc;border-radius:8px;">
      <ol style="margin:0;padding-left:20px;font-size:15px;line-height:2;color:#3f3f46;">
        ${securityCode ? `<li>Copy your security code: <strong style="color:#0f172a;">${securityCode}</strong></li>` : ''}
        <li>Click the redemption button below</li>
        <li>Follow the instructions on the page to unlock your reward</li>
        <li>Your reward code will be revealed once unlocked</li>
      </ol>
    </div>
    `,
    emailButton(redemptionUrl, 'Redeem Your Reward'),
    emailParagraph(
      `Or copy this link into your browser:<br /><a href="${escapeHtml(redemptionUrl)}" style="color:#00a070;text-decoration:underline;word-break:break-all;font-size:14px;">${escapeHtml(redemptionUrl)}</a>`,
    ),
    `
    <div style="margin:32px 0 0;padding:16px;border-top:1px solid #e4e4e7;">
      <p style="margin:0 0 4px;font-size:12px;color:#71717a;">Reference ID</p>
      <p style="margin:0;font-size:13px;color:#3f3f46;font-family:monospace;">${referenceId}</p>
    </div>
    `,
    `
    <div style="margin:24px 0 0;padding:16px;border-top:1px solid #e4e4e7;text-align:center;">
      <p style="margin:0 0 8px;font-size:12px;color:#71717a;">Powered by</p>
      <p style="margin:0;font-size:14px;font-weight:600;color:#3f3f46;">${providerName}</p>
      ${vars.providerLogoUrl ? `<img src="${escapeHtml(vars.providerLogoUrl)}" alt="${providerName}" width="120" height="30" style="display:inline-block;margin-top:8px;border:0;height:auto;max-width:120px;" />` : ''}
    </div>
    `,
  ].join('');

  const subject = `Your reward: ${vars.rewardName} ${vars.currencyCode} ${vars.rewardAmount}`;
  const preheader = `${vars.rewardName} ${vars.currencyCode} ${vars.rewardAmount} reward ready for redemption`;

  return {
    subject,
    html: renderEmailLayout({ preheader, content: bodyHtml }),
    text: [
      `Your reward is here!`,
      '',
      `Hi ${vars.employeeName || 'there'},`,
      `Your reward ${vars.rewardName} ${vars.currencyCode} ${vars.rewardAmount} has been successfully claimed.`,
      '',
      securityCode ? `Security Code: ${vars.securityCode}` : '',
      '',
      `To redeem your reward:`,
      `${vars.redemptionUrl}`,
      '',
      `Reference ID: ${vars.referenceId}`,
      '',
      `Powered by ${vars.providerName}`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
