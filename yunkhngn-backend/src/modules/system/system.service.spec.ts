import { Test, TestingModule } from '@nestjs/testing';
import { SystemService } from './system.service';
import { PrismaService } from '../../database/prisma/prisma.service';

describe('SystemService', () => {
  let service: SystemService;

  const mockPrismaService = {
    blog: { count: jest.fn(), findMany: jest.fn() },
    project: { count: jest.fn(), findMany: jest.fn() },
    gallery: { count: jest.fn(), findMany: jest.fn() },
    comment: { count: jest.fn() },
    contact: { count: jest.fn(), findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SystemService>(SystemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
