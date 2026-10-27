import { describe, it, expect, vi } from 'vitest';
import { CreateProductUseCase, type IProductRepository, type Product, type CreateProductDTO } from './CreateProductUseCase.js';

describe('CreateProductUseCase', () => {
  class InMemoryProductRepository implements IProductRepository {
    private products: Product[] = [];

    async findBySKU(sku: string): Promise<Product | null> {
      return this.products.find(p => p.sku === sku) ?? null;
    }

    async create(data: CreateProductDTO): Promise<Product> {
      const product: Product = {
        ...data,
        id: `mock-id-${Date.now()}`,
        createdAt: new Date(),
      };
      this.products.push(product);
      return product;
    }
  }

  it('should successfully create a new product', async () => {
    const repository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(repository);

    const productDTO: CreateProductDTO = {
      name: 'Mouse Gamer',
      description: 'Sensor óptico 16000 DPI',
      sku: 'MOUSE-123',
      price: 199.90,
      stock: 30,
    };

    const created = await useCase.execute(productDTO);

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Mouse Gamer');
    expect(created.sku).toBe('MOUSE-123');
    expect(created.price).toBe(199.90);
    expect(created.stock).toBe(30);

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
      price: 199.90,
      stock: 30,
    };

    await useCase.execute(productDTO);

    await expect(useCase.execute({
      ...productDTO,
      name: 'Outro Mouse',
    })).rejects.toThrow('Product with SKU MOUSE-DUP already exists.');
  });

  it('should reject creating a product with negative price', async () => {
    const repository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(repository);

    await expect(useCase.execute({
      name: 'Produto Negativo',
      description: 'Desc',
      sku: 'NEG-1',
      price: -10,
      stock: 5,
    })).rejects.toThrow('Price and stock must be non-negative values.');
  });

  it('should reject creating a product with negative stock', async () => {
    const repository = new InMemoryProductRepository();
    const useCase = new CreateProductUseCase(repository);

    await expect(useCase.execute({
      name: 'Produto Estoque Negativo',
      description: 'Desc',
      sku: 'NEG-2',
      price: 10,
      stock: -5,
    })).rejects.toThrow('Price and stock must be non-negative values.');
  });
});
