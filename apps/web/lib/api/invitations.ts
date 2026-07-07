import { apiClient } from '@/lib/api/client';

export type InvitationDetails = {
  id: string;
  email: string;
  tenantId: string;
  tenantName: string;
  tenantSlug?: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  status: string;
  expiresAt: string;
  userExists: boolean;
  user: {
    id: string;
    email: string;
    role: string;
    needsPassword: boolean;
  } | null;
};

export type AcceptInvitationResponse = {
  success: boolean;
  message: string;
  data: {
    userExists: boolean;
    user: {
      id: string;
      email: string;
      role: string;
      needsPassword: boolean;
    } | null;
    invitation: {
      id: string;
      status: string;
      tenantId: string;
      tenantSlug?: string;
    };
  };
};

export async function fetchInvitationDetails(
  token: string,
  email: string,
): Promise<InvitationDetails> {
  const params = new URLSearchParams({ token, email });
  return apiClient<InvitationDetails>(`/invitations/details?${params.toString()}`);
}

export async function acceptInvitation(input: {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  preferredName?: string;
}): Promise<AcceptInvitationResponse> {
  return apiClient<AcceptInvitationResponse>('/invitations/accept', {
    method: 'POST',
    body: JSON.stringify(input),
    skipCsrf: true,
  });
}

export async function declineInvitation(input: {
  token: string;
  email: string;
}): Promise<{ success: boolean; message: string }> {
  return apiClient('/invitations/decline', {
    method: 'POST',
    body: JSON.stringify(input),
    skipCsrf: true,
  });
}
