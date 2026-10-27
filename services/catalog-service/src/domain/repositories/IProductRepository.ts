import { type Product } from '../entities/Product.js';

export interface CreateProductDTO {
  name: string;
  description: string;
  sku: string;
  price: number;
  stock: number;
}

export interface UpdateProductDTO {
  name?: string | undefined;
  description?: string | undefined;
  price?: number | undefined;
  stock?: number | undefined;
  isActive?: boolean | undefined;
}

export interface ListProductsParams {
  page?: number | undefined;
  limit?: number | undefined;
  q?: string | undefined;
  active?: boolean | undefined;
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IProductRepository {
  findBySKU(sku: string): Promise<Product | null>;
  findById(id: string): Promise<Product | null>;
  list(params?: ListProductsParams): Promise<PaginatedProducts>;
  create(data: CreateProductDTO): Promise<Product>;
  update(id: string, data: UpdateProductDTO): Promise<Product | null>;
  softDelete(id: string): Promise<boolean>;
}
