import { Injectable } from '@nestjs/common';

interface TurnstileVerifyResponse {
  success: boolean;
}

@Injectable()
export class TurnstileService {
  private readonly secret = process.env.TURNSTILE_SECRET_KEY;

  isEnabled(): boolean {
    return Boolean(this.secret);
  }

  async verify(token: string, remoteip?: string): Promise<boolean> {
    if (!this.secret) {
      return true;
    }
    if (!token) {
      return false;
    }

    const body = new URLSearchParams({
      secret: this.secret,
      response: token,
    });
    if (remoteip) {
      body.set('remoteip', remoteip);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as TurnstileVerifyResponse;
    return data.success === true;
  }
}
