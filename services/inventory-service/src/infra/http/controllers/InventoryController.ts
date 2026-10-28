import { type FastifyReply, type FastifyRequest } from 'fastify';
import { InventoryItemNotFoundError } from '../../../domain/errors/InventoryErrors.js';
import { type GetStockBySkuUseCase } from '../../../use-cases/GetStockBySkuUseCase.js';
import { type ReserveStockUseCase } from '../../../use-cases/ReserveStockUseCase.js';
import { type ReleaseStockUseCase } from '../../../use-cases/ReleaseStockUseCase.js';
import { type UpsertStockUseCase } from '../../../use-cases/UpsertStockUseCase.js';

export class InventoryController {
  constructor(
    private readonly getStockBySkuUseCase: GetStockBySkuUseCase,
    private readonly upsertStockUseCase: UpsertStockUseCase,
    private readonly reserveStockUseCase: ReserveStockUseCase,
    private readonly releaseStockUseCase: ReleaseStockUseCase
  ) {}

  async listAll(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const items = await this.getStockBySkuUseCase.listAll();
    reply.status(200).send({ items });
  }

  async getBySku(
    request: FastifyRequest<{ Params: { sku: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const item = await this.getStockBySkuUseCase.execute(request.params.sku);
      reply.status(200).send(item);
    } catch (err) {
      if (err instanceof InventoryItemNotFoundError) {
        reply.status(404).send({ error: err.message });
        return;
      }
      throw err;
    }
  }

  async upsertStock(
    request: FastifyRequest<{
      Body: { productId: string; sku: string; availableQty: number };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const item = await this.upsertStockUseCase.execute(request.body);
    reply.status(200).send(item);
  }

  async reserveOrderStock(
    request: FastifyRequest<{
      Body: {
        messageId?: string;
        orderId: string;
        items: Array<{ sku: string; quantity: number }>;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.reserveStockUseCase.execute(request.body);
    if (result.status === 'STOCK_REJECTED') {
      reply.status(409).send(result);
      return;
    }
    reply.status(200).send(result);
  }

  async releaseOrderStock(
    request: FastifyRequest<{
      Params: { orderId: string };
      Body?: { messageId?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const released = await this.releaseStockUseCase.execute(
      request.params.orderId,
      request.body?.messageId
    );
    reply.status(200).send({ orderId: request.params.orderId, released });
  }
}
