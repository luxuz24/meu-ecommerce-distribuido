import { type UserRole } from '../domain/entities/User.js';
import { type IUserRepository } from '../domain/repositories/IUserRepository.js';
import { UserNotFoundError } from '../domain/errors/UserNotFoundError.js';

export interface UserProfileResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export class GetUserProfileUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string): Promise<UserProfileResponse> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
