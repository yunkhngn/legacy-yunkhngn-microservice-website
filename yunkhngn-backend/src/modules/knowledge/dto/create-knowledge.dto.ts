import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateKnowledgeDto {
  @IsString()
  @IsOptional()
  category?: string = 'general';

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
