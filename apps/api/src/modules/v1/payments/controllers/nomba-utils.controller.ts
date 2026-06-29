import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  getNombaBaseUrl,
  getNombaClientId,
  getNombaClientSecret,
} from 'src/common/config/nomba.config';
import { Public } from 'src/common/decorators';
import { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';

class GetAccountIdDto {
  client_id?: string;
  client_secret?: string;
}

@ApiTags('Nomba Utilities')
@Controller('payments/nomba/utils')
@Public()
export class NombaUtilsController {
  constructor(private readonly nombaTransferApi: NombaTransferApiService) {}

  @Post('account-id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange client credentials for accountId (businessId) and list accounts',
  })
  async getAccountId(@Body() dto: GetAccountIdDto) {
    const clientId = dto.client_id || getNombaClientId();
    const clientSecret = dto.client_secret || getNombaClientSecret();

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Client credentials are not provided or configured');
    }

    try {
      const tokenResponse = await fetch(`${getNombaBaseUrl()}/v1/auth/token/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      const tokenPayload = (await tokenResponse.json()) as any;

      if (!tokenResponse.ok || tokenPayload.code !== '00' || !tokenPayload.data?.businessId) {
        throw new BadRequestException(
          tokenPayload.description || 'Failed to authenticate with Nomba',
        );
      }

      const accountId = tokenPayload.data.businessId;
      const accessToken = tokenPayload.data.access_token;

      // Also list sub-accounts under this business
      let accounts: any[] = [];
      try {
        const accountsResponse = await fetch(`${getNombaBaseUrl()}/v1/accounts`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            accountId: accountId,
          },
        });
        if (accountsResponse.ok) {
          const accountsPayload = (await accountsResponse.json()) as any;
          accounts = accountsPayload.data?.results || [];
        }
      } catch {
        // Suppress list accounts error, just return the accountId
      }

      return {
        accountId,
        accounts,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to retrieve account details',
      );
    }
  }

  @Get('lookup-phone')
  @ApiOperation({
    summary: 'Lookup bank account details in Nigeria using a phone number',
  })
  @ApiQuery({ name: 'phoneNumber', description: 'Phone number (e.g. 08012345678 or 8012345678)' })
  @ApiQuery({
    name: 'bankCode',
    required: false,
    description: 'Optional specific bank code (e.g. 999992 for OPay)',
  })
  async lookupPhone(
    @Query('phoneNumber') phoneNumber: string,
    @Query('bankCode') bankCode?: string,
  ) {
    if (!phoneNumber) {
      throw new BadRequestException('Phone number is required');
    }

    // Standardize phone number formats: e.g. 2348012345678 -> 08012345678
    let cleanedNumber = phoneNumber.trim().replace(/\D/g, '');
    if (cleanedNumber.startsWith('234') && cleanedNumber.length > 10) {
      cleanedNumber = `0${cleanedNumber.slice(3)}`;
    } else if (!cleanedNumber.startsWith('0') && cleanedNumber.length === 10) {
      cleanedNumber = `0${cleanedNumber}`;
    }

    // If a bankCode is explicitly supplied, run lookup just for it
    if (bankCode) {
      try {
        const result = await this.nombaTransferApi.lookupBankAccount(cleanedNumber, bankCode);
        return {
          resolved: true,
          bankCode,
          accountNumber: result.accountNumber,
          accountName: result.accountName,
        };
      } catch (error) {
        throw new BadRequestException(
          `Failed to lookup account with bank code ${bankCode}: ${error instanceof Error ? error.message : 'Invalid account'}`,
        );
      }
    }

    // Otherwise, attempt sequentially OPay, PalmPay, and Moniepoint which use phone numbers
    const targetBanks = [
      { code: '999992', name: 'OPay' },
      { code: '999991', name: 'PalmPay' },
      { code: '50515', name: 'Moniepoint' },
    ];

    for (const bank of targetBanks) {
      try {
        const result = await this.nombaTransferApi.lookupBankAccount(cleanedNumber, bank.code);
        return {
          resolved: true,
          bankCode: bank.code,
          bankName: bank.name,
          accountNumber: result.accountNumber,
          accountName: result.accountName,
        };
      } catch {
        // Continue to check the next bank provider
      }
    }

    throw new BadRequestException(
      'Could not verify account name for this phone number across OPay, PalmPay, or Moniepoint',
    );
  }
}
