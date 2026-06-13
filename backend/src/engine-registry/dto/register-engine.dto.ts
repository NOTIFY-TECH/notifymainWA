import { IsString, IsInt, Min, Max, Matches } from 'class-validator';

export class RegisterEngineDto {
  @IsString()
  instanceId: string;

  @Matches(/^https?:\/\/.+/, { message: 'url must be a valid http(s) URL' })
  url: string;

  @IsInt()
  @Min(1)
  @Max(200)
  maxSessions: number;
}
