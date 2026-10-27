import { type Product } from '../domain/entities/Product.js';
import {
  type IProductRepository,
  type UpdateProductDTO,
} from '../domain/repositories/IProductRepository.js';
import { ProductNotFoundError } from '../domain/errors/ProductNotFoundError.js';
import { InvalidProductDataError } from '../domain/errors/InvalidProductDataError.js';

export class UpdateProductUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(id: string, data: UpdateProductDTO): Promise<Product> {
    if ((data.price !== undefined && data.price < 0) || (data.stock !== undefined && data.stock < 0)) {
      throw new InvalidProductDataError('Price and stock must be non-negative values.');
    }

    const updated = await this.productRepository.update(id, data);
    if (!updated) {
      throw new ProductNotFoundError(id);
    }

    return updated;
  }
}
