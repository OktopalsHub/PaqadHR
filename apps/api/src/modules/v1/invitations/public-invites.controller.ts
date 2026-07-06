import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StringUtility } from 'src/common/utils';
import { Public } from '../../../common/decorators';
import { InvitationsService } from './invitations.service';

class AcceptInvitationDto {
  token: string;
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  preferredName?: string;
}

@ApiTags('Public Invitations')
@Controller('invitations')
export class PublicInvitesController {
  constructor(private readonly invitationsService: InvitationsService) {}
  private validateEmail(email: string): string | null {
    if (!email) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? null : 'Invalid email format';
  }
  @Get('details')
  @Public()
  async getInvitationDetails(@Query('token') token: string, @Query('email') email: string) {
    if (!token || !email) {
      throw new BadRequestException('Token and email are required');
    }
    const validationError = this.validateEmail(email);
    if (validationError) {
      throw new BadRequestException(validationError);
    }
    try {
      const invitation = await this.invitationsService.getInvitationByTokenAndEmail(token, email);
      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }
      return invitation;
    } catch (error) {
      if (error.message?.includes('The email address does not match the invited user email')) {
        throw new BadRequestException('The email address does not match the invited user email');
      }
      throw error;
    }
  }
  @Post('accept')
  @Public()
  async acceptInvitation(@Body() acceptInvitationDto: AcceptInvitationDto) {
    const { token, email, password, firstName, lastName, preferredName } = acceptInvitationDto;
    const normalizedEmail = StringUtility.trimAndLowerCase(email);
    if (!token || !normalizedEmail) {
      throw new BadRequestException('Token and email are required');
    }
    try {
      const result = await this.invitationsService.acceptInvitation(token, normalizedEmail, {
        password,
        firstName,
        lastName,
        preferredName,
      });
      if (!result?.invitation) {
        throw new InternalServerErrorException('Failed to process invitation');
      }
      return {
        success: true,
        message: 'Invitation accepted successfully',
        data: {
          user: result.user,
          userExists: result.userExists,
          invitation: {
            id: result.invitation.id,
            status: result.invitation.status,
            tenantId: result.invitation.tenantId,
            tenantSlug: result.invitation.tenantSlug,
          },
        },
      };
    } catch (error) {
      if (error.message?.includes('The email address does not match the invited user email')) {
        throw new BadRequestException('The email address does not match the invited user email');
      }
      throw error;
    }
  }
  @Post('decline')
  @Public()
  async declineInvitation(@Body() body: { token: string; email: string }) {
    const { token, email } = body || {};
    if (!token || !email) {
      throw new BadRequestException('Token and email are required');
    }
    const validationError = this.validateEmail(email);
    if (validationError) {
      throw new BadRequestException(validationError);
    }
    try {
      const result = await this.invitationsService.declineInvitationByTokenAndEmail(token, email);
      if (!result) {
        throw new InternalServerErrorException('Failed to process invitation decline');
      }
      return {
        success: true,
        message: 'Invitation declined successfully',
        data: result,
      };
    } catch (error) {
      if (error.message?.includes('The email address does not match the invited user email')) {
        throw new BadRequestException('The email address does not match the invited user email');
      }
      throw error;
    }
  }
}
