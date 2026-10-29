import { ProductAlreadyExistsError } from '../../../domain/errors/ProductAlreadyExistsError.js';
import mongoose from 'mongoose';
import { Product } from '../../../domain/entities/Product.js';
import {
  type IProductRepository,
  type CreateProductDTO,
  type UpdateProductDTO,
  type ListProductsParams,
  type PaginatedProducts,
} from '../../../domain/repositories/IProductRepository.js';
import { ProductModel, type IProduct } from '../models/ProductModel.js';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class MongoProductRepository implements IProductRepository {
  private mapToDomain(document: IProduct): Product {
    const obj = document.toObject();
    return new Product({
      id: obj._id.toString(),
      name: obj.name,
      description: obj.description,
      sku: obj.sku,
      price: obj.price,
      stock: obj.stock,
      isActive: obj.isActive,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    });
  }

  async findBySKU(sku: string): Promise<Product | null> {
    const document = await ProductModel.findOne({ sku: String(sku) }).exec();
    if (!document) return null;
    return this.mapToDomain(document);
  }

  async findById(id: string): Promise<Product | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    const document = await ProductModel.findById(id).exec();
    if (!document) return null;
    return this.mapToDomain(document);
  }

  async list(params: ListProductsParams = {}): Promise<PaginatedProducts> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (params.active !== undefined) {
      filter.isActive = Boolean(params.active);
    }

    if (params.q && params.q.trim().length > 0) {
      const safeRegex = new RegExp(escapeRegex(params.q.trim()), 'i');
      filter.$or = [{ name: safeRegex }, { description: safeRegex }, { sku: safeRegex }];
    }

    const [documents, total] = await Promise.all([
      ProductModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      ProductModel.countDocuments(filter).exec(),
    ]);

    return {
      items: documents.map((doc) => this.mapToDomain(doc)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async create(data: CreateProductDTO): Promise<Product> {
    try {
      const document = await ProductModel.create({
        name: String(data.name),
        description: String(data.description),
        sku: String(data.sku),
        price: Number(data.price),
        stock: Number(data.stock),
      });
      return this.mapToDomain(document);
    } catch (error: unknown) {
      // Duas criações simultâneas passam pela checagem do use case; o índice único
      // decide quem vence e a perdedora vira o mesmo erro de domínio (409), não 500.
      if ((error as { code?: number }).code === 11000) {
        throw new ProductAlreadyExistsError(String(data.sku));
      }
      throw error;
    }
  }

  async update(id: string, data: UpdateProductDTO): Promise<Product | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    const updateFields: Record<string, unknown> = {};
    if (data.name !== undefined) updateFields.name = String(data.name);
    if (data.description !== undefined) updateFields.description = String(data.description);
    if (data.price !== undefined) updateFields.price = Number(data.price);
    if (data.stock !== undefined) updateFields.stock = Number(data.stock);
    if (data.isActive !== undefined) updateFields.isActive = Boolean(data.isActive);

    const document = await ProductModel.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { returnDocument: 'after' }
    ).exec();

    if (!document) return null;
    return this.mapToDomain(document);
  }

  async softDelete(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return false;
    }
    const document = await ProductModel.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { returnDocument: 'after' }
    ).exec();

    return document !== null;
  }
}
