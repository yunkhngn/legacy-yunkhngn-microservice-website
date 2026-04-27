import { Test, TestingModule } from '@nestjs/testing';
import { ShortlinkService } from './shortlink.service';
import { IShortLinkRepository } from './domain/shortlink.repository.interface';
import { NotFoundException, ConflictException } from '@nestjs/common';

const mockShortLinkRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findByCode: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  incrementClicks: jest.fn(),
};

describe('ShortlinkService', () => {
  let service: ShortlinkService;
  let repository: typeof mockShortLinkRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShortlinkService,
        { provide: IShortLinkRepository, useValue: mockShortLinkRepository },
      ],
    }).compile();

    service = module.get<ShortlinkService>(ShortlinkService);
    repository = mockShortLinkRepository;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a shortlink with a provided code', async () => {
      const dto = {
        code: 'test',
        targetUrl: 'https://example.com',
        title: 'Test',
      };
      const result = {
        id: '1',
        code: 'test',
        targetUrl: 'https://example.com',
        title: 'Test',
        clicks: 0,
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.findByCode.mockResolvedValue(null);
      repository.create.mockResolvedValue(result);

      expect(await service.create(dto)).toEqual(result);
    });

    it('should throw ConflictException if code already exists', async () => {
      const dto = { code: 'test', targetUrl: 'https://example.com' };
      repository.findByCode.mockResolvedValue({ id: '1', code: 'test' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should auto-generate a code if not provided', async () => {
      const dto = { targetUrl: 'https://example.com' };
      repository.findByCode.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        id: '1',
        code: 'abc123',
        targetUrl: 'https://example.com',
        clicks: 0,
        isActive: true,
      });

      const result = await service.create(dto);
      expect(result).toBeDefined();
      expect(repository.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all shortlinks', async () => {
      const result = [
        { id: '1', code: 'test', targetUrl: 'https://example.com' },
      ];
      repository.findAll.mockResolvedValue(result);

      expect(await service.findAll()).toEqual(result);
    });
  });

  describe('resolve', () => {
    it('should resolve a valid shortlink and return targetUrl', async () => {
      const link = {
        id: '1',
        code: 'test',
        targetUrl: 'https://example.com',
        isActive: true,
        expiresAt: null,
      };
      repository.findByCode.mockResolvedValue(link);
      repository.incrementClicks.mockResolvedValue(link);

      const result = await service.resolve('test');
      expect(result).toEqual({ targetUrl: 'https://example.com' });
    });

    it('should throw NotFoundException for non-existent code', async () => {
      repository.findByCode.mockResolvedValue(null);

      await expect(service.resolve('nope')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for inactive link', async () => {
      repository.findByCode.mockResolvedValue({
        id: '1',
        code: 'test',
        targetUrl: 'https://example.com',
        isActive: false,
        expiresAt: null,
      });

      await expect(service.resolve('test')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for expired link', async () => {
      repository.findByCode.mockResolvedValue({
        id: '1',
        code: 'test',
        targetUrl: 'https://example.com',
        isActive: true,
        expiresAt: new Date('2020-01-01'),
      });

      await expect(service.resolve('test')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a shortlink', async () => {
      repository.findById.mockResolvedValue({ id: '1' });
      repository.delete.mockResolvedValue({ id: '1' });

      await expect(service.remove('1')).resolves.toBeDefined();
    });

    it('should throw NotFoundException if not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });
});
