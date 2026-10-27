import type { FastifyReply, FastifyRequest } from "fastify";
import { tokenService } from "../../container.js";

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
        (request as any).user = decoded;
    } catch (error) {
        return reply.status(401).send({ error: 'Invalid or expired token' });
    }
}
