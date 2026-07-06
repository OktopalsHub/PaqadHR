import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SendMailClient } from 'zeptomail';
import { EmailTemplateService } from './email-template.service';

interface EmailData {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

type ZeptomailErrorBody = {
  error?: {
    code?: string;
    message?: string;
    request_id?: string;
    details?: Array<{ code?: string; message?: string; target?: string }>;
  };
  message?: string;
  request_id?: string;
  rawBody?: string;
};

type ZeptomailSendPayload = {
  from: { address: string; name: string };
  to: Array<{ email_address: { address: string; name: string } }>;
  subject: string;
  htmlbody?: string;
  textbody?: string;
  reply_to?: Array<{ address: string; name: string }>;
  attachments?: Array<{ name: string; content: string; mime_type?: string }>;
};

export function buildZeptomailPayload(
  emailData: EmailData,
  defaultFromEmail: string,
): ZeptomailSendPayload {
  const toArray = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
  const payload: ZeptomailSendPayload = {
    from: {
      address: emailData.from || defaultFromEmail,
      name: 'PaqadHR',
    },
    to: toArray.map((email) => ({
      email_address: {
        address: email,
        name: email.split('@')[0] || email,
      },
    })),
    subject: emailData.subject,
  };
  if (emailData.html?.trim()) {
    payload.htmlbody = emailData.html;
  }
  if (emailData.text?.trim()) {
    payload.textbody = emailData.text;
  }

  if (emailData.replyTo) {
    payload.reply_to = [
      { address: emailData.replyTo, name: emailData.replyTo.split('@')[0] || 'Reply' },
    ];
  }

  if (emailData.attachments?.length) {
    payload.attachments = emailData.attachments.map((att) => ({
      name: att.filename,
      content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
      mime_type: att.contentType,
    }));
  }

  return payload;
}

export function formatZeptomailError(status: number, result: ZeptomailErrorBody): string {
  const error = result.error;
  const detailMessages =
    error?.details
      ?.map((detail) => {
        const parts = [detail.message, detail.target ? `(${detail.target})` : ''].filter(Boolean);
        return parts.join(' ');
      })
      .filter(Boolean) ?? [];

  const message =
    error?.message ||
    detailMessages.join('; ') ||
    result.message ||
    result.rawBody ||
    'Unknown error';

  const code = error?.code ? ` [${error.code}]` : '';
  const requestId = error?.request_id || result.request_id;
  const requestSuffix = requestId ? ` (request_id: ${requestId})` : '';

  return `Zeptomail API error (${status})${code}: ${message}${requestSuffix}`;
}

export function formatZeptomailSdkError(error: unknown, status = 500): string {
  if (error && typeof error === 'object' && 'error' in error) {
    return formatZeptomailError(status, error as ZeptomailErrorBody);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function toUserFacingEmailError(technicalMessage: string): string {
  const lower = technicalMessage.toLowerCase();

  if (lower.includes('not configured') || lower.includes('token cannot be empty')) {
    return 'Email delivery is not set up on this server. Contact your workspace admin.';
  }
  if (lower.includes('sender address') && lower.includes('not verified')) {
    return 'The sender email is not verified for delivery. Your admin needs to verify it in Zeptomail.';
  }
  if (lower.includes('credit exhausted') || lower.includes('quota')) {
    return 'Email sending limit reached. Try again later or contact support.';
  }
  if (lower.includes('subject is required') || lower.includes('subject cannot be empty')) {
    return 'Could not send the email because the message subject was missing.';
  }
  if (lower.includes('body is required')) {
    return 'Could not send the email because the message body was empty.';
  }
  if (lower.includes('timeout') || lower.includes('network error')) {
    return 'Email service timed out. Try resending in a moment.';
  }

  const cleaned = technicalMessage
    .replace(/^Zeptomail API error \(\d+\)(?:\s*\[[^\]]+\])?:\s*/i, '')
    .replace(/\s*\(request_id:[^)]+\)\s*$/i, '')
    .trim();

  if (!cleaned || cleaned.toLowerCase() === 'unknown error') {
    return 'We could not send the invite email. Try resend from Invitations, or contact support if it keeps failing.';
  }

  if (/^TM_\d+/i.test(cleaned) || cleaned.length > 140) {
    return 'We could not send the invite email. Try resend from Invitations.';
  }

  return cleaned;
}

@Injectable()
export class ZeptomailEmailService {
  private readonly logger = new Logger(ZeptomailEmailService.name);
  private readonly zeptomailApiKey: string;
  private readonly defaultFromEmail: string;
  private readonly mailClient: SendMailClient | null;

  constructor(private readonly emailTemplateService: EmailTemplateService) {
    this.zeptomailApiKey = process.env.ZEPTOMAIL_API_KEY || '';
    this.defaultFromEmail = process.env.DEFAULT_FROM_EMAIL || 'noreply@paqadhr.com';
    const apiUrl = process.env.ZEPTOMAIL_API_URL?.trim() || 'https://api.zeptomail.com/v1.1/email';
    this.mailClient = this.zeptomailApiKey
      ? new SendMailClient({
          url: apiUrl,
          token: this.zeptomailApiKey,
        })
      : null;

    if (!this.zeptomailApiKey) {
      this.logger.warn('ZEPTOMAIL_API_KEY not configured');
    }
  }

