import { type UserRole } from '../domain/entities/User.js';
import { type IUserRepository } from '../domain/repositories/IUserRepository.js';
import { type IPasswordHasher } from '../domain/services/IPasswordHasher.js';
import { type ITokenService } from '../domain/services/ITokenService.js';
import { InvalidCredentialsError } from '../domain/errors/InvalidCredentialsError.js';

export interface LoginUserDTO {
  email: string;
  password: string;
}

export interface LoginUserResponse {
  tokenJwt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService
  ) {}

  async execute(data: LoginUserDTO): Promise<LoginUserResponse> {
    const user = await this.userRepository.findByEmail(data.email);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await this.passwordHasher.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    const tokenJwt = this.tokenService.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      tokenJwt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
