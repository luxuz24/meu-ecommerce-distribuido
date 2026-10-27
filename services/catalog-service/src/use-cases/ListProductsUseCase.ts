import {
  type IProductRepository,
  type ListProductsParams,
  type PaginatedProducts,
} from '../domain/repositories/IProductRepository.js';

export class ListProductsUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(params: ListProductsParams = {}): Promise<PaginatedProducts> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const active = params.active ?? true;

    return this.productRepository.list({
      page,
      limit,
      q: params.q,
      active,
    });
  }
}
