import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { IContactRepository } from '../domain/contact.repository.interface';
import { Contact } from '../domain/contact.entity';

@Injectable()
export class PrismaContactRepository implements IContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any): Promise<Contact> {
    return this.prisma.contact.create({
      data,
    });
  }

  async findAll(): Promise<Contact[]> {
    return this.prisma.contact.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Contact | null> {
    return this.prisma.contact.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: any): Promise<Contact> {
    return this.prisma.contact.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Contact> {
    return this.prisma.contact.delete({
      where: { id },
    });
  }
}
