import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { AllExceptionsFilter, HttpExceptionFilter } from './common/filters';
import {
  LoggingInterceptor,
  TransformInterceptor,
} from './common/interceptors';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  appConfig,
  databaseConfig,
  redisConfig,
  firebaseConfig,
} from './config';
import { PrismaModule } from './database/prisma/prisma.module';

// Domain Modules
import { BlogModule } from './modules/blog/blog.module';
import { ProjectModule } from './modules/project/project.module';
import { GalleryModule } from './modules/gallery/gallery.module';
import { AlbumModule } from './modules/album/album.module';
import { MediaModule } from './modules/media/media.module';
import { PhotoReactionsModule } from './modules/photo-reactions/photo-reactions.module';
import { CommentsModule } from './modules/comments/comments.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UserModule } from './modules/user/user.module';
import { AiModule } from './modules/ai/ai.module';
import { ContactModule } from './modules/contact/contact.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ChatModule } from './modules/chat/chat.module';
import { SystemModule } from './modules/system/system.module';
import { ShortlinkModule } from './modules/shortlink/shortlink.module';
import { JournalModule } from './modules/journal/journal.module';
import { LetterModule } from './modules/letter/letter.module';
import { MonitorModule } from './modules/monitor/monitor.module';
import { ChatLogsModule } from './modules/chat-logs/chat-logs.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';

// Integration Modules
import { CloudinaryModule } from './modules/integrations/cloudinary/cloudinary.module';
import { CloudflareModule } from './modules/integrations/cloudflare/cloudflare.module';
import { GithubModule } from './modules/integrations/github/github.module';
import { LastFmModule } from './modules/integrations/lastfm/lastfm.module';
import { NewsletterModule } from './modules/integrations/newsletter/newsletter.module';


import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [appConfig, databaseConfig, redisConfig, firebaseConfig],
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('REDIS_HOST') || 'localhost',
        port: parseInt(configService.get<string>('REDIS_PORT') || '6379'),
        ttl: 600, // 10 minutes default
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    CloudinaryModule,
    GalleryModule,
    AlbumModule,
    MediaModule,
    PhotoReactionsModule,
    PrismaModule,
    BlogModule,
    ProjectModule,
    CommentsModule,
    SettingsModule,
    UserModule,
    AiModule,
    ContactModule,
    NotificationsModule,
    CloudflareModule,
    GithubModule,
    ChatModule,
    SystemModule,
    NewsletterModule,
    ShortlinkModule,
    JournalModule,
    LastFmModule,
    LetterModule,
    MonitorModule,
    ChatLogsModule,
    KnowledgeModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule { }
