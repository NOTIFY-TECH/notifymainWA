import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
