import { Test, TestingModule } from '@nestjs/testing';
import { PhotoReactionsService } from './photo-reactions.service';
import { IPhotoReactionRepository } from './domain/photo-reaction.repository.interface';
import { NotificationsService } from '../notifications/notifications.service';

const mockPhotoReactionRepository = {
  upsert: jest.fn(),
  delete: jest.fn(),
  findByPhotoId: jest.fn(),
  findByPhotoAndUser: jest.fn(),
};

const mockNotificationsService = {
  create: jest.fn().mockResolvedValue({}),
};

describe('PhotoReactionsService', () => {
  let service: PhotoReactionsService;
  let repository: IPhotoReactionRepository;
  let notificationsService: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotoReactionsService,
        {
          provide: IPhotoReactionRepository,
          useValue: mockPhotoReactionRepository,
        },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<PhotoReactionsService>(PhotoReactionsService);
    repository = module.get<IPhotoReactionRepository>(IPhotoReactionRepository);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addOrUpdateReaction', () => {
    it('should upsert reaction and trigger notification', async () => {
      const photoId = 'photo1';
      const uid = 'user1';
      const reactionType = 'LOVE';
      const result = { id: '1', photoId, uid, reactionType };

      mockPhotoReactionRepository.upsert.mockResolvedValue(result);

      await service.addOrUpdateReaction(photoId, uid, reactionType);

      expect(repository.upsert).toHaveBeenCalledWith(
        photoId,
        uid,
        reactionType,
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        'LIKE',
        expect.stringContaining(reactionType),
        `/photo#photo-${photoId}`,
      );
    });
  });

  describe('removeReaction', () => {
    it('should delete reaction', async () => {
      const photoId = 'photo1';
      const uid = 'user1';

      mockPhotoReactionRepository.delete.mockResolvedValue({ id: '1' });

      await service.removeReaction(photoId, uid);

      expect(repository.delete).toHaveBeenCalledWith(photoId, uid);
    });
  });

  describe('getPhotoReactions', () => {
    it('should return reactions for a photo', async () => {
      const photoId = 'photo1';
      const reactions = [{ id: '1', reactionType: 'like' }] as any;

      mockPhotoReactionRepository.findByPhotoId.mockResolvedValue(reactions);

      const result = await service.getPhotoReactions(photoId);

      expect(result).toEqual({
        counts: {
          like: 1,
          heart: 0,
          cat: 0,
          fire: 0,
          laugh: 0,
        },
        total: 1,
      });
      expect(repository.findByPhotoId).toHaveBeenCalledWith(photoId);
    });
  });
});
