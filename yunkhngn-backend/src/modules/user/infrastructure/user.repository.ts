import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IUserRepository } from '../domain/user.repository.interface';
import { User } from '../domain/user.entity';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUid(uid: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { uid },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  async create(data: any): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async update(uid: string, data: any): Promise<User> {
    return this.prisma.user.update({
      where: { uid },
      data,
    });
  }

  async delete(uid: string): Promise<User> {
    return this.prisma.user.delete({
      where: { uid },
    });
  }

  async upsert(uid: string, data: any): Promise<User> {
    const { email, name, avatarUrl, role } = data;
    return this.prisma.user.upsert({
      where: { uid },
      update: {
        email,
        name,
        avatarUrl,
      },
      create: {
        uid,
        email,
        name,
        avatarUrl,
        role: role || 'USER',
      },
    });
  }
}
