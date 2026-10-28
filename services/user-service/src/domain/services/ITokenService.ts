import { type UserRole } from '../entities/User.js';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface ITokenService {
  generateToken(payload: TokenPayload): string;
  verifyToken(token: string): TokenPayload;
}
