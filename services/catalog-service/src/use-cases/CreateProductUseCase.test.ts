import { describe, it, expect } from 'vitest';
import { Product } from '../domain/entities/Product.js';
import {
  type IProductRepository,
  type CreateProductDTO,
  type UpdateProductDTO,
  type ListProductsParams,
  type PaginatedProducts,
} from '../domain/repositories/IProductRepository.js';
import { CreateProductUseCase } from './CreateProductUseCase.js';
import { ListProductsUseCase } from './ListProductsUseCase.js';
import { GetProductByIdUseCase } from './GetProductByIdUseCase.js';
import { UpdateProductUseCase } from './UpdateProductUseCase.js';
import { DeleteProductUseCase } from './DeleteProductUseCase.js';
import { ProductAlreadyExistsError } from '../domain/errors/ProductAlreadyExistsError.js';
import { InvalidProductDataError } from '../domain/errors/InvalidProductDataError.js';
import { ProductNotFoundError } from '../domain/errors/ProductNotFoundError.js';

export class InMemoryProductRepository implements IProductRepository {
  public products: Product[] = [];
  private counter = 1;

  async findBySKU(sku: string): Promise<Product | null> {
    return this.products.find((p) => p.sku === sku) ?? null;
  }

  async findById(id: string): Promise<Product | null> {
    return this.products.find((p) => p.id === id) ?? null;
  }

  async list(params: ListProductsParams = {}): Promise<PaginatedProducts> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const q = params.q?.trim().toLowerCase();

