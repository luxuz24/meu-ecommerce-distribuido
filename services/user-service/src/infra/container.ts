import { prisma } from './database/prisma.js';
import { PrismaUserRepository } from './database/repositories/PrismaUserRepository.js';
import { BcryptPasswordHasher } from './security/BcryptPasswordHasher.js';
import { JwtTokenService } from './security/JwtTokenService.js';
import { CreateUserUseCase } from '../use-cases/CreateUserUseCase.js';
import { LoginUserUseCase } from '../use-cases/LoginUseCase.js';
import { GetUserProfileUseCase } from '../use-cases/GetUserProfileUseCase.js';
import { EnsureAdminUserUseCase } from '../use-cases/EnsureAdminUserUseCase.js';

// Repositories & Services
export const userRepository = new PrismaUserRepository(prisma);
export const passwordHasher = new BcryptPasswordHasher();
export const tokenService = new JwtTokenService();

// Use Cases
export const createUserUseCase = new CreateUserUseCase(userRepository, passwordHasher);
export const loginUserUseCase = new LoginUserUseCase(userRepository, passwordHasher, tokenService);
export const getUserProfileUseCase = new GetUserProfileUseCase(userRepository);
export const ensureAdminUserUseCase = new EnsureAdminUserUseCase(userRepository, createUserUseCase);
