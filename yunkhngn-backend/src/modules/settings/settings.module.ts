import { Module, Global } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { EncryptionService } from '../../common/encryption.service';
import { ISettingsRepository } from './domain/settings.repository.interface';
import { PrismaSettingsRepository } from './infrastructure/settings.repository';
import { PrismaModule } from '../../database/prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    EncryptionService,
    {
      provide: ISettingsRepository,
      useClass: PrismaSettingsRepository,
    },
  ],
  exports: [SettingsService],
})
export class SettingsModule { }
