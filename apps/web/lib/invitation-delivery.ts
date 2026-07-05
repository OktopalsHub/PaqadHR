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
      description:
        delivery.emailError ??
        'The invitation was saved but the email could not be sent. Try resending from the Invitations tab.',
    });
    return;
  }

  toast.success(options.successMessage);
}
