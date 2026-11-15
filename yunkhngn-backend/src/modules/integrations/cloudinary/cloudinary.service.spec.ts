import { Test, TestingModule } from '@nestjs/testing';
import { CloudinaryService } from './cloudinary.service';

describe('CloudinaryService', () => {
  let service: CloudinaryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CloudinaryService],
    }).compile();

    service = module.get<CloudinaryService>(CloudinaryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractPublicId', () => {
    it('should extract public ID from a standard cloudinary URL', () => {
      const url =
        'https://res.cloudinary.com/cloudname/image/upload/v1234567890/folder/subfolder/image.jpg';
      expect(service.extractPublicId(url)).toBe('folder/subfolder/image');
    });

    it('should extract public ID from a URL without version segment', () => {
      const url =
        'https://res.cloudinary.com/cloudname/image/upload/folder/image.jpg';
      expect(service.extractPublicId(url)).toBe('folder/image');
    });

    it('should return null for invalid URLs', () => {
      expect(
        service.extractPublicId('https://example.com/image.jpg'),
      ).toBeNull();
      expect(service.extractPublicId(null as any)).toBeNull();
    });
  });
});
