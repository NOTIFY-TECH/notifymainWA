import { IsString, MaxLength } from 'class-validator';

export class AddTagDto {
  @IsString()
  @MaxLength(50)
  tag: string;
}
