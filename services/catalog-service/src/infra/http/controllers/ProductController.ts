import { type FastifyReply, type FastifyRequest } from "fastify";
import { CreateProductUseCase, type CreateProductDTO } from "../../../use-cases/CreateProductUseCase.js";
import { MongoProductRepository } from "../../database/repositories/MongoProductRepository.js";

export class ProductController {
    async create(request: FastifyRequest, reply: FastifyReply) {
        try {
            const data = request.body as CreateProductDTO;
            const productRepository = new MongoProductRepository();
            const useCase = new CreateProductUseCase(productRepository);
            
            const product = await useCase.execute(data);
            return reply.status(201).send(product);

        } catch (error: any) {
            
            if (error.message.includes("already exists")) {
                return reply.status(400).send({ error: error.message });
            }
            
            
            if (error.message.includes("non-negative values")) {
                return reply.status(400).send({ error: error.message });
            }

            
            request.log.error(error); 
            return reply.status(500).send({ error: "Internal Server Error" });
        }
    }
}
