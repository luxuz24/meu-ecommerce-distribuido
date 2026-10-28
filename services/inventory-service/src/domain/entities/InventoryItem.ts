export interface InventoryItemProps {
  id: string;
  productId: string;
  sku: string;
  availableQty: number;
  reservedQty: number;
  updatedAt?: Date;
}

export class InventoryItem {
  public readonly id: string;
  public readonly productId: string;
  public readonly sku: string;
  public readonly availableQty: number;
  public readonly reservedQty: number;
  public readonly updatedAt: Date;

  constructor(props: InventoryItemProps) {
    if (!props.sku || props.sku.trim().length < 2) {
      throw new Error('SKU must have at least 2 characters');
    }
    if (props.availableQty < 0) {
      throw new Error('Available quantity cannot be negative');
    }
    if (props.reservedQty < 0) {
      throw new Error('Reserved quantity cannot be negative');
    }

    this.id = props.id;
    this.productId = props.productId;
    this.sku = props.sku.trim().toUpperCase();
    this.availableQty = props.availableQty;
    this.reservedQty = props.reservedQty;
    this.updatedAt = props.updatedAt ?? new Date();
  }
}
