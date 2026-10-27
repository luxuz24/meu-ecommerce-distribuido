import { type Product } from '../domain/entities/Product.js';
import { type IProductRepository } from '../domain/repositories/IProductRepository.js';
import { ProductNotFoundError } from '../domain/errors/ProductNotFoundError.js';

export class GetProductByIdUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(id: string): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new ProductNotFoundError(id);
    }
    return product;
  }
}
