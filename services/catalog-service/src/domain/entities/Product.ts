export interface ProductProps {
  id: string;
  name: string;
  description: string;
  sku: string;
  price: number;
  stock: number;
  isActive?: boolean | undefined;
  createdAt: Date;
  updatedAt?: Date | undefined;
}

export class Product {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  public readonly sku: string;
  public readonly price: number;
  public readonly stock: number;
  public readonly isActive: boolean;
  public readonly createdAt: Date;
  public readonly updatedAt?: Date | undefined;

  constructor(props: ProductProps) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.sku = props.sku;
    this.price = props.price;
    this.stock = props.stock;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
