import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvitationStatus } from '../../../../common/enums';
import type { Invitation } from '../entities/invitation.entity';

export function validateInvitationToken(token: string): void {
  if (!token) {
    throw new BadRequestException('Token is required');
  }
  if (typeof token !== 'string') {
    throw new BadRequestException('Token must be a string');
  }
}

export function validateEmailFormat(email: string): void {
  if (!email) {
    throw new BadRequestException('Email is required');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new BadRequestException('Invalid email format');
  }
}

export function validateName(firstName: string, lastName: string): void {
  if (!firstName || !lastName) {
    throw new BadRequestException('First name and last name are required');
  }
  if (typeof firstName !== 'string' || typeof lastName !== 'string') {
    throw new BadRequestException('First name and last name must be strings');
  }
}

export function validateInvitation(invitation: Invitation, email: string): void {
  if (!invitation) {
    throw new NotFoundException('Invitation not found');
  }
  if (invitation.email.toLowerCase() !== email.toLowerCase()) {
    throw new BadRequestException('The email address does not match the invited user email');
  }
  if (invitation.status !== InvitationStatus.PENDING) {
    throw new BadRequestException('This invitation has already been processed');
  }
}
