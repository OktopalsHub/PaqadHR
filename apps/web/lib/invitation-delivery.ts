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
      description: delivery.emailError ?? 'Saved. Resend from the Invitations tab.',
      duration: 8000,
    });
    return;
  }

  toast.success(options.successMessage);
}
