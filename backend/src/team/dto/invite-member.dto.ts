import { IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

// Roles that can be assigned via invite — SUPER_ADMIN and TENANT_OWNER
// cannot be granted through the invite flow.
export const INVITABLE_ROLES = [
  UserRole.TENANT_ADMIN,
  UserRole.MANAGER,
  UserRole.AGENT,
] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export class InviteMemberDto {
  @ApiProperty({ example: 'agent@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: INVITABLE_ROLES })
  @IsEnum(INVITABLE_ROLES, {
    message: `role must be one of: ${INVITABLE_ROLES.join(', ')}`,
  })
  role: InvitableRole;
}
