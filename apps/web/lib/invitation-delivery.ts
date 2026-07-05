import { toast } from 'sonner';

type InvitationDelivery = {
  emailSent?: boolean;
  emailError?: string;
};

export function toastInvitationDelivery(
  delivery: InvitationDelivery,
  options: { successMessage: string; failureMessage: string },
) {
  if (delivery.emailSent === false) {
    toast.warning(options.failureMessage, {
      description: delivery.emailError ?? 'Invite saved. Resend from Invitations.',
    });
    return;
  }

  toast.success(options.successMessage);
}
