import { PrismaClient } from '@prisma/client';

export class GetUserProfileUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(userId: string) {
    
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }
}