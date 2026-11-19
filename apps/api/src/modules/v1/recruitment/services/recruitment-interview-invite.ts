import { renderEmailLayout } from '../../notifications/templates/layout';
import { escapeHtml, htmlToText } from './recruitment-template-renderer';

export type InterviewInviteKind = 'scheduled' | 'rescheduled' | 'cancelled';

export type InterviewInviteInput = {
  kind: InterviewInviteKind;
  interviewId: string;
  candidateFirstName: string;
  jobTitle: string;
  companyName: string;
  start: Date;
  durationMinutes: number;
  type: string;
  location?: string | null;
};

const icsStamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
const icsText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function buildInterviewIcs(input: InterviewInviteInput): string {
  const end = new Date(input.start.getTime() + input.durationMinutes * 60000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PaqadHR//Recruitment//EN',
    `METHOD:${input.kind === 'cancelled' ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${input.interviewId}@paqadhr`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(input.start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsText(`Interview: ${input.jobTitle} at ${input.companyName}`)}`,
    ...(input.location ? [`LOCATION:${icsText(input.location)}`] : []),
    `STATUS:${input.kind === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function buildInterviewEmail(input: InterviewInviteInput) {
  const when = input.start.toUTCString();
  const lead = {
    scheduled: 'Your interview has been scheduled.',
    rescheduled: 'Your interview time has changed.',
    cancelled: 'Your interview has been cancelled.',
  }[input.kind];
  const details =
    input.kind === 'cancelled'
      ? ''
      : `<p><strong>When:</strong> ${escapeHtml(when)} (${input.durationMinutes} minutes)<br><strong>Format:</strong> ${escapeHtml(input.type)}${input.location ? `<br><strong>Where:</strong> ${escapeHtml(input.location)}` : ''}</p>`;
  const html = `<p>Hi ${escapeHtml(input.candidateFirstName)},</p><p>${lead} ${escapeHtml(input.jobTitle)} at ${escapeHtml(input.companyName)}.</p>${details}`;
  const subject = {
    scheduled: `Interview scheduled: ${input.jobTitle}`,
    rescheduled: `Interview time changed: ${input.jobTitle}`,
    cancelled: `Interview cancelled: ${input.jobTitle}`,
  }[input.kind].slice(0, 255);
  return {
    subject,
    text: htmlToText(html),
    html: renderEmailLayout({
      preheader: lead,
      organizationName: input.companyName || undefined,
      content: `<div style="font-size:15px;line-height:1.6;">${html}</div>`,
    }),
  };
}
