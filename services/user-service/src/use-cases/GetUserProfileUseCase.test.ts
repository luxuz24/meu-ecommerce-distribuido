import { describe, it, expect } from 'vitest';
import { GetUserProfileUseCase } from './GetUserProfileUseCase.js';
import { User } from '../domain/entities/User.js';
import type { IUserRepository, CreateUserData, CreateOutboxData } from '../domain/repositories/IUserRepository.js';
import { UserNotFoundError } from '../domain/errors/UserNotFoundError.js';

class InMemoryUserRepository implements IUserRepository {
  public users: User[] = [];

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async createWithOutbox(data: CreateUserData, _outbox: CreateOutboxData): Promise<User> {
    const user = new User({
      id: `user-${Date.now()}`,
      name: data.name,
      email: data.email,
      password: data.passwordHash,
      role: data.role ?? 'CUSTOMER',
      createdAt: new Date(),
    });
    this.users.push(user);
    return user;
  }
}

describe('GetUserProfileUseCase', () => {
  it('should return user profile with role and without password when user exists', async () => {
    const userRepository = new InMemoryUserRepository();
    userRepository.users.push(new User({
      id: 'user-uuid-789',
      name: 'João Santos',
      email: 'joao@example.com',
      password: 'hashedpassword',
      role: 'ADMIN',
      createdAt: new Date(),
    }));

    const useCase = new GetUserProfileUseCase(userRepository);
    const result = await useCase.execute('user-uuid-789');

    expect(result).toEqual({
      id: 'user-uuid-789',
      name: 'João Santos',
      email: 'joao@example.com',
      role: 'ADMIN',
    });
    expect((result as any).password).toBeUndefined();
  });

  it('should throw UserNotFoundError when user does not exist', async () => {
    const userRepository = new InMemoryUserRepository();
    const useCase = new GetUserProfileUseCase(userRepository);

    await expect(useCase.execute('non-existent-id'))
      .rejects.toBeInstanceOf(UserNotFoundError);
  });
});
