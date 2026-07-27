
export interface CreateProductDTO {
    name: string;
    description: string;
    sku: string;
    price: number;
    stock: number;
}

export interface Product extends CreateProductDTO {
    id: string; 
    createdAt: Date;
}

export interface IProductRepository {
    findBySKU(sku: string): Promise<Product | null>;
    create(data: CreateProductDTO): Promise<Product>;
}
export class CreateProductUseCase {

    constructor(private readonly productRepository: IProductRepository) {}
    
    async execute(data: CreateProductDTO) {
        const existingProduct = await this.productRepository.findBySKU(data.sku);
        if (existingProduct) {
            throw new Error(`Product with SKU ${data.sku} already exists.`);
        }
        
        if (data.price < 0 || data.stock < 0) {
            throw new Error("Price and stock must be non-negative values.");
        }

        const product = await this.productRepository.create(data);
        return product;
    }
}