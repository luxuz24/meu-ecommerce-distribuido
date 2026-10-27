import { type User } from '../entities/User.js';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
}

export interface CreateOutboxData {
  aggregateType: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  createWithOutbox(data: CreateUserData, outbox: CreateOutboxData): Promise<User>;
}
