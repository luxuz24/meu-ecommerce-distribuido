import { type FastifyReply, type FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN';
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthenticatedUser;
  }
}

export function verifyOrderJwt(authHeader: string | undefined, secret: string): AuthenticatedUser {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('MISSING_TOKEN');
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new Error('MISSING_TOKEN');
  }

  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  if (!decoded || typeof decoded !== 'object' || !decoded.userId) {
    throw new Error('INVALID_TOKEN');
  }

  return {
    userId: String(decoded.userId),
    email: String(decoded.email ?? ''),
    role: decoded.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER',
  };
}

export async function requireUserAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    reply.status(500).send({ error: 'CRITICAL: JWT_SECRET not configured' });
    return;
  }

  try {
    request.authUser = verifyOrderJwt(request.headers.authorization, secret);
  } catch {
    reply.status(401).send({ error: 'UNAUTHORIZED: Invalid or missing Bearer token' });
  }
}
