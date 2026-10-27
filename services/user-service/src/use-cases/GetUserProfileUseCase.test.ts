import { describe, it, expect, vi } from 'vitest';
import { GetUserProfileUseCase } from './GetUserProfileUseCase.js';
import type { PrismaClient } from '@prisma/client';

describe('GetUserProfileUseCase', () => {
  it('should return user profile without password when user exists', async () => {
    const mockUser = {
      id: 'user-uuid-789',
      name: 'João Santos',
      email: 'joao@example.com',
      password: 'hashedpassword',
    };

    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
      },
    } as unknown as PrismaClient;

    const useCase = new GetUserProfileUseCase(mockPrisma);
    const result = await useCase.execute('user-uuid-789');

    expect(result).toEqual({
      id: 'user-uuid-789',
      name: 'João Santos',
      email: 'joao@example.com',
    });
    expect((result as any).password).toBeUndefined();
  });

  it('should throw USER_NOT_FOUND when user does not exist', async () => {
    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaClient;

    const useCase = new GetUserProfileUseCase(mockPrisma);

    await expect(useCase.execute('non-existent-id'))
      .rejects.toThrow('USER_NOT_FOUND');
  });
});
