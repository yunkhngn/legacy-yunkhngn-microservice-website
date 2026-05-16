import { Test } from '@nestjs/testing';
import { PrismaProjectRepository } from './project.repository';
import { PrismaService } from '../../../database/prisma/prisma.service';

describe('PrismaProjectRepository.findManyByIds', () => {
  let repo: PrismaProjectRepository;
  let prisma: { project: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { project: { findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaProjectRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    repo = moduleRef.get(PrismaProjectRepository);
  });

  it('returns [] for empty input', async () => {
    const result = await repo.findManyByIds([]);
    expect(result).toEqual([]);
    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });

  it('preserves input order and drops missing rows', async () => {
    prisma.project.findMany.mockResolvedValue([
      { id: 'c', title: 'C' },
      { id: 'a', title: 'A' },
    ]);
    const result = await repo.findManyByIds(['a', 'b', 'c']);
    expect(result.map((r) => r.id)).toEqual(['a', 'c']);
  });
});
