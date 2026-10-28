import { type UserRole } from '../domain/entities/User.js';
import { type IUserRepository } from '../domain/repositories/IUserRepository.js';
import { type IPasswordHasher } from '../domain/services/IPasswordHasher.js';
import { UserAlreadyExistsError } from '../domain/errors/UserAlreadyExistsError.js';

export interface CreateUserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(
    name: string,
    email: string,
    passwordPlain: string,
    role: UserRole = 'CUSTOMER'
  ): Promise<CreateUserResponse> {
    const userExists = await this.userRepository.findByEmail(email);

    if (userExists) {
      throw new UserAlreadyExistsError(email);
    }

    const hashedPassword = await this.passwordHasher.hash(passwordPlain);

    const user = await this.userRepository.createWithOutbox(
      {
        name,
        email,
        passwordHash: hashedPassword,
        role,
      },
      {
        aggregateType: 'User',
        eventType: 'USER_CREATED',
        payload: {
          name,
          email,
          role,
        },
      }
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
