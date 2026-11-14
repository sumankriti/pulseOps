export type OrderStatus = 'Processing' | 'Shipped' | 'Delivered' | 'Delayed';
export interface Order {
  id: string;
  customer: string;
  initials: string;
  product: string;
  sku: string;
  amount: number;
  status: OrderStatus;
  warehouse: string;
  updated: string;
}
export function nextStatus(status: OrderStatus): OrderStatus {
  return status === 'Processing' || status === 'Delayed'
    ? 'Shipped'
    : status === 'Shipped'
      ? 'Delivered'
      : 'Delivered';
}
