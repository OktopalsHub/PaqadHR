import { EMAIL_SIGNOFF_TEXT, escapeHtml } from './brand';
import { renderEmailLayout } from './layout';
import { emailButton, emailDanielSignOff, emailHeading, emailParagraph } from './shared';
import type { RenderedEmailTemplate } from './types';

export interface GenericNotificationEmailVariables {
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}

export function renderGenericNotificationEmail(
  vars: GenericNotificationEmailVariables,
): RenderedEmailTemplate {
  const title = escapeHtml(vars.title);
  const message = escapeHtml(vars.message);
  const actionUrl = vars.actionUrl?.trim();
  const actionLabel = vars.actionLabel?.trim() || 'View';

  const bodyHtml = [
    emailHeading(title),
    emailParagraph(message),
    actionUrl ? emailButton(actionUrl, actionLabel) : '',
    emailDanielSignOff(),
  ].join('');

  const text = [
    vars.title,
    '',
    vars.message,
    actionUrl ? `${actionLabel}: ${actionUrl}` : '',
    '',
    EMAIL_SIGNOFF_TEXT,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject: vars.title,
    html: renderEmailLayout({ preheader: vars.message, content: bodyHtml }),
    text,
  };
}
