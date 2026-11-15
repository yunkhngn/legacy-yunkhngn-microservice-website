import { Test, TestingModule } from '@nestjs/testing';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('SystemController', () => {
  let controller: SystemController;

  const mockSystemService = {
    getStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemController],
      providers: [
        {
          provide: SystemService,
          useValue: mockSystemService,
        },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();

    controller = module.get<SystemController>(SystemController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
