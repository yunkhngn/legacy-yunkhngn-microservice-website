import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsString()
  @IsNotEmpty()
  settingTitle: string;

  @IsOptional()
  id?: number;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  group?: string;

  @IsOptional()
  sortOrder?: number;

  @IsOptional()
  isSensitive?: boolean;

  @IsOptional()
  isSystem?: boolean;

  @IsOptional()
  isPublic?: boolean;
}
