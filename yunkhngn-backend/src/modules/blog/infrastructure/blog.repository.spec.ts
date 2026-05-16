import { Test } from '@nestjs/testing';
import { PrismaBlogRepository } from './blog.repository';
import { PrismaService } from '../../../database/prisma/prisma.service';

describe('PrismaBlogRepository.findManyByIds', () => {
  let repo: PrismaBlogRepository;
  let prisma: { blog: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { blog: { findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaBlogRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    repo = moduleRef.get(PrismaBlogRepository);
  });

  it('returns [] for empty input without hitting prisma', async () => {
    const result = await repo.findManyByIds([]);
    expect(result).toEqual([]);
    expect(prisma.blog.findMany).not.toHaveBeenCalled();
  });

  it('preserves input order and drops missing rows', async () => {
    prisma.blog.findMany.mockResolvedValue([
      { id: 'c', title: 'C' },
      { id: 'a', title: 'A' },
    ]);
    const result = await repo.findManyByIds(['a', 'b', 'c']);
    expect(result.map((r) => r.id)).toEqual(['a', 'c']);
  });
});
