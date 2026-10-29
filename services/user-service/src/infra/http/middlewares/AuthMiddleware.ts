import type { FastifyReply, FastifyRequest } from "fastify";
import { tokenService } from "../../container.js";
import type { TokenPayload } from "../../../domain/services/ITokenService.js";

declare module "fastify" {
    interface FastifyRequest {
        user?: TokenPayload;
    }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
        return reply.status(401).send({ error: 'Token not provided' });
    }
    const [, token] = authHeader.split(' ');
    if (!token) {
        return reply.status(401).send({ error: 'Token not provided' });
    }
    try {
        const decoded = tokenService.verifyToken(token);
        request.user = decoded;
    } catch {
        return reply.status(401).send({ error: 'Invalid or expired token' });
    }
}
