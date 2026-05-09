import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import * as si from 'systeminformation';

@Injectable()
export class SystemService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    try {
      const [cpu, mem, osInfo, currentLoad, fsSize] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.osInfo(),
        si.currentLoad(),
        si.fsSize(),
      ]);

      const time = si.time();

      return {
        cpu,
        mem,
        osInfo,
        currentLoad,
        fsSize,
        time,
      };
    } catch (error) {
      console.error('Error fetching system stats:', error);
      throw error;
    }
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
