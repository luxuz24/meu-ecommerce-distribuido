import { MongoProductRepository } from './database/repositories/MongoProductRepository.js';
import { CreateProductUseCase } from '../use-cases/CreateProductUseCase.js';
import { ListProductsUseCase } from '../use-cases/ListProductsUseCase.js';
import { GetProductByIdUseCase } from '../use-cases/GetProductByIdUseCase.js';
import { UpdateProductUseCase } from '../use-cases/UpdateProductUseCase.js';
import { DeleteProductUseCase } from '../use-cases/DeleteProductUseCase.js';
import { ProductController } from './http/controllers/ProductController.js';

// Repositories
export const productRepository = new MongoProductRepository();

// Use Cases
export const createProductUseCase = new CreateProductUseCase(productRepository);
export const listProductsUseCase = new ListProductsUseCase(productRepository);
export const getProductByIdUseCase = new GetProductByIdUseCase(productRepository);
export const updateProductUseCase = new UpdateProductUseCase(productRepository);
export const deleteProductUseCase = new DeleteProductUseCase(productRepository);

// Controllers
export const productController = new ProductController(
  createProductUseCase,
  listProductsUseCase,
  getProductByIdUseCase,
  updateProductUseCase,
  deleteProductUseCase
);
