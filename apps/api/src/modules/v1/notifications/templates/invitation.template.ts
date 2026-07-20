import { EMAIL_INTRO_TEXT, EMAIL_SIGNOFF_TEXT, escapeHtml } from './brand';
import { renderEmailLayout } from './layout';
import {
  emailButton,
  emailDanielIntro,
  emailDanielSignOff,
  emailHeading,
  emailHighlight,
  emailLink,
  emailMuted,
  emailParagraph,
  greetingFirstName,
} from './shared';
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
  const firstName = greetingFirstName(vars.firstName);

  const bodyHtml = [
    emailHeading(`You're invited to join ${tenantName}`),
    emailParagraph(`Hi ${firstName},`),
    emailDanielIntro(),
    emailParagraph(
      `<strong>${inviterName}</strong> invited you to join <strong>${tenantName}</strong> on PaqadHR.`,
    ),
    emailHighlight('Accept the invitation to access your workspace and team tools.'),
    emailButton(vars.inviteLink, 'Accept invitation'),
    emailParagraph(`Or copy this link into your browser:<br />${emailLink(vars.inviteLink)}`),
    emailMuted(
      'This invitation expires in 7 days. If you were not expecting this email, you can ignore it.',
    ),
    emailDanielSignOff(),
  ].join('');

  const subject = `You're invited to join ${vars.tenantName}`;
  const preheader = `${vars.inviterName} invited you to join ${vars.tenantName} on PaqadHR.`;

  return {
    subject,
    html: renderEmailLayout({ preheader, content: bodyHtml }),
    text: [
      `You're invited to join ${vars.tenantName}`,
      '',
      `Hi ${vars.firstName},`,
      EMAIL_INTRO_TEXT,
      `${vars.inviterName} invited you to join ${vars.tenantName} on PaqadHR.`,
      '',
      `Accept invitation: ${vars.inviteLink}`,
      '',
      'This invitation expires in 7 days.',
      '',
      EMAIL_SIGNOFF_TEXT,
    ].join('\n'),
  };
}
