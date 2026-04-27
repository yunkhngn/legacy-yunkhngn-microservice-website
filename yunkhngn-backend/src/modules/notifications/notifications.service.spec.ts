import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { INotificationRepository } from './domain/notification.repository.interface';
import { NotificationsGateway } from './notifications.gateway';

const mockNotificationRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  countUnread: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  delete: jest.fn(),
};

const mockNotificationsGateway = {
  sendNotification: jest.fn(),
};

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repository: typeof mockNotificationRepository;
  let gateway: NotificationsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: INotificationRepository, useValue: mockNotificationRepository },
        { provide: NotificationsGateway, useValue: mockNotificationsGateway },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    repository = mockNotificationRepository;
    gateway = module.get<NotificationsGateway>(NotificationsGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a notification and emit event', async () => {
      const dto = {
        type: 'CONTACT' as any,
        message: 'New message',
        link: '/admin/contact',
      };
      const createdNotification = {
        id: '1',
        ...dto,
        read: false,
        createdAt: new Date(),
      };

      repository.create.mockResolvedValue(
        createdNotification,
      );

      const result = await service.create(dto.type, dto.message, dto.link);

      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(gateway.sendNotification).toHaveBeenCalledWith(
        createdNotification,
      );
      expect(result).toEqual(createdNotification);
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      const notifications = [{ id: '1', message: 'test' }] as any;
      const total = 1;
      repository.findAll.mockResolvedValue({ data: notifications, total });
      repository.countUnread.mockResolvedValue(0);

      const result = await service.findAll(1, 10);

      expect(result.data).toEqual(notifications);
      expect(result.meta.total).toEqual(total);
    });
  });
});
