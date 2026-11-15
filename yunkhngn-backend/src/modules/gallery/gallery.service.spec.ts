import { Test, TestingModule } from '@nestjs/testing';
import { GalleryService } from './gallery.service';
import { IGalleryRepository } from './domain/gallery.repository.interface';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

const mockGalleryRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  incrementViews: jest.fn(),
  updateMany: jest.fn(),
  bulkUpdate: jest.fn(),
  getAllTags: jest.fn(),
  reorder: jest.fn(),
};

const mockCloudinaryService = {
  generateUploadSignature: jest.fn(),
};

describe('GalleryService', () => {
  let service: GalleryService;
  let cloudinary: CloudinaryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GalleryService,
        { provide: IGalleryRepository, useValue: mockGalleryRepository },
        { provide: CloudinaryService, useValue: mockCloudinaryService },
        { provide: CACHE_MANAGER, useValue: { del: jest.fn() } },
      ],
    }).compile();

    service = module.get<GalleryService>(GalleryService);
    cloudinary = module.get<CloudinaryService>(CloudinaryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated photos with default params', async () => {
      mockGalleryRepository.findAll.mockResolvedValue({
        data: [{ id: '1' }],
        total: 1,
      });

      const result = await service.findAll();

      expect(result).toEqual({
        data: [{ id: '1' }],
        total: 1,
        page: 1,
        totalPages: 1,
      });
    });

    it('should filter by albumId and tag', async () => {
      mockGalleryRepository.findAll.mockResolvedValue({ data: [], total: 0 });

      await service.findAll({
        albumId: 'album-1',
        tag: 'travel',
        page: 1,
        limit: 10,
      });

      expect(mockGalleryRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { albumId: 'album-1', tags: { contains: 'travel' } },
        }),
      );
    });
  });

  describe('incrementViews', () => {
    it('should fire and forget', async () => {
      mockGalleryRepository.incrementViews.mockResolvedValue({});
      const result = await service.incrementViews('photo-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('reorder', () => {
    it('should update sort orders', async () => {
      mockGalleryRepository.reorder.mockResolvedValue(2);
      const items = [
        { id: '1', sortOrder: 0 },
        { id: '2', sortOrder: 1 },
      ];
      const result = await service.reorder(items);
      expect(result).toEqual({ updated: 2 });
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple photos', async () => {
      mockGalleryRepository.bulkUpdate.mockResolvedValue(3);
      const result = await service.bulkUpdate(['1', '2', '3'], {
        tags: 'food',
      });
      expect(result).toEqual({ updated: 3 });
    });
  });

  describe('getAllTags', () => {
    it('should return tags', async () => {
      const tags = ['daily', 'food', 'travel'];
      mockGalleryRepository.getAllTags.mockResolvedValue(tags);
      const result = await service.getAllTags();
      expect(result).toEqual(tags);
    });
  });

  describe('getUploadSignature', () => {
    it('should return signature', () => {
      const result = {
        signature: 'sig',
        timestamp: 123,
        cloudName: 'test-cloud',
        apiKey: 'test-key',
      };
      jest.spyOn(cloudinary, 'generateUploadSignature').mockReturnValue(result);

      expect(service.getUploadSignature()).toEqual(result);
    });
  });
});
