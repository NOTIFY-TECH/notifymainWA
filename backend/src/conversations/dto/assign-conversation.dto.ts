import { IsOptional, IsUUID } from 'class-validator';

// userId omitted or null => unassign the conversation.
// userId present => assign to that user (must belong to the same tenant).
export class AssignConversationDto {
  @IsOptional()
  @IsUUID()
  userId?: string | null;
}
