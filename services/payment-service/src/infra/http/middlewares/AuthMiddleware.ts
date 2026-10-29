import { type FastifyReply, type FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

export interface AuthenticatedPayload {
  userId: string;
  role: 'CUSTOMER' | 'ADMIN';
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthenticatedPayload;
  }
}

export function verifyTokenHeader(authHeader: string | undefined, secret: string): AuthenticatedPayload {
  // O esquema importa: um JWT válido atrás de outro prefixo de 7 caracteres não autentica
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('MISSING_TOKEN');
  }

  // Token vazio, assinatura inválida e expiração são rejeitados pelo próprio verify
  const decoded = jwt.verify(authHeader.slice(7).trim(), secret, { algorithms: ['HS256'] });
  if (typeof decoded !== 'object' || !decoded.userId) {
    throw new Error('INVALID_TOKEN');
  }

  return {
    userId: String(decoded.userId),
    role: decoded.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER',
  };
}

async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
  requiredRole?: 'ADMIN'
): Promise<FastifyReply | void> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Detalhe de configuração vai para o log, nunca para o cliente
    request.log.error('JWT_SECRET is not configured');
    return reply.status(500).send({ error: 'Internal Server Error' });
  }

  let user: AuthenticatedPayload;
  try {
    user = verifyTokenHeader(request.headers.authorization, secret);
  } catch {
    return reply.status(401).send({ error: 'UNAUTHORIZED: Invalid or missing Bearer token' });
  }

  if (requiredRole && user.role !== requiredRole) {
    return reply.status(403).send({ error: 'FORBIDDEN: Admin privileges required' });
  }
  request.authUser = user;
}

// Hooks async que respondem devolvem `reply`, como a documentação do Fastify exige,
// para interromper a cadeia sem depender de comportamento interno do framework.
export const requireAdminAuth = (request: FastifyRequest, reply: FastifyReply) =>
  authenticate(request, reply, 'ADMIN');

export const requireUserAuth = (request: FastifyRequest, reply: FastifyReply) =>
  authenticate(request, reply);
