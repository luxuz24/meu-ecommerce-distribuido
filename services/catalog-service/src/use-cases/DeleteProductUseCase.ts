import { type IProductRepository } from '../domain/repositories/IProductRepository.js';
import { ProductNotFoundError } from '../domain/errors/ProductNotFoundError.js';

export class DeleteProductUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.productRepository.softDelete(id);
    if (!deleted) {
      throw new ProductNotFoundError(id);
    }
  }
}
