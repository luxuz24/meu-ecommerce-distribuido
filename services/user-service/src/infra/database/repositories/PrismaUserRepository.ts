import { type PrismaClient } from '@prisma/client';
import { User } from '../../../domain/entities/User.js';
import { type IUserRepository, type CreateUserData, type CreateOutboxData } from '../../../domain/repositories/IUserRepository.js';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { email } });
    if (!raw) return null;
    return new User(raw);
  }

  async findById(id: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { id } });
    if (!raw) return null;
    return new User(raw);
  }

  async createWithOutbox(data: CreateUserData, outbox: CreateOutboxData): Promise<User> {
    const createdUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: data.passwordHash,
          role: data.role ?? 'CUSTOMER',
        },
      });

      await tx.outbox.create({
        data: {
          aggregateType: outbox.aggregateType,
          aggregateId: user.id,
          eventType: outbox.eventType,
          payload: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            ...outbox.payload,
          },
        },
      });

      return user;
    });

    return new User(createdUser);
  }
}
