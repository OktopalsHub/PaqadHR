import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
@Injectable()
export class ZeptomailEmailService {
  private readonly logger = new Logger(ZeptomailEmailService.name);
  private readonly zeptomailApiKey: string;
  private readonly defaultFromEmail: string;
  private readonly apiUrl = 'https://api.zeptomail.com/v1.1/email';

  constructor(private readonly emailTemplateService: EmailTemplateService) {
    this.zeptomailApiKey = process.env.ZEPTOMAIL_API_KEY || '';
    this.defaultFromEmail = process.env.DEFAULT_FROM_EMAIL || 'noreply@paqadhr.com';
    if (!this.zeptomailApiKey) {
      this.logger.warn('ZEPTOMAIL_API_KEY is not configured. Email sending will fail.');
    }
  }
  async sendEmail(
    emailData: EmailData,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.zeptomailApiKey) {
      this.logger.warn(`Email to ${emailData.to} skipped: ZEPTOMAIL_API_KEY not configured`);
      return { success: false, error: 'Zeptomail API key not configured' };
    }

    try {
      const toArray = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
      const payload = {
        from: {
          address: emailData.from || this.defaultFromEmail,
          name: 'PaqadHR',
        },
        to: toArray.map((email) => ({
          email_address: {
            address: email,
          },
        })),
        subject: emailData.subject,
        htmlbody: emailData.html,
        textbody: emailData.text,
        reply_to: emailData.replyTo ? [{ address: emailData.replyTo }] : undefined,
        attachments: emailData.attachments?.map((att) => ({
          name: att.filename,
          content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
          mime_type: att.contentType,
        })),
      };
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-enczapikey ${this.zeptomailApiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const bodyText = await response.text();
      let result: Record<string, unknown> = {};
      if (bodyText) {
        try {
          result = JSON.parse(bodyText) as Record<string, unknown>;
        } catch {
          throw new BadRequestException(
            `Zeptomail returned non-JSON response (${response.status})`,
          );
        }
      }
      if (!response.ok) {
        const error = result.error as { message?: string } | undefined;
        throw new BadRequestException(
          `Zeptomail API error (${response.status}): ${error?.message || result.message || bodyText || 'Unknown error'}`,
        );
      }
      const data = result.data as Array<{ message_id?: string }> | undefined;
      this.logger.log(`Email sent successfully to ${emailData.to}`);
      return { success: true, messageId: data?.[0]?.message_id || 'unknown' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isExpectedFailure =
        message.includes('not configured') || /\(\s*4\d{2}\s*\)/.test(message);
      if (isExpectedFailure) {
        this.logger.warn(`Failed to send email to ${emailData.to}: ${message}`);
      } else {
        this.logger.error(`Failed to send email to ${emailData.to}:`, error);
      }
      return { success: false, error: message };
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
      this.logger.error(`Failed to send template email '${templateKey}' to ${to}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
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
