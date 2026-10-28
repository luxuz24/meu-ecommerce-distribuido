import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

export interface CatalogTokenPayload {
  userId: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN';
}

export function verifyCatalogJwt(
  token: string,
  secretKey?: string
): CatalogTokenPayload {
  const key = secretKey ?? process.env.JWT_SECRET;
  if (!key) {
    throw new Error(
      'CRITICAL: variable JWT_SECRET is not defined in the .env file'
    );
  }
  return jwt.verify(token, key, {
    algorithms: ['HS256'],
  }) as CatalogTokenPayload;
}

export async function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return reply.status(401).send({ error: 'Token not provided' });
  }

  const [, token] = authHeader.split(' ');
  if (!token) {
    return reply.status(401).send({ error: 'Token not provided' });
  }

  try {
    const decoded = verifyCatalogJwt(token);
    if (decoded.role !== 'ADMIN') {
      return reply
        .status(403)
        .send({ error: 'Forbidden: ADMIN role required for catalog mutations' });
    }
    (request as FastifyRequest & { user?: CatalogTokenPayload }).user = decoded;
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}