  async sendEmail(
    emailData: EmailData,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.mailClient) {
      this.logger.warn('ZEPTOMAIL_API_KEY not configured');
      return {
        success: false,
        error: toUserFacingEmailError('Zeptomail API key not configured'),
      };
    }

    if (!emailData.subject?.trim()) {
      return {
        success: false,
        error: toUserFacingEmailError('Email subject is required'),
      };
    }

    if (!emailData.html?.trim() && !emailData.text?.trim()) {
      return {
        success: false,
        error: toUserFacingEmailError('Email body is required'),
      };
    }

    try {
      const payload = buildZeptomailPayload(emailData, this.defaultFromEmail);
      const result = (await this.mailClient.sendMail(payload)) as {
        data?: Array<{ message_id?: string }>;
        request_id?: string;
      };
      return {
        success: true,
        messageId: result.data?.[0]?.message_id || result.request_id || 'unknown',
      };
    } catch (error) {
      const status =
        error && typeof error === 'object' && 'status' in error
          ? Number((error as { status?: number }).status) || 500
          : 500;
      const errorMessage = formatZeptomailSdkError(error, status);
      this.logger.warn(`Email send failed: ${errorMessage}`);
      return { success: false, error: toUserFacingEmailError(errorMessage) };
    }
  }

  async sendBulkEmails(
    emails: EmailData[],
  ): Promise<Array<{ success: boolean; messageId?: string; error?: string }>> {
    const results = await Promise.allSettled(emails.map((email) => this.sendEmail(email)));
    return results.map((result) =>
      result.status === 'fulfilled'
        ? result.value
        : { success: false, error: result.reason?.message || 'Unknown error' },
    );
  }

  async sendTemplateEmail(
    to: string | string[],
    templateKey: string,
    variables: Record<string, unknown>,
    options?: {
      from?: string;
      replyTo?: string;
      subject?: string;
    },
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (this.emailTemplateService.hasTemplate(templateKey)) {
        const rendered = this.emailTemplateService.render(templateKey, variables);
        return await this.sendEmail({
          to,
          subject: options?.subject || rendered.subject,
          html: rendered.html,
          text: rendered.text,
          from: options?.from,
          replyTo: options?.replyTo,
        });
      }

      const templates = this.getEmailTemplates();
      const template = templates[templateKey];
      if (!template) {
        throw new NotFoundException(`Template '${templateKey}' not found`);
      }
      const html = this.renderTemplate(template.html, variables);
      const text = this.renderTemplate(template.text, variables);
      const subject = options?.subject || this.renderTemplate(template.subject, variables);
      return await this.sendEmail({
        to,
        subject,
        html,
        text,
        from: options?.from,
        replyTo: options?.replyTo,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to send template email '${templateKey}': ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }

  private renderTemplate(template: string, variables: Record<string, unknown>): string {
    let rendered = template;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, String(value || ''));
    });
    return rendered;
  }

  private getEmailTemplates(): Record<string, { subject: string; html: string; text: string }> {
    return {
      welcome: {
        subject: 'Welcome to {{ tenantName }}',
        html: `
          <h1>Welcome to {{ tenantName }}, {{ name }}!</h1>
          <p>We're excited to have you on board.</p>
          <p>You can now access your dashboard and start collaborating with your team.</p>
        `,
        text: `Welcome to {{ tenantName }}, {{ name }}! We're excited to have you on board. You can now access your dashboard and start collaborating with your team.`,
      },
      'password-reset': {
        subject: 'Password Reset Request',
        html: `
          <h1>Password Reset Request</h1>
          <p>You requested a password reset. Click the link below to reset your password:</p>
          <p><a href="{{ resetLink }}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
        text: `Password Reset Request. You requested a password reset. Click here to reset: {{ resetLink }}. If you didn't request this, please ignore this email.`,
      },
      'payroll-notification': {
        subject: 'Payroll Processed - {{ payrollPeriod }}',
        html: `
          <h1>Payroll Processed</h1>
          <p>Hello {{ employeeName }},</p>
          <p>Your payroll for {{ payrollPeriod }} has been processed.</p>
          <p><strong>Amount: {{ currency }} {{ amount }}</strong></p>
          <p>Please check your account for the payment details.</p>
        `,
        text: `Payroll Processed. Hello {{ employeeName }}, your payroll for {{ payrollPeriod }} has been processed. Amount: {{ currency }} {{ amount }}. Please check your account for payment details.`,
      },
      notification: {
        subject: '{{ title }}',
        html: `
          <h1>{{ title }}</h1>
          <p>{{ message }}</p>
          {{ #if actionData.url }}
          <p><a href="{{ actionData.url }}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">{{ actionData.buttonText }}</a></p>
          {{ /if }}
        `,
        text: `{{ title }}. {{ message }}. {{ #if actionData.url }}{{ actionData.buttonText }}: {{ actionData.url }}{{ /if }}`,
      },
    };
  }
}
