import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBlogDto {
  @ApiProperty({ example: 'My First Blog Post' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'my-first-blog-post' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional({ example: 'https://example.com/thumb.jpg' })
  @IsString()
  @IsOptional()
  thumbnail?: string;

  @ApiPropertyOptional({ example: 'tech,react' })
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
  @IsString()
  @IsOptional()
  imageSettings?: string;
}
