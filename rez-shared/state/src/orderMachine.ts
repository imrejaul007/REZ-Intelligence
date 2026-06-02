import { OrderStatus } from '@rez/enums';

export type OrderEvent =
  | { type: 'ADD_ITEM'; sku: string; quantity: number }
  | { type: 'CHECKOUT' }
  | { type: 'CONFIRM_PAYMENT' }
  | { type: 'FULFILL' }
  | { type: 'SHIP'; trackingNumber: string }
  | { type: 'DELIVER' }
  | { type: 'CANCEL'; reason?: string }
  | { type: 'REFUND'; reason?: string };

export interface OrderItem {
  sku: string;
  quantity: number;
  price: number;
}

export interface OrderState {
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  trackingNumber?: string;
  cancelReason?: string;
  refundReason?: string;
}

export class OrderMachine {
  private state: OrderState = {
    status: OrderStatus.CART,
    items: [],
    total: 0,
  };

  getState(): OrderState {
    return { ...this.state };
  }

  transition(event: OrderEvent): OrderState {
    const { status } = this.state;

    switch (event.type) {
      case 'ADD_ITEM':
        if (status !== OrderStatus.CART) {
          throw new Error(`Can only add items in CART state, current: ${status}`);
        }
        // Simplified: assume price comes from inventory
        const newItem: OrderItem = { sku: event.sku, quantity: event.quantity, price: 0 };
        this.state.items.push(newItem);
        return this.state;

      case 'CHECKOUT':
        if (status !== OrderStatus.CART) {
          throw new Error(`Can only checkout from CART state, current: ${status}`);
        }
        if (this.state.items.length === 0) {
          throw new Error('Cannot checkout with empty cart');
        }
        this.state.status = OrderStatus.CHECKOUT;
        return this.state;

      case 'CONFIRM_PAYMENT':
        if (status !== OrderStatus.CHECKOUT) {
          throw new Error(`Can only confirm payment from CHECKOUT state, current: ${status}`);
        }
        this.state.status = OrderStatus.PAID;
        return this.state;

      case 'FULFILL':
        if (status !== OrderStatus.PAID) {
          throw new Error(`Can only fulfill from PAID state, current: ${status}`);
        }
        this.state.status = OrderStatus.FULFILLED;
        return this.state;

      case 'SHIP':
        if (status !== OrderStatus.FULFILLED) {
          throw new Error(`Can only ship from FULFILLED state, current: ${status}`);
        }
        this.state.trackingNumber = event.trackingNumber;
        return this.state;

      case 'DELIVER':
        if (status !== OrderStatus.FULFILLED) {
          throw new Error(`Can only deliver from FULFILLED state, current: ${status}`);
        }
        this.state.status = OrderStatus.DELIVERED;
        return this.state;

      case 'CANCEL':
        if (![OrderStatus.CART, OrderStatus.CHECKOUT, OrderStatus.PAID].includes(status)) {
          throw new Error(`Cannot cancel order in ${status} state`);
        }
        this.state.status = OrderStatus.CANCELLED;
        this.state.cancelReason = event.reason;
        return this.state;

      case 'REFUND':
        if (![OrderStatus.PAID, OrderStatus.FULFILLED].includes(status)) {
          throw new Error(`Cannot refund order in ${status} state`);
        }
        this.state.status = OrderStatus.REFUNDED;
        this.state.refundReason = event.reason;
        return this.state;

      default:
        const _exhaustive: never = event;
        return _exhaustive;
    }
  }

  canTransition(event: OrderEvent): boolean {
    try {
      const current = JSON.parse(JSON.stringify(this.state));
      this.transition(event);
      this.state = current;
      return true;
    } catch {
      return false;
    }
  }
}
