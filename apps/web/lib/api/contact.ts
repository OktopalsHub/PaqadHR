import { apiClient } from '@/lib/api/client';

export type ContactFormConfig = {
  turnstileRequired: boolean;
};

export type SubmitContactPayload = {
  name: string;
  email: string;
  message: string;
  turnstileToken?: string;
};

export async function fetchContactFormConfig(): Promise<ContactFormConfig> {
  return apiClient<ContactFormConfig>('/contact');
}

export async function submitContactForm(body: SubmitContactPayload): Promise<{ success: true }> {
  return apiClient<{ success: true }>('/contact', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
