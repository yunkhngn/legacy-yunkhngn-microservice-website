import { IsString, IsOptional } from 'class-validator';

export class UpdateKnowledgeDto {
  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;
}
