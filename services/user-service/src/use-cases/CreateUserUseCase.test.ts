import { describe, it, expect } from 'vitest';
import { EnsureAdminUserUseCase } from './EnsureAdminUserUseCase.js';
import { CreateUserUseCase } from './CreateUserUseCase.js';
import { User } from '../domain/entities/User.js';
import type { IUserRepository, CreateUserData, CreateOutboxData } from '../domain/repositories/IUserRepository.js';
import type { IPasswordHasher } from '../domain/services/IPasswordHasher.js';
import { UserAlreadyExistsError } from '../domain/errors/UserAlreadyExistsError.js';

class InMemoryUserRepository implements IUserRepository {
  public users: User[] = [];
  public outboxEvents: CreateOutboxData[] = [];

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async createWithOutbox(data: CreateUserData, outbox: CreateOutboxData): Promise<User> {
    const user = new User({
      id: `user-${Date.now()}`,
      name: data.name,
      email: data.email,
      password: data.passwordHash,
      role: data.role ?? 'CUSTOMER',
      createdAt: new Date(),
    });
    this.users.push(user);
    this.outboxEvents.push(outbox);
    return user;
  }
}

class FakePasswordHasher implements IPasswordHasher {
  async hash(plainText: string): Promise<string> {
    return `hashed_${plainText}`;
  }

  async compare(plainText: string, hash: string): Promise<boolean> {
    return `hashed_${plainText}` === hash;
  }
}

describe('CreateUserUseCase', () => {
  it('should create a new user with default CUSTOMER role and generate outbox event', async () => {
    const userRepository = new InMemoryUserRepository();
    const passwordHasher = new FakePasswordHasher();
    const useCase = new CreateUserUseCase(userRepository, passwordHasher);

    const result = await useCase.execute('Lucas Ortiz', 'lucas@example.com', 'password123');

    expect(result.id).toBeDefined();
    expect(result.name).toBe('Lucas Ortiz');
    expect(result.email).toBe('lucas@example.com');
    expect(result.role).toBe('CUSTOMER');
    expect(result).not.toHaveProperty('password');

    expect(userRepository.users).toHaveLength(1);
    expect(userRepository.outboxEvents).toHaveLength(1);
    expect(userRepository.outboxEvents[0]?.eventType).toBe('USER_CREATED');
  });

  it('should create an ADMIN user when role ADMIN is passed', async () => {
    const userRepository = new InMemoryUserRepository();
    const passwordHasher = new FakePasswordHasher();
    const useCase = new CreateUserUseCase(userRepository, passwordHasher);

    const result = await useCase.execute('Admin User', 'admin@example.com', 'password123', 'ADMIN');

    expect(result.role).toBe('ADMIN');
  });

  it('should throw UserAlreadyExistsError when email is already registered', async () => {
    const userRepository = new InMemoryUserRepository();
    const passwordHasher = new FakePasswordHasher();
    const useCase = new CreateUserUseCase(userRepository, passwordHasher);

    await useCase.execute('Lucas Ortiz', 'lucas@example.com', 'password123');

    await expect(useCase.execute('Lucas Ortiz', 'lucas@example.com', 'password123'))
      .rejects.toBeInstanceOf(UserAlreadyExistsError);
  });
});

describe('EnsureAdminUserUseCase', () => {
  it('should provision the ADMIN once and be idempotent on later boots', async () => {
    const userRepository = new InMemoryUserRepository();
    const createUser = new CreateUserUseCase(userRepository, new FakePasswordHasher());
    const ensureAdmin = new EnsureAdminUserUseCase(userRepository, createUser);

    expect(await ensureAdmin.execute('admin@demo.com', 'Secret123!')).toBe('created');
    expect(await ensureAdmin.execute('admin@demo.com', 'Secret123!')).toBe('exists');

    const admin = await userRepository.findByEmail('admin@demo.com');
    expect(admin?.role).toBe('ADMIN');
  });

  it('should never promote an existing CUSTOMER account', async () => {
    const userRepository = new InMemoryUserRepository();
    const createUser = new CreateUserUseCase(userRepository, new FakePasswordHasher());
    await createUser.execute('Squatter', 'admin@demo.com', 'Pass123!');

    const result = await new EnsureAdminUserUseCase(userRepository, createUser).execute(
      'admin@demo.com',
      'Secret123!'
    );

    expect(result).toBe('exists');
    expect((await userRepository.findByEmail('admin@demo.com'))?.role).toBe('CUSTOMER');
  });
});
