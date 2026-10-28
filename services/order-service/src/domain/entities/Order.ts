export type OrderStatus = 'PENDING' | 'STOCK_RESERVED' | 'PAID' | 'CANCELLED';

export interface OrderItemProps {
  id?: string;
  productId: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

export class OrderItem {
  public readonly id: string;
  public readonly productId: string;
  public readonly sku: string;
  public readonly name: string;
  public readonly price: number;
  public readonly quantity: number;

  constructor(props: OrderItemProps) {
    if (!props.sku || props.sku.trim().length < 2) {
      throw new Error('ORDER_ITEM_INVALID_SKU');
    }
    if (props.price < 0) {
      throw new Error('ORDER_ITEM_NEGATIVE_PRICE');
    }
    if (props.quantity <= 0) {
      throw new Error('ORDER_ITEM_INVALID_QUANTITY');
    }

    this.id = props.id ?? '';
    this.productId = props.productId;
    this.sku = props.sku.trim().toUpperCase();
    this.name = props.name.trim();
    this.price = Number(props.price.toFixed(2));
    this.quantity = props.quantity;
  }

  public get subtotal(): number {
    return Number((this.price * this.quantity).toFixed(2));
  }
}

export interface OrderProps {
  id: string;
  userId: string;
  status: OrderStatus;
  items: OrderItem[];
  total?: number;
  cancelReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Order {
  public readonly id: string;
  public readonly userId: string;
  public readonly status: OrderStatus;
  public readonly items: OrderItem[];
  public readonly total: number;
  public readonly cancelReason: string | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: OrderProps) {
    if (!props.userId) {
      throw new Error('ORDER_USER_ID_REQUIRED');
    }
    if (!props.items || props.items.length === 0) {
      throw new Error('ORDER_ITEMS_EMPTY');
    }

    const calculatedTotal = Number(
      props.items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)
    );

    this.id = props.id;
    this.userId = props.userId;
    this.status = props.status;
    this.items = props.items;
    this.total = calculatedTotal;
    this.cancelReason = props.cancelReason ?? null;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }
}
