import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;
}
