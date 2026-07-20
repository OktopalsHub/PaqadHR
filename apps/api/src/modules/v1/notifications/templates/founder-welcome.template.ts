import { EMAIL_FOUNDER, escapeHtml } from './brand';
import { renderEmailLayout } from './layout';
import { emailLink, emailParagraph, greetingFirstName, resolveFirstName } from './shared';
import type { RenderedEmailTemplate } from './types';

export interface FounderWelcomeEmailVariables {
  firstName?: string;
  email?: string;
}

export function renderFounderWelcomeEmail(
  vars: FounderWelcomeEmailVariables,
): RenderedEmailTemplate {
  const firstName = greetingFirstName(vars.firstName, vars.email);
  const plainName = resolveFirstName(vars.firstName, vars.email);
  const founderEmail = EMAIL_FOUNDER.email;

  const bodyHtml = [
    emailParagraph(`Hey ${firstName},`),
    emailParagraph(
      `I'm <strong>${escapeHtml(EMAIL_FOUNDER.name)}</strong>, founder of PaqadHR. I saw you signed up and wanted to reach out personally.`,
    ),
    emailParagraph(
      'I built PaqadHR because I could not find a platform that brought HR activities together and let teams pay salaries using crypto — without bolting on separate tools for leave, recruitment, attendance, and everything else around your people.',
    ),
    emailParagraph(
      'Our goal is simple: help businesses like yours run people operations and payroll in one place, so hiring, paying, and supporting your team feels fast, reliable, and enjoyable.',
    ),
    emailParagraph(
      `As you explore PaqadHR, I would genuinely love to hear your thoughts — questions, feedback, edge cases, feature requests, anything. If you want to reach out, send me a message at ${emailLink(`mailto:${founderEmail}`, founderEmail)}.`,
    ),
    `<p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#3f3f46;">All my best,<br /><strong>${escapeHtml(EMAIL_FOUNDER.name)}</strong></p>`,
  ].join('');

  const textLines = [
    `Hey ${plainName},`,
    '',
    `I'm ${EMAIL_FOUNDER.name}, founder of PaqadHR. I saw you signed up and wanted to reach out personally.`,
    '',
    'I built PaqadHR because I could not find a platform that brought HR activities together and let teams pay salaries using crypto — without bolting on separate tools for leave, recruitment, attendance, and everything else.',
    '',
    'Our goal is simple: help businesses like yours run people operations and payroll in one place.',
    '',
    `As you explore PaqadHR, I would love to hear your thoughts. If you want to reach out, send me a message at ${founderEmail}.`,
    '',
    `All my best,\n${EMAIL_FOUNDER.name}`,
  ];

  return {
    subject: `A quick message from ${EMAIL_FOUNDER.name} at PaqadHR`,
    html: renderEmailLayout({
      preheader: `${EMAIL_FOUNDER.name} from PaqadHR — thanks for signing up`,
      content: bodyHtml,
    }),
    text: textLines.join('\n'),
  };
}
