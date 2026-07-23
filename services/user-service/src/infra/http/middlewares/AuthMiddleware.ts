import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply){

    const authHeader = request.headers.authorization;
    if(!authHeader){
        return reply.status(401).send({error: 'Token not provided'});
    }
    const [, token] = authHeader.split(' ');
    try{
        const secret = process.env.JWT_SECRET;
        if(!secret){
            throw new Error('JWT_SECRET is missing!');
        }
        const decoded = jwt.verify(token, secret);
        (request as any).user = decoded;

    } catch(error){
        return reply.status(401).send({error: 'Invalid or expired token'});
    }
}