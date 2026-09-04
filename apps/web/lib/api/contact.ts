import { apiClient } from '@/lib/api/client';

export type SubmitContactPayload = {
  name: string;
  email: string;
  message: string;
  turnstileToken?: string;
};

export async function submitContactForm(body: SubmitContactPayload): Promise<{ success: true }> {
  return apiClient<{ success: true }>('/contact', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
