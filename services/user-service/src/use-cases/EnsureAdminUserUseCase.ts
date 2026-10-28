import { type IUserRepository } from '../domain/repositories/IUserRepository.js';
import { type CreateUserUseCase } from './CreateUserUseCase.js';

/**
 * Único caminho para existir um ADMIN: provisionado pelo próprio servidor a partir de
 * configuração (ADMIN_EMAIL / ADMIN_PASSWORD), nunca pelo cadastro público.
 * Idempotente: se o e-mail já existe, não altera nada.
 */
export class EnsureAdminUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly createUserUseCase: CreateUserUseCase
  ) {}

  async execute(email: string, password: string, name = 'Administrador'): Promise<'created' | 'exists'> {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) return 'exists';

    await this.createUserUseCase.execute(name, email, password, 'ADMIN');
    return 'created';
  }
}