    const filtered = this.products.filter((p) => {
      if (params.active !== undefined && p.isActive !== params.active) {
        return false;
      }
      if (q && q.length > 0) {
        const matches =
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

    const total = filtered.length;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async create(data: CreateProductDTO): Promise<Product> {
    const product = new Product({
      ...data,
      id: `prod-${this.counter++}`,
      isActive: true,
      createdAt: new Date(),
    });
    this.products.push(product);
    return product;
  }

  async update(id: string, data: UpdateProductDTO): Promise<Product | null> {
    const index = this.products.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const existing = this.products[index]!;
    const updated = new Product({
      id: existing.id,
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      sku: existing.sku,
      price: data.price ?? existing.price,
      stock: data.stock ?? existing.stock,
      isActive: data.isActive ?? existing.isActive,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    this.products[index] = updated;
    return updated;
  }

  async softDelete(id: string): Promise<boolean> {
    const updated = await this.update(id, { isActive: false });
    return updated !== null;
  }
}

describe('CreateProductUseCase', () => {
  it('should successfully create a new product', async () => {
    const repository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(repository);

    const productDTO: CreateProductDTO = {
      name: 'Mouse Gamer',
      description: 'Sensor óptico 16000 DPI',
      sku: 'MOUSE-123',
      price: 199.9,
      stock: 30,
    };

    const created = await useCase.execute(productDTO);

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Mouse Gamer');
    expect(created.sku).toBe('MOUSE-123');
    expect(created.price).toBe(199.9);
    expect(created.stock).toBe(30);
    expect(created.isActive).toBe(true);

    const found = await repository.findBySKU('MOUSE-123');
    expect(found).not.toBeNull();
  });

  it('should reject creating a product with duplicate SKU', async () => {
    const repository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(repository);

    const productDTO: CreateProductDTO = {
      name: 'Mouse Gamer',
      description: 'Sensor óptico 16000 DPI',
      sku: 'MOUSE-DUP',
      price: 199.9,
      stock: 30,
    };

    await useCase.execute(productDTO);

    await expect(
      useCase.execute({
        ...productDTO,
        name: 'Outro Mouse',
      })
    ).rejects.toBeInstanceOf(ProductAlreadyExistsError);
  });

  it('should reject creating a product with negative price', async () => {
    const repository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(repository);

    await expect(
      useCase.execute({
        name: 'Produto Negativo',
        description: 'Desc',
        sku: 'NEG-1',
        price: -10,
        stock: 5,
      })
    ).rejects.toBeInstanceOf(InvalidProductDataError);
  });

  it('should reject creating a product with negative stock', async () => {
    const repository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(repository);

    await expect(
      useCase.execute({
        name: 'Produto Estoque Negativo',
        description: 'Desc',
        sku: 'NEG-2',
        price: 10,
        stock: -5,
      })
    ).rejects.toBeInstanceOf(InvalidProductDataError);
  });
});

describe('ListProductsUseCase', () => {
  it('should paginate and filter products by search query and active status', async () => {
    const repository = new InMemoryProductRepository();
    const createUseCase = new CreateProductUseCase(repository);
    const listUseCase = new ListProductsUseCase(repository);

    await createUseCase.execute({
      name: 'Teclado Mecânico RGB',
      description: 'Switch Red',
      sku: 'KB-001',
      price: 350,
      stock: 10,
    });
    await createUseCase.execute({
      name: 'Monitor Gamer 27',
      description: '144Hz IPS',
      sku: 'MON-002',
      price: 1500,
      stock: 5,
    });
    const p3 = await createUseCase.execute({
      name: 'Headset Sem Fio',
      description: 'Surround 7.1',
      sku: 'HS-003',
      price: 450,
      stock: 8,
    });

    // Soft-delete third product
    await repository.softDelete(p3.id);

    // Default active=true should return 2 items
    const activeResult = await listUseCase.execute({ page: 1, limit: 10 });
    expect(activeResult.total).toBe(2);
    expect(activeResult.items).toHaveLength(2);

    // Search query
    const searchResult = await listUseCase.execute({ q: 'Teclado' });
    expect(searchResult.total).toBe(1);
    expect(searchResult.items[0]?.sku).toBe('KB-001');

    // Pagination
    const page1 = await listUseCase.execute({ page: 1, limit: 1 });
    expect(page1.items).toHaveLength(1);
    expect(page1.totalPages).toBe(2);
  });
});

describe('GetProductById, UpdateProduct & DeleteProduct UseCases', () => {
  it('should get, update and soft-delete a product by ID', async () => {
    const repository = new InMemoryProductRepository();
    const createUseCase = new CreateProductUseCase(repository);
    const getByIdUseCase = new GetProductByIdUseCase(repository);
    const updateUseCase = new UpdateProductUseCase(repository);
    const deleteUseCase = new DeleteProductUseCase(repository);

    const created = await createUseCase.execute({
      name: 'Cadeira Gamer',
      description: 'Ergonômica',
      sku: 'CHAIR-01',
      price: 900,
      stock: 12,
    });

    const found = await getByIdUseCase.execute(created.id);
    expect(found.name).toBe('Cadeira Gamer');

    const updated = await updateUseCase.execute(created.id, { price: 850, stock: 10 });
    expect(updated.price).toBe(850);
    expect(updated.stock).toBe(10);

    await expect(updateUseCase.execute(created.id, { price: -1 })).rejects.toBeInstanceOf(
      InvalidProductDataError
    );

    await deleteUseCase.execute(created.id);
    const afterDelete = await getByIdUseCase.execute(created.id);
    expect(afterDelete.isActive).toBe(false);
  });

  it('should throw ProductNotFoundError for unknown ID', async () => {
    const repository = new InMemoryProductRepository();
    const getByIdUseCase = new GetProductByIdUseCase(repository);
    const updateUseCase = new UpdateProductUseCase(repository);
    const deleteUseCase = new DeleteProductUseCase(repository);

    await expect(getByIdUseCase.execute('non-existent')).rejects.toBeInstanceOf(
      ProductNotFoundError
    );
    await expect(updateUseCase.execute('non-existent', { price: 100 })).rejects.toBeInstanceOf(
      ProductNotFoundError
    );
    await expect(deleteUseCase.execute('non-existent')).rejects.toBeInstanceOf(
      ProductNotFoundError
    );
  });
});
