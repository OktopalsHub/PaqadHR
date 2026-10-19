import { EMAIL_SIGNOFF_TEXT, escapeHtml } from './brand';
import { renderEmailLayout } from './layout';
import {
  emailDanielSignOff,
  emailHeading,
  emailHighlight,
  emailOrganizationSignOff,
  emailParagraph,
  greetingFirstName,
} from './shared';
import type { RenderedEmailTemplate } from './types';

export interface PayrollNotificationEmailVariables {
  employeeName?: string;
  payrollPeriod: string;
  amount: string | number;
  currency: string;
  /**
   * Organization that paid the salary (the workspace name). When present the email names the
   * payer instead of signing off as the Paqad team.
   */
  organizationName?: string;
}

export function renderPayrollNotificationEmail(
  vars: PayrollNotificationEmailVariables,
): RenderedEmailTemplate {
  const firstName = greetingFirstName(vars.employeeName);
  const period = escapeHtml(vars.payrollPeriod);
  const amount = escapeHtml(String(vars.amount));
  const currency = escapeHtml(vars.currency);
  const organizationName = vars.organizationName?.trim();

  const bodyHtml = [
    emailHeading('Your payroll has been processed'),
    emailParagraph(`Hi ${firstName},`),
    emailParagraph(
      organizationName
        ? `Good news — <strong>${escapeHtml(organizationName)}</strong> has processed your payroll for <strong>${period}</strong>.`
        : `Good news — payroll for <strong>${period}</strong> has been processed for you.`,
    ),
    emailHighlight(`Amount: <strong>${currency} ${amount}</strong>`),
    emailParagraph(
      'Please check your bank account or payment method on file for the deposit details. If anything looks off, reach out to your workspace admin.',
    ),
    organizationName ? emailOrganizationSignOff(organizationName) : emailDanielSignOff(),
  ].join('');

  return {
    subject: `Payroll processed — ${vars.payrollPeriod}`,
    html: renderEmailLayout({
      preheader: `Payroll for ${vars.payrollPeriod} has been processed`,
      content: bodyHtml,
    }),
    text: [
      `Hi ${vars.employeeName || 'there'},`,
      organizationName
        ? `${organizationName} has processed your payroll for ${vars.payrollPeriod}.`
        : `Payroll for ${vars.payrollPeriod} has been processed.`,
      `Amount: ${vars.currency} ${vars.amount}`,
      '',
      organizationName ? `Thank you,\n${organizationName}` : EMAIL_SIGNOFF_TEXT,
    ].join('\n'),
  };
}
