import { IsString, IsUrl, IsInt, Min, Max } from 'class-validator';

export class RegisterEngineDto {
  @IsString()
  instanceId: string;

  @IsUrl({ require_tld: false })
  url: string;

  @IsInt()
  @Min(1)
  @Max(200)
  maxSessions: number;
}
