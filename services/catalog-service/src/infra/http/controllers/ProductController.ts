import { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  type CreateProductDTO,
  type UpdateProductDTO,
  type ListProductsParams,
} from '../../../domain/repositories/IProductRepository.js';
import { type CreateProductUseCase } from '../../../use-cases/CreateProductUseCase.js';
import { type ListProductsUseCase } from '../../../use-cases/ListProductsUseCase.js';
import { type GetProductByIdUseCase } from '../../../use-cases/GetProductByIdUseCase.js';
import { type UpdateProductUseCase } from '../../../use-cases/UpdateProductUseCase.js';
import { type DeleteProductUseCase } from '../../../use-cases/DeleteProductUseCase.js';
import { ProductAlreadyExistsError } from '../../../domain/errors/ProductAlreadyExistsError.js';
import { InvalidProductDataError } from '../../../domain/errors/InvalidProductDataError.js';
import { ProductNotFoundError } from '../../../domain/errors/ProductNotFoundError.js';

export class ProductController {
  constructor(
    private readonly createProductUseCase: CreateProductUseCase,
    private readonly listProductsUseCase: ListProductsUseCase,
    private readonly getProductByIdUseCase: GetProductByIdUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly deleteProductUseCase: DeleteProductUseCase
  ) {}

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = request.body as CreateProductDTO;
      const product = await this.createProductUseCase.execute(data);
      return reply.status(201).send(product);
    } catch (error: unknown) {
      if (error instanceof ProductAlreadyExistsError || error instanceof InvalidProductDataError) {
        return reply.status(400).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as {
        page?: number | undefined;
        limit?: number | undefined;
        q?: string | undefined;
        active?: boolean | undefined;
      };
      const params: ListProductsParams = {
        page: query.page,
        limit: query.limit,
        q: query.q,
        active: query.active,
      };
      const result = await this.listProductsUseCase.execute(params);
      return reply.status(200).send(result);
    } catch (error: unknown) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const product = await this.getProductByIdUseCase.execute(id);
      return reply.status(200).send(product);
    } catch (error: unknown) {
      if (error instanceof ProductNotFoundError) {
        return reply.status(404).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as UpdateProductDTO;
      const product = await this.updateProductUseCase.execute(id, data);
      return reply.status(200).send(product);
    } catch (error: unknown) {
      if (error instanceof ProductNotFoundError) {
        return reply.status(404).send({ error: error.message });
      }
      if (error instanceof InvalidProductDataError) {
        return reply.status(400).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await this.deleteProductUseCase.execute(id);
      return reply.status(204).send();
    } catch (error: unknown) {
      if (error instanceof ProductNotFoundError) {
        return reply.status(404).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  }
}
