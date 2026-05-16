import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'My Awesome Project' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'my-awesome-project' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'A brief description of my project' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'React,NestJS,Prisma' })
  @IsString()
  @IsOptional()
  techStack?: string;

  @ApiPropertyOptional({ example: 'https://github.com/user/repo' })
  @IsString()
  @IsOptional()
  repoLink?: string;

  @ApiPropertyOptional({ example: 'https://project.com' })
  @IsString()
  @IsOptional()
  demoLink?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cover?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  thumbnail?: string;

  @ApiPropertyOptional({ example: 'web,opensource' })
  @IsString()
  @IsOptional()
  tags?: string;

  @ApiProperty({ example: '{"type":"doc","content":[]}' })
  @IsString()
  @IsNotEmpty()
  contentJSON: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT' })
  @IsEnum(['DRAFT', 'PUBLISHED'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  seoDescription?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  seoImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  sendNewsletter?: boolean;
}
