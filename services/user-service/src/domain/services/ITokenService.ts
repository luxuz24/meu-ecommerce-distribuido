export interface TokenPayload {
  userId: string;
  email: string;
}

export interface ITokenService {
  generateToken(payload: TokenPayload): string;
  verifyToken(token: string): TokenPayload;
}
