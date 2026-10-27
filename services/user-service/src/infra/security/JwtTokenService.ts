import jwt from 'jsonwebtoken';
import { type ITokenService, type TokenPayload } from '../../domain/services/ITokenService.js';

export class JwtTokenService implements ITokenService {
  private readonly secretKey: string;

  constructor(secretKey?: string) {
    const key = secretKey ?? process.env.JWT_SECRET;
    if (!key) {
      throw new Error('CRITICAL: variable JWT_SECRET is not defined in the .env file');
    }
    this.secretKey = key;
  }

  generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secretKey, {
      expiresIn: '1h',
      algorithm: 'HS256',
    });
  }

  verifyToken(token: string): TokenPayload {
    return jwt.verify(token, this.secretKey, {
      algorithms: ['HS256'],
    }) as TokenPayload;
  }
}
