import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { getOptional } from 'src/common/config/env.util';
import type { SubmitContactDto } from './dto/submit-contact.dto';

type Web3FormsResponse = {
  success?: boolean;
  message?: string;
};

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  async submit(dto: SubmitContactDto): Promise<{ success: true }> {
    const accessKey = getOptional('WEB3FORMS_ACCESS_KEY');
    if (!accessKey) {
      this.logger.error('WEB3FORMS_ACCESS_KEY is not configured');
      throw new ServiceUnavailableException('Contact form is temporarily unavailable');
    }

    let response: Response;
    try {
      response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          access_key: accessKey,
          name: dto.name.trim(),
          email: dto.email.trim().toLowerCase(),
          message: dto.message.trim(),
          subject: 'Paqad contact form',
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      this.logger.warn(`Web3Forms request failed: ${String(error)}`);
      throw new BadGatewayException('Could not send message. Try again later.');
    }

    let data: Web3FormsResponse = {};
    try {
      data = (await response.json()) as Web3FormsResponse;
    } catch {
      data = {};
    }

    if (!response.ok || data.success !== true) {
      this.logger.warn(
        `Web3Forms rejected contact submit status=${response.status} message=${data.message ?? ''}`,
      );
      throw new BadGatewayException('Could not send message. Try again later.');
    }

    return { success: true };
  }
}
