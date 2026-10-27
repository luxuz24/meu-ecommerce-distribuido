import { describe, it, expect } from 'vitest';
import { LoginUserUseCase } from './LoginUseCase.js';
import { User } from '../domain/entities/User.js';
import type { IUserRepository, CreateUserData, CreateOutboxData } from '../domain/repositories/IUserRepository.js';
import type { IPasswordHasher } from '../domain/services/IPasswordHasher.js';
import type { ITokenService, TokenPayload } from '../domain/services/ITokenService.js';
import { InvalidCredentialsError } from '../domain/errors/InvalidCredentialsError.js';

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
      createdAt: new Date(),
    });
    this.users.push(user);
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

class FakeTokenService implements ITokenService {
  generateToken(payload: TokenPayload): string {
    return `mock_token_for_${payload.userId}`;
  }

  verifyToken(token: string): TokenPayload {
    return {
      userId: token.replace('mock_token_for_', ''),
      email: 'test@example.com',
    };
  }
}

describe('LoginUserUseCase', () => {
  it('should authenticate user and return tokenJwt with user data', async () => {
    const userRepository = new InMemoryUserRepository();
    const passwordHasher = new FakePasswordHasher();
    const tokenService = new FakeTokenService();

    const hashedPassword = await passwordHasher.hash('password123');
    userRepository.users.push(new User({
      id: 'user-uuid-456',
      name: 'Maria Silva',
      email: 'maria@example.com',
      password: hashedPassword,
      createdAt: new Date(),
    }));

    const useCase = new LoginUserUseCase(userRepository, passwordHasher, tokenService);
    const result = await useCase.execute({
      email: 'maria@example.com',
      password: 'password123',
    });

    expect(result.tokenJwt).toBe('mock_token_for_user-uuid-456');
    expect(result.user).toEqual({
      id: 'user-uuid-456',
      name: 'Maria Silva',
      email: 'maria@example.com',
    });
  });

  it('should throw InvalidCredentialsError when user is not found', async () => {
    const userRepository = new InMemoryUserRepository();
    const passwordHasher = new FakePasswordHasher();
    const tokenService = new FakeTokenService();

    const useCase = new LoginUserUseCase(userRepository, passwordHasher, tokenService);

    await expect(useCase.execute({ email: 'notfound@example.com', password: 'password123' }))
      .rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('should throw InvalidCredentialsError when password is wrong', async () => {
    const userRepository = new InMemoryUserRepository();
    const passwordHasher = new FakePasswordHasher();
    const tokenService = new FakeTokenService();

    const hashedPassword = await passwordHasher.hash('correctpassword');
    userRepository.users.push(new User({
      id: 'user-uuid-456',
      name: 'Maria Silva',
      email: 'maria@example.com',
      password: hashedPassword,
      createdAt: new Date(),
    }));

    const useCase = new LoginUserUseCase(userRepository, passwordHasher, tokenService);

    await expect(useCase.execute({ email: 'maria@example.com', password: 'wrongpassword' }))
      .rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
