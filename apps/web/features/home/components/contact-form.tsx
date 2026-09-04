'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const WEB3FORMS_ACCESS_KEY = 'e8183a18-ea82-4041-bda5-1f62c2af65ca';

export function ContactForm() {
  const [result, setResult] = useState('');
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setResult('Sending…');

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.append('access_key', WEB3FORMS_ACCESS_KEY);
    formData.append('subject', 'Paqad contact form');

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData,
      });
      const data = (await response.json()) as { success?: boolean; message?: string };
      if (data.success) {
        setResult('Message sent.');
        form.reset();
      } else {
        setResult(data.message?.trim() || 'Could not send. Try again.');
      }
    } catch {
      setResult('Could not send. Try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="contact-name">Name</Label>
        <Input id="contact-name" name="name" type="text" required autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-email">Email</Label>
        <Input id="contact-email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea id="contact-message" name="message" required rows={5} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send message'}
      </Button>
      {result ? (
        <p className="text-sm text-muted-foreground" role="status">
          {result}
        </p>
      ) : null}
    </form>
  );
}
