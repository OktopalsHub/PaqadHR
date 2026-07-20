import {
  type FounderWelcomeEmailVariables,
  renderFounderWelcomeEmail,
} from './founder-welcome.template';
import { type InvitationEmailVariables, renderInvitationEmail } from './invitation.template';
import type { GenericNotificationEmailVariables } from './notification.template';
import { renderGenericNotificationEmail } from './notification.template';
import {
  type OtpVerificationEmailVariables,
  renderOtpVerificationEmail,
} from './otp-verification.template';
import {
  type PasswordResetEmailVariables,
  renderPasswordResetEmail,
} from './password-reset.template';
import {
  type PayrollNotificationEmailVariables,
  renderPayrollNotificationEmail,
} from './payroll-notification.template';
import type { RenderedEmailTemplate } from './types';
import { renderWelcomeEmail, type WelcomeEmailVariables } from './welcome.template';

type EmailTemplateRenderer = (variables: Record<string, unknown>) => RenderedEmailTemplate;

export const EMAIL_TEMPLATE_REGISTRY: Record<string, EmailTemplateRenderer> = {
  welcome: (variables) => renderWelcomeEmail(variables as unknown as WelcomeEmailVariables),
  'founder-welcome': (variables) =>
    renderFounderWelcomeEmail(variables as unknown as FounderWelcomeEmailVariables),
  invitation: (variables) =>
    renderInvitationEmail(variables as unknown as InvitationEmailVariables),
  'otp-verification': (variables) =>
    renderOtpVerificationEmail(variables as unknown as OtpVerificationEmailVariables),
  'password-reset': (variables) =>
    renderPasswordResetEmail(variables as unknown as PasswordResetEmailVariables),
  'payroll-notification': (variables) =>
    renderPayrollNotificationEmail(variables as unknown as PayrollNotificationEmailVariables),
  notification: (variables) =>
    renderGenericNotificationEmail(variables as unknown as GenericNotificationEmailVariables),
};
