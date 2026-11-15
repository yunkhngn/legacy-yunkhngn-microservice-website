import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LetterService } from './letter.service';
import { ILetterRepository } from './domain/letter.repository.interface';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('LetterService', () => {
  let service: LetterService;

  const mockRepo = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    updateManyStatus: jest.fn(),
    incrementViews: jest.fn().mockResolvedValue(undefined),
    updatePage: jest.fn(),
    clearPages: jest.fn(),
  };
  const mockCloudinary = { deleteImagesSafely: jest.fn() };
  const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.findByCode.mockResolvedValue(null); // unique code by default
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LetterService,
        { provide: ILetterRepository, useValue: mockRepo },
        { provide: CloudinaryService, useValue: mockCloudinary },
        { provide: AuditLogsService, useValue: mockAudit },
      ],
    }).compile();
    service = module.get<LetterService>(LetterService);
  });

  describe('create (text kind)', () => {
    it('stores contentJSON+font, sets status ready, and does NOT create pages', async () => {
      mockRepo.create.mockImplementation((data) =>
        Promise.resolve({ id: 'l1', ...data, pages: [] }),
      );

      await service.create({
        kind: 'text',
        font: 'fz',
        contentJSON: '{"type":"doc","content":[]}',
        code: 'hello',
      } as any);

      const arg = mockRepo.create.mock.calls[0][0];
      expect(arg.kind).toBe('text');
      expect(arg.font).toBe('fz');
      expect(arg.contentJSON).toBe('{"type":"doc","content":[]}');
      expect(arg.status).toBe('ready');
      expect(arg.pages).toBeUndefined();
    });

    it('rejects a text letter with no content', async () => {
      await expect(
        service.create({ kind: 'text', code: 'x' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('create (scan kind)', () => {
    it('rejects a scan letter with no pages', async () => {
      await expect(
        service.create({ kind: 'scan', code: 'y', pages: [] } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates pages and sets status processing when animation enabled', async () => {
      mockRepo.create.mockImplementation((data) =>
        Promise.resolve({ id: 'l2', ...data, pages: [{ id: 'p1', imageUrl: 'u' }] }),
      );

      await service.create({
        code: 'z',
        pages: [{ imageUrl: 'u' }],
        enableAnimation: true,
      } as any);

      const arg = mockRepo.create.mock.calls[0][0];
      expect(arg.kind).toBe('scan');
      expect(arg.status).toBe('processing');
      expect(arg.pages.create).toHaveLength(1);
    });
  });

  describe('resolve', () => {
    it('returns kind/font/contentJSON for a public text letter', async () => {
      mockRepo.findByCode.mockResolvedValue({
        id: 'l1',
        title: 'Hi',
        password: null,
        kind: 'text',
        font: 'reebie',
        contentJSON: '{"type":"doc"}',
        status: 'ready',
        isActive: true,
        enableAnimation: true,
        pages: [],
        createdAt: new Date(),
      });

      const res = await service.resolve('hello');

      expect(res.kind).toBe('text');
      expect(res.font).toBe('reebie');
      expect(res.contentJSON).toBe('{"type":"doc"}');
    });

    it('withholds contentJSON when the text letter is password protected', async () => {
      mockRepo.findByCode.mockResolvedValue({
        id: 'l2',
        title: 'Secret',
        password: 'hash',
        kind: 'text',
        font: 'fz',
        contentJSON: '{"type":"doc"}',
        status: 'ready',
        isActive: true,
        enableAnimation: true,
        pages: [],
        createdAt: new Date(),
      });

      const res = await service.resolve('secret');

      expect(res.hasPassword).toBe(true);
      expect(res.contentJSON).toBeNull();
      expect(res.kind).toBe('text');
    });
  });

  describe('verifyPassword', () => {
    it('returns contentJSON+font after a public (no-password) text letter', async () => {
      mockRepo.findByCode.mockResolvedValue({
        id: 'l3',
        title: 'Open',
        password: null,
        kind: 'text',
        font: 'fz',
        contentJSON: '{"type":"doc"}',
        status: 'ready',
        isActive: true,
        pages: [],
      });

      const res = await service.verifyPassword('open', '');

      expect(res.contentJSON).toBe('{"type":"doc"}');
      expect(res.font).toBe('fz');
      expect(res.kind).toBe('text');
    });
  });

  describe('update (text kind)', () => {
    it('persists kind/font/contentJSON and keeps status ready without reprocessing', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'l9',
        code: 'c9',
        kind: 'text',
        password: null,
        enableAnimation: true,
        pages: [],
      });
      mockRepo.update.mockImplementation((id, data) =>
        Promise.resolve({ id, ...data, pages: [] }),
      );

      await service.update('l9', {
        kind: 'text',
        font: 'reebie',
        contentJSON: '{"type":"doc","content":[]}',
      } as any);

      const [, data] = mockRepo.update.mock.calls[0];
      expect(data.kind).toBe('text');
      expect(data.font).toBe('reebie');
      expect(data.contentJSON).toBe('{"type":"doc","content":[]}');
      expect(data.status).toBe('ready');
    });
  });

  describe('findOne', () => {
    it('returns the letter without the password hash', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'l1',
        code: 'c1',
        password: 'secret-hash',
        kind: 'text',
        font: 'fz',
        contentJSON: '{"type":"doc"}',
        pages: [],
      });

      const res = await service.findOne('l1');

      expect(res.id).toBe('l1');
      expect(res.contentJSON).toBe('{"type":"doc"}');
      expect(res).not.toHaveProperty('password');
      expect(res.hasPassword).toBe(true);
    });

    it('throws NotFound for a missing id', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toThrow();
    });
  });
});
