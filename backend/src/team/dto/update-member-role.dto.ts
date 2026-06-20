import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { INVITABLE_ROLES, InvitableRole } from './invite-member.dto';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: INVITABLE_ROLES })
  @IsEnum(INVITABLE_ROLES, {
    message: `role must be one of: ${INVITABLE_ROLES.join(', ')}`,
  })
  role: InvitableRole;
}
