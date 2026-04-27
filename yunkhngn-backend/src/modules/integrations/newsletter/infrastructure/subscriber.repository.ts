import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { ISubscriberRepository } from '../domain/subscriber.repository.interface';
import { Subscriber } from '../domain/subscriber.entity';

@Injectable()
export class PrismaSubscriberRepository implements ISubscriberRepository {
  constructor(private prisma: PrismaService) {}

  async create(email: string, token: string): Promise<Subscriber> {
    return this.prisma.subscriber.create({
      data: { email, token },
    });
  }

  async findByEmail(email: string): Promise<Subscriber | null> {
    return this.prisma.subscriber.findUnique({
      where: { email },
    });
  }

  async findByToken(token: string): Promise<Subscriber | null> {
    return this.prisma.subscriber.findUnique({
      where: { token },
    });
  }

  async delete(id: string): Promise<Subscriber> {
    return this.prisma.subscriber.delete({
      where: { id },
    });
  }

  async findAll(): Promise<Subscriber[]> {
    return this.prisma.subscriber.findMany();
  }
}
