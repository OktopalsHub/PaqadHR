'use client';

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { fetchContactFormConfig, submitContactForm } from '@/lib/api/contact';

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';

export function ContactForm() {
  const [result, setResult] = useState('');
  const [pending, setPending] = useState(false);
  const [turnstileRequired, setTurnstileRequired] = useState<boolean | null>(null);
  const [configError, setConfigError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchContactFormConfig()
      .then((config) => {
        if (cancelled) return;
        setTurnstileRequired(config.turnstileRequired);
        if (config.turnstileRequired && !turnstileSiteKey) {
          setConfigError('Contact form is temporarily unavailable.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setTurnstileRequired(null);
        setConfigError('Contact form is temporarily unavailable.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const showTurnstile = turnstileRequired === true && Boolean(turnstileSiteKey);
  const formBlocked = Boolean(configError) || turnstileRequired === null;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formBlocked) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const message = String(formData.get('message') ?? '').trim();

    if (showTurnstile && !turnstileToken) {
      setResult('Complete the captcha to continue.');
      return;
    }

    setPending(true);
    setResult('Sending…');

    try {
      await submitContactForm({
        name,
        email,
        message,
        turnstileToken: showTurnstile ? (turnstileToken ?? undefined) : undefined,
      });
      setResult('Message sent.');
      form.reset();
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } catch (error) {
      const messageText = error instanceof ApiError ? error.message : 'Could not send. Try again.';
      setResult(messageText);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setPending(false);
    }
  };

  if (configError) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {configError}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="contact-name">Name</Label>
        <Input
          id="contact-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          maxLength={120}
          disabled={formBlocked}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-email">Email</Label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
          disabled={formBlocked}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          maxLength={5000}
          disabled={formBlocked}
        />
      </div>
      {showTurnstile ? (
        <Turnstile
          ref={turnstileRef}
          siteKey={turnstileSiteKey}
          onSuccess={handleTurnstileSuccess}
          onExpire={() => setTurnstileToken(null)}
        />
      ) : null}
      <Button type="submit" disabled={pending || formBlocked || (showTurnstile && !turnstileToken)}>
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
