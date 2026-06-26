import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RenameApiKeyDto {
  @ApiProperty({ example: 'Staging integration' })
  @IsString()
  @Length(1, 100)
  name: string;
}
