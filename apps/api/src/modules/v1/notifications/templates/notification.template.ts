import { EMAIL_SIGNOFF_TEXT, escapeHtml } from './brand';
import { renderEmailLayout } from './layout';
import {
  emailButton,
  emailDanielSignOff,
  emailHeading,
  emailOrganizationSignOff,
  emailParagraph,
} from './shared';
import type { RenderedEmailTemplate } from './types';

export interface GenericNotificationEmailVariables {
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  /**
   * Organization the notification is about — the workspace that paid the salary, for example.
   * When present the email signs off with that organization instead of the Paqad team, so the
   * member sees who sent the message. Paqad stays credited in the email footer.
   */
  organizationName?: string;
}

export function renderGenericNotificationEmail(
  vars: GenericNotificationEmailVariables,
): RenderedEmailTemplate {
  const title = escapeHtml(vars.title);
  const message = escapeHtml(vars.message);
  const actionUrl = vars.actionUrl?.trim();
  const actionLabel = vars.actionLabel?.trim() || 'View';
  const organizationName = vars.organizationName?.trim();

  const bodyHtml = [
    emailHeading(title),
    emailParagraph(message),
    actionUrl ? emailButton(actionUrl, actionLabel) : '',
    organizationName ? emailOrganizationSignOff(organizationName) : emailDanielSignOff(),
  ].join('');

  const text = [
    vars.title,
    '',
    vars.message,
    actionUrl ? `${actionLabel}: ${actionUrl}` : '',
    '',
    organizationName ? `Thank you,\n${organizationName}` : EMAIL_SIGNOFF_TEXT,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject: vars.title,
    html: renderEmailLayout({ preheader: vars.message, content: bodyHtml }),
    text,
  };
}
