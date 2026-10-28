import { OrderItem, type Order } from '../domain/entities/Order.js';
import { ProductUnavailableError } from '../domain/errors/OrderErrors.js';
import { type IOrderRepository } from '../domain/repositories/IOrderRepository.js';
import { type IProductCatalog } from '../domain/services/IProductCatalog.js';

export interface CreateOrderInput {
  userId: string;
  // O cliente informa apenas O QUE quer e QUANTO; preço, nome e SKU vêm do catálogo.
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  // Gancho de demonstração: força o payment-service a recusar, disparando a compensação.
  simulatePaymentFailure?: boolean;
}

export class CreateOrderUseCase {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly productCatalog: IProductCatalog
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    if (!input.userId || !input.userId.trim()) {
      throw new Error('ORDER_USER_ID_REQUIRED');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('ORDER_ITEMS_EMPTY');
    }

    // Agrupa linhas repetidas do mesmo produto para não reservar estoque em duplicidade
    const quantities = new Map<string, number>();
    for (const item of input.items) {
      const productId = item.productId.trim();
      quantities.set(productId, (quantities.get(productId) ?? 0) + item.quantity);
    }

    const validatedItems = await Promise.all(
      Array.from(quantities.entries()).map(async ([productId, quantity]) => {
        const product = await this.productCatalog.findById(productId);
        if (!product || !product.isActive) {
          throw new ProductUnavailableError(productId);
        }
        return new OrderItem({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          price: product.price,
          quantity,
        });
      })
    );

    const serverCalculatedTotal = Number(
      validatedItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)
    );

    return this.orderRepository.createWithOutbox({
      userId: input.userId.trim(),
      items: validatedItems.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      total: serverCalculatedTotal,
      ...(input.simulatePaymentFailure ? { simulateOutcome: 'FAILED' as const } : {}),
    });
  }
}
