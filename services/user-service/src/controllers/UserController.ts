import { FastifyInstance,FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import pg from 'pg';
import { PrismaPg } from "@prisma/adapter-pg";
//
import { LoginUserUseCase } from "../useCases/LoginUseCase.js";
import { CreateUserUseCase } from "../useCases/CreateUserUseCase.js";
import { error } from "console";


const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({adapter});
const createUserUseCase = new CreateUserUseCase(prisma);
const loginUserUseCase = new LoginUserUseCase(prisma);

export async function userRoutes(app: FastifyInstance) {
  app.post(
    '/users',
    {
      
      schema: {
        body: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', minLength: 2 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
          },
        },
        
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
        const {name, email, password} = request.body as any;
        try {
            const user = await createUserUseCase.execute(name, email, password);
            return reply.status(201).send(user);
        }catch(error:any){
            if(error.message === 'USER_ALREADY_EXISTS'){
                return reply.status(400).send({error: 'User with this email already exists'});
            }
            request.log.error(error);
            return reply.status(500).send({error: 'Internal Server Error'});
        }
         
    }
  );

  app.post('/login',async (request: FastifyRequest, reply: FastifyReply) => {
    try{
      const data = request.body as any;
      const result = await loginUserUseCase.execute(data);
      return reply.status(200).send(result);
    }catch(error:any){
      if(error.message === 'INVALID_CREDENTIALS!'){
        return reply.status(401).send({error: 'INVALID_CREDENTIALS!'});
      }
    } console.error(error);
    return reply.status(500).send({error: 'Internal Server Error'});

  })
  
}