import { Injectable, Inject, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IUserRepository } from './domain/user.repository.interface';
import { User } from './domain/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditEntity } from '../audit-logs/domain/audit-log.types';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @Inject(IUserRepository) private readonly userRepository: IUserRepository,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findByUid(uid: string): Promise<User | null> {
    return this.userRepository.findByUid(uid);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  async create(
    email: string,
    password?: string,
    name?: string,
    role: string = 'ADMIN',
  ): Promise<User> {
    this.logger.log(`Creating user in Firebase and DB: ${email}`);

    // 1. Create in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // 2. Create in DB
    const result = await this.userRepository.create({
      uid: userRecord.uid,
      email,
      name,
      role,
    });

    void this.auditLogsService.log({
      action: AuditAction.CREATE_USER,
      entity: AuditEntity.USER,
      entityId: userRecord.uid,
      details: { email, name, role },
    });

    return result;
  }

  async update(
    uid: string,
    data: { name?: string; role?: string; password?: string },
  ): Promise<User> {
    this.logger.log(`Updating user: ${uid}`);

    // 1. Update Firebase Auth (if password or name changed)
    if (data.password || data.name) {
      await admin.auth().updateUser(uid, {
        password: data.password,
        displayName: data.name,
      });
    }

    // 2. Update DB
    const result = await this.userRepository.update(uid, {
      name: data.name,
      role: data.role,
    });

    void this.auditLogsService.log({
      action: AuditAction.UPDATE_USER,
      entity: AuditEntity.USER,
      entityId: uid,
      details: { name: data.name, role: data.role, passwordUpdated: !!data.password },
    });

    return result;
  }

  async delete(uid: string): Promise<User> {
    this.logger.log(`Deleting user: ${uid}`);

    // 1. Delete from Firebase Auth
    await admin.auth().deleteUser(uid);

    // 2. Delete from DB
    const result = await this.userRepository.delete(uid);

    void this.auditLogsService.log({
      action: AuditAction.DELETE_USER,
      entity: AuditEntity.USER,
      entityId: uid,
      details: { uid },
    });

    return result;
  }

  async createOrUpdate(
    uid: string,
    email: string,
    avatarUrl?: string,
    name?: string,
  ): Promise<User> {
    const userEmail = email || `anonymous-${uid}@yunkhngn.local`;

    return this.userRepository.upsert(uid, {
      email: userEmail,
      avatarUrl,
      name,
      role: 'USER',
    });
  }
}
