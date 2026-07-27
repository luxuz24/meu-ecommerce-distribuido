import { type IProductRepository, type CreateProductDTO, type Product } from '../../../use-cases/CreateProductUseCase.js';
import { ProductModel } from '../models/ProductModel.js';

export class MongoProductRepository implements IProductRepository {
  
  async findBySKU(sku: string): Promise<Product | null> {
    const document = await ProductModel.findOne({ sku }).exec();
    if (!document) return null;

    
    const productObj = document.toObject();

    
    return {
      id: productObj._id.toString(),
      name: productObj.name,
      description: productObj.description,
      sku: productObj.sku,
      price: productObj.price,
      stock: productObj.stock,
      createdAt: productObj.createdAt
    };
  }

  async create(data: CreateProductDTO): Promise<Product> {
    const document = await ProductModel.create(data);
    const productObj = document.toObject();

    
    return {
      id: productObj._id.toString(),
      name: productObj.name,
      description: productObj.description,
      sku: productObj.sku,
      price: productObj.price,
      stock: productObj.stock,
      createdAt: productObj.createdAt
    };
  }
}
