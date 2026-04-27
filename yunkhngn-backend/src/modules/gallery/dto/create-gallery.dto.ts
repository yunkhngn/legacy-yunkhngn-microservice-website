import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGalleryDto {
  @ApiProperty({ example: 'https://cloudinary.com/image.jpg' })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @ApiPropertyOptional({ example: 'Sunset at the beach' })
  @IsString()
  @IsOptional()
  caption?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  albumId?: string;

  @ApiPropertyOptional({ example: 'nature,sunset' })
  @IsString()
  @IsOptional()
  tags?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  exifData?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  blurHash?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  width?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  height?: number;
}
