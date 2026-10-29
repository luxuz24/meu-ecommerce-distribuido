export type ReservationStatus = 'RESERVED' | 'RELEASED' | 'CONFIRMED' | 'EXPIRED';

export interface ReservationItemEntry {
  sku: string;
  quantity: number;
}

export interface StockReservationProps {
  id: string;
  orderId: string;
  status: ReservationStatus;
  items: ReservationItemEntry[];
  createdAt?: Date;
}

export class StockReservation {
  public readonly id: string;
  public readonly orderId: string;
  public readonly status: ReservationStatus;
  public readonly items: ReservationItemEntry[];
  public readonly createdAt: Date;

  constructor(props: StockReservationProps) {
    this.id = props.id;
    this.orderId = props.orderId;
    this.status = props.status;
    this.items = props.items;
    this.createdAt = props.createdAt ?? new Date();
  }
}
