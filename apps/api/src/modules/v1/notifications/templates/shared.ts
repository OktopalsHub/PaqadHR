import { EMAIL_BRAND, escapeHtml } from './brand';

const BODY_TEXT = '#3f3f46';
const MUTED_TEXT = '#a1a1aa';

export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:${EMAIL_BRAND.text};">${text}</h1>`;
}

export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${BODY_TEXT};">${html}</p>`;
}

export function emailHighlight(html: string): string {
  return `<div style="margin:0 0 24px;padding:16px;background-color:${EMAIL_BRAND.highlightBg};border-radius:8px;font-size:14px;line-height:1.6;color:#065f46;">${html}</div>`;
}

export function emailButton(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;"><tr><td align="center" bgcolor="${EMAIL_BRAND.primary}" style="border-radius:8px;"><a href="${safeHref}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${EMAIL_BRAND.primary};">${safeLabel}</a></td></tr></table>`;
}

export function emailMuted(text: string): string {
  return `<p style="margin:0;font-size:13px;line-height:1.5;color:${MUTED_TEXT};">${text}</p>`;
}

export function emailLink(href: string, label?: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label ?? href);
  return `<a href="${safeHref}" style="color:${EMAIL_BRAND.primary};text-decoration:underline;word-break:break-all;">${safeLabel}</a>`;
}

export function emailSubheading(text: string): string {
  return `<h2 style="margin:0 0 20px;font-size:18px;line-height:1.4;font-weight:600;color:${EMAIL_BRAND.text};">${text}</h2>`;
}

export function emailSection(
  title: string,
  bodyHtml: string,
  cta?: { href: string; label: string },
): string {
  const safeTitle = escapeHtml(title);
  return `<div style="margin:0 0 28px;padding-bottom:8px;border-bottom:1px solid #e4e4e7;">
<h3 style="margin:0 0 10px;font-size:17px;line-height:1.4;font-weight:600;color:${EMAIL_BRAND.text};">${safeTitle}</h3>
<p style="margin:0 0 ${cta ? '16px' : '0'};font-size:15px;line-height:1.6;color:${BODY_TEXT};">${bodyHtml}</p>
${cta ? emailButton(cta.href, cta.label) : ''}
</div>`;
}

export function emailFriendsSignOff(): string {
  return `<p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:${BODY_TEXT};">Thank you,<br /><strong>The Paqad Team</strong></p>`;
}

export function emailPostscript(text: string): string {
  return `<p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${BODY_TEXT};"><strong>P.S.</strong> ${text}</p>`;
}

export function emailSentWithCare(): string {
  return `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:${MUTED_TEXT};text-align:center;">Sent with care from<br /><strong style="color:${EMAIL_BRAND.text};">Paqad</strong></p>`;
}

export function emailDanielIntro(): string {
  return '';
}

export function emailDanielSignOff(): string {
  return `<p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:${BODY_TEXT};">Thank you,<br /><strong>The Paqad Team</strong></p>`;
}

export function resolveFirstName(name?: string, email?: string): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  const fromEmail = email?.split('@')[0]?.trim();
  if (fromEmail) return fromEmail;
  return 'there';
}

export function greetingFirstName(name?: string, email?: string): string {
  return escapeHtml(resolveFirstName(name, email));
}
