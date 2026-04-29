import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BlogService } from '../modules/blog/blog.service';
import { ProjectService } from '../modules/project/project.service';
import { SettingsService } from '../modules/settings/settings.service';
import { AiService } from '../modules/ai/ai.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('SyncRAG');
  logger.log('Starting RAG synchronization...');

  const app = await NestFactory.createApplicationContext(AppModule);

  const blogService = app.get(BlogService);
  const projectService = app.get(ProjectService);
  const settingsService = app.get(SettingsService);
  const aiService = app.get(AiService);

  try {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 1. Sync Settings
    logger.log('Syncing Settings...');
    const settingsToSync = ['about_content', 'skills', 'experience', 'education', 'bio'];
    for (const key of settingsToSync) {
      const content = await settingsService.getDecryptedSetting(key);
      if (content) {
        await aiService.syncDocument('setting', key, content, { title: key });
        logger.log(`Synced setting: ${key}`);
        await delay(2000); // 2 second delay
      }
    }

    // 2. Sync Blogs
    logger.log('Syncing Blogs...');
    const blogs = await blogService.findAll();
    for (const blog of blogs) {
      if (blog.status === 'published') {
        const fullContent = `${blog.title}\n\n${blog.contentJSON || ''}`;
        await aiService.syncDocument('blog', blog.id.toString(), fullContent, {
          title: blog.title,
          tags: blog.tags || '',
        });
        logger.log(`Synced blog: ${blog.title}`);
        await delay(2000); // 2 second delay
      }
    }

    // 3. Sync Projects
    logger.log('Syncing Projects...');
    const projects = await projectService.findAll();
    for (const project of projects) {
      const fullContent = `${project.title}\n\n${project.description || ''}\n\n${project.contentJSON || ''}`;
      await aiService.syncDocument('project', project.id.toString(), fullContent, {
        title: project.title,
        description: project.description || '',
        techStack: project.techStack || '',
      });
      logger.log(`Synced project: ${project.title}`);
      await delay(2000); // 2 second delay
    }

    logger.log('RAG Synchronization completed successfully!');
  } catch (error) {
    logger.error('Error during synchronization:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
