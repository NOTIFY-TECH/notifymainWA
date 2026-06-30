import { IsOptional, IsUUID } from 'class-validator';

// managerId is nullable: null explicitly unassigns the agent from any
// manager. Omitting the field entirely is treated the same as null by the
// service (no partial-update ambiguity needed here, this DTO only ever
// carries this one field).
export class UpdateMemberManagerDto {
  @IsOptional()
  @IsUUID()
  managerId?: string | null;
}
