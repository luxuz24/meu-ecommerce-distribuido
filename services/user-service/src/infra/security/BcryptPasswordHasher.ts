import bcrypt from 'bcrypt';
import { type IPasswordHasher } from '../../domain/services/IPasswordHasher.js';

export class BcryptPasswordHasher implements IPasswordHasher {
  constructor(private readonly saltRounds = 10) {}

  async hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, this.saltRounds);
  }

  async compare(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }
}
