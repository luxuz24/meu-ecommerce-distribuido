import { Product } from '../domain/entities/Product.js';
import {
  type IProductRepository,
  type CreateProductDTO,
} from '../domain/repositories/IProductRepository.js';
import { ProductAlreadyExistsError } from '../domain/errors/ProductAlreadyExistsError.js';
import { InvalidProductDataError } from '../domain/errors/InvalidProductDataError.js';

export { type CreateProductDTO, type IProductRepository, Product };

export class CreateProductUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(data: CreateProductDTO): Promise<Product> {
    const existingProduct = await this.productRepository.findBySKU(data.sku);
    if (existingProduct) {
      throw new ProductAlreadyExistsError(data.sku);
    }

    if (data.price < 0 || data.stock < 0) {
      throw new InvalidProductDataError('Price and stock must be non-negative values.');
    }

    const product = await this.productRepository.create(data);
    return product;
  }
}
