import { type InvitationEmailVariables, renderInvitationEmail } from './invitation.template';
import type { RenderedEmailTemplate } from './types';

type EmailTemplateRenderer = (variables: Record<string, unknown>) => RenderedEmailTemplate;

export const EMAIL_TEMPLATE_REGISTRY: Record<string, EmailTemplateRenderer> = {
  invitation: (variables) =>
    renderInvitationEmail(variables as unknown as InvitationEmailVariables),
};
