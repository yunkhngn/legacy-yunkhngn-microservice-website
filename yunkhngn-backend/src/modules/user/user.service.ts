import { Injectable, Inject, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IUserRepository } from './domain/user.repository.interface';
import { User } from './domain/user.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @Inject(IUserRepository) private readonly userRepository: IUserRepository,
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
    return this.userRepository.create({
      uid: userRecord.uid,
      email,
      name,
      role,
    });
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
    return this.userRepository.update(uid, {
      name: data.name,
      role: data.role,
    });
  }

  async delete(uid: string): Promise<User> {
    this.logger.log(`Deleting user: ${uid}`);

    // 1. Delete from Firebase Auth
    await admin.auth().deleteUser(uid);

    // 2. Delete from DB
    return this.userRepository.delete(uid);
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
