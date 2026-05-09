import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSettingsDto {
  @IsString()
  @IsNotEmpty()
  settingTitle: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  group?: string;

  @IsOptional()
  isSensitive?: boolean;
}
