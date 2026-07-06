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
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { DeclineInvitationDto } from './dto/decline-invitation.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('Public Invitations')
@Controller('invitations')
export class PublicInvitesController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get('details')
  @Public()
  async getInvitationDetails(@Query('token') token: string, @Query('email') email: string) {
    if (!token || !email) {
      throw new BadRequestException('Token and email are required');
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
  async declineInvitation(@Body() body: DeclineInvitationDto) {
    try {
      const result = await this.invitationsService.declineInvitationByTokenAndEmail(
        body.token,
        body.email,
      );
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
