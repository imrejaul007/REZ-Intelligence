import { Order } from '../types.js';

// In-memory order store
const orders: Order[] = [];

export class IdentityGraph {
  async link(userId: string, entityType: string, entityId: string, data: Record<string, unknown>): Promise<{ success: boolean; linkId: string; data: unknown }> {
    const key = `${userId}:${entityType}:${entityId}`;
    return {
      success: true,
      linkId: key,
      data,
    };
  }

  async getIdentity(userId: string, merchants: Record<string, { visits: number; lastVisit: string | null }>): Promise<{
    userId: string;
    entities: {
      merchants: string[];
      orders: number;
    };
  }> {
    return {
      userId,
      entities: {
        merchants: Object.keys(merchants || {}),
        orders: orders.filter((o) => o.userId === userId).length,
      },
    };
  }

  getOrders(): Order[] {
    return orders;
  }

  getOrdersByUser(userId: string): Order[] {
    return orders.filter((o) => o.userId === userId);
  }

  addOrder(order: Order): void {
    orders.push(order);
  }

  clearOrders(): void {
    orders.length = 0;
  }
}

export const identityGraph = new IdentityGraph();
