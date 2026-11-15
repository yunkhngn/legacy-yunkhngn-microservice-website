import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import * as si from 'systeminformation';

type Snapshot = {
  cpu: si.Systeminformation.CpuData | null;
  mem: si.Systeminformation.MemData | null;
  osInfo: si.Systeminformation.OsData | null;
  currentLoad: si.Systeminformation.CurrentLoadData | null;
  fsSize: si.Systeminformation.FsSizeData[];
  time: ReturnType<typeof si.time> | null;
};

const DYNAMIC_INTERVAL_MS = 10_000;
const FS_INTERVAL_MS = 60_000;

@Injectable()
export class SystemService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemService.name);

  private snapshot: Snapshot = {
    cpu: null,
    mem: null,
    osInfo: null,
    currentLoad: null,
    fsSize: [],
    time: null,
  };

  private dynamicTimer: NodeJS.Timeout | null = null;
  private fsTimer: NodeJS.Timeout | null = null;
  private samplingDynamic = false;
  private samplingFs = false;
  private lastFsSampleAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Static info: only sample once at startup. CPU model and OS info don't
    // change at runtime, so there's no reason to re-query them.
    try {
      const [cpu, osInfo] = await Promise.all([si.cpu(), si.osInfo()]);
      this.snapshot.cpu = cpu;
      this.snapshot.osInfo = osInfo;
    } catch (err) {
      this.logger.error('Failed to sample static system info', err as Error);
    }

    // Prime dynamic snapshot once so the first request after boot has data.
    await this.sampleDynamic();
    await this.sampleFs();

    this.dynamicTimer = setInterval(
      () => void this.sampleDynamic(),
      DYNAMIC_INTERVAL_MS,
    );
    this.fsTimer = setInterval(
      () => void this.sampleFs(),
      FS_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.dynamicTimer) clearInterval(this.dynamicTimer);
    if (this.fsTimer) clearInterval(this.fsTimer);
  }

  private async sampleDynamic() {
    if (this.samplingDynamic) return;
    this.samplingDynamic = true;
    try {
      const [mem, currentLoad] = await Promise.all([
        si.mem(),
        si.currentLoad(),
      ]);
      this.snapshot.mem = mem;
      this.snapshot.currentLoad = currentLoad;
      this.snapshot.time = si.time();
    } catch (err) {
      this.logger.warn(
        `Dynamic system sample failed: ${(err as Error).message}`,
      );
    } finally {
      this.samplingDynamic = false;
    }
  }

  private async sampleFs() {
    if (this.samplingFs) return;
    this.samplingFs = true;
    try {
      this.snapshot.fsSize = await si.fsSize();
      this.lastFsSampleAt = Date.now();
    } catch (err) {
      this.logger.warn(`fsSize sample failed: ${(err as Error).message}`);
    } finally {
      this.samplingFs = false;
    }
  }

  getStats() {
    return {
      cpu: this.snapshot.cpu,
      mem: this.snapshot.mem,
      osInfo: this.snapshot.osInfo,
      currentLoad: this.snapshot.currentLoad,
      fsSize: this.snapshot.fsSize,
      time: this.snapshot.time ?? si.time(),
    };
  }

  async getDashboardStats() {
    try {
      const [
        blogsCount,
        blogsPublishedCount,
        projectsCount,
        galleryCount,
        commentsCount,
        contactsCount,
        contactsRespondedCount,
        recentBlogs,
        recentProjects,
        recentPhotos,
        recentContacts,
      ] = await Promise.all([
        this.prisma.blog.count(),
        this.prisma.blog.count({ where: { status: 'PUBLISHED' } }),
        this.prisma.project.count(),
        this.prisma.gallery.count(),
        this.prisma.comment.count({ where: { hidden: false, deleted: false } }),
        this.prisma.contact.count(),
        this.prisma.contact.count({
          where: {
            OR: [{ status: 'responded' }, { adminResponse: { not: null } }],
          },
        }),
        this.prisma.blog.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            createdAt: true,
            thumbnail: true,
          },
        }),
        this.prisma.project.findMany({
          take: 8,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            slug: true,
            cover: true,
            createdAt: true,
          },
        }),
        this.prisma.gallery.findMany({
          take: 12,
          orderBy: { createdAt: 'desc' },
          select: { id: true, imageUrl: true, caption: true, createdAt: true },
        }),
        this.prisma.contact.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const stats = {
        blogs: blogsCount,
        blogsDraft: blogsCount - blogsPublishedCount,
        blogsPublished: blogsPublishedCount,
        projects: projectsCount,
        gallery: galleryCount,
        comments: commentsCount,
        mailTotal: contactsCount,
        mailReceived: contactsCount,
        mailSent: contactsRespondedCount,
      };

      return {
        stats,
        recentBlogs,
        recentProjects,
        recentPhotos,
        recentContacts,
      };
    } catch (error) {
      console.error('Error calculating dashboard stats:', error);
      throw error;
    }
  }
}
