import { describe, it, expect, vi } from 'vitest';
import { CreateUserUseCase } from './CreateUserUseCase.js';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

describe('CreateUserUseCase', () => {
  it('should create a new user and generate outbox event', async () => {
    const mockUser = {
      id: 'user-uuid-123',
      name: 'Lucas Ortiz',
      email: 'lucas@example.com',
      password: 'hashedpassword',
      createdAt: new Date(),
    };

    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(mockUser),
      },
      outbox: {
        create: vi.fn().mockResolvedValue({ id: 'outbox-123' }),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    } as unknown as PrismaClient;

    const useCase = new CreateUserUseCase(mockPrisma);
    const result = await useCase.execute('Lucas Ortiz', 'lucas@example.com', 'password123');

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'lucas@example.com' },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'user-uuid-123',
      name: 'Lucas Ortiz',
      email: 'lucas@example.com',
      createdAt: mockUser.createdAt,
    });
    expect((result as any).password).toBeUndefined();
  });

  it('should throw USER_ALREADY_EXISTS when email is already registered', async () => {
    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'existing-id', email: 'lucas@example.com' }),
      },
    } as unknown as PrismaClient;

    const useCase = new CreateUserUseCase(mockPrisma);

    await expect(useCase.execute('Lucas Ortiz', 'lucas@example.com', 'password123'))
      .rejects.toThrow('USER_ALREADY_EXISTS');
  });
});
