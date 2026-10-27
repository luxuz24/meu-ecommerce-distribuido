import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginUserUseCase } from './LoginUseCase.js';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

describe('LoginUserUseCase', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test_secret_key_123456789';
  });

  it('should authenticate user and return tokenJwt with user data', async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    const mockUser = {
      id: 'user-uuid-456',
      name: 'Maria Silva',
      email: 'maria@example.com',
      password: hashedPassword,
    };

    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
      },
    } as unknown as PrismaClient;

    const useCase = new LoginUserUseCase(mockPrisma);
    const result = await useCase.execute({
      email: 'maria@example.com',
      password: 'password123',
    });

    expect(result.tokenJwt).toBeDefined();
    expect(typeof result.tokenJwt).toBe('string');
    expect(result.user).toEqual({
      id: 'user-uuid-456',
      name: 'Maria Silva',
      email: 'maria@example.com',
    });
  });

  it('should throw INVALID_CREDENTIALS! when user is not found', async () => {
    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaClient;

    const useCase = new LoginUserUseCase(mockPrisma);

    await expect(useCase.execute({ email: 'notfound@example.com', password: 'password123' }))
      .rejects.toThrow('INVALID_CREDENTIALS!');
  });

  it('should throw INVALID_CREDENTIALS! when password is wrong', async () => {
    const hashedPassword = await bcrypt.hash('correctpassword', 10);
    const mockUser = {
      id: 'user-uuid-456',
      name: 'Maria Silva',
      email: 'maria@example.com',
      password: hashedPassword,
    };

    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
      },
    } as unknown as PrismaClient;

    const useCase = new LoginUserUseCase(mockPrisma);

    await expect(useCase.execute({ email: 'maria@example.com', password: 'wrongpassword' }))
      .rejects.toThrow('INVALID_CREDENTIALS!');
  });
});
