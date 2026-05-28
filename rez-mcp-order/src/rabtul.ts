/**
 * MCP Order - RABTUL Order Integration
 */

import axios from 'axios';

const ORDER_URL = process.env.ORDER_SERVICE_URL || 'https://rez-order-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Create order
 */
export async function createOrder(params: {
  userId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  shippingAddress?: Record<string, unknown>;
  paymentMethod?: string;
}): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const res = await axios.post(`${ORDER_URL}/api/orders/create`, params, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, orderId: res.data.orderId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Get order
 */
export async function getOrder(orderId: string): Promise<{ order: unknown; error?: string }> {
  try {
    const res = await axios.get(`${ORDER_URL}/api/orders/${orderId}`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { order: res.data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { order: null, error: message };
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(orderId: string, status: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.patch(`${ORDER_URL}/api/orders/${orderId}/status`, { status }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Get user orders
 */
export async function getUserOrders(userId: string, limit = 20): Promise<{ orders: unknown[]; error?: string }> {
  try {
    const res = await axios.get(`${ORDER_URL}/api/orders/user/${userId}`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      params: { limit },
    });
    return { orders: res.data.orders || [] };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { orders: [], error: message };
  }
}

/**
 * Cancel order
 */
export async function cancelOrder(orderId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${ORDER_URL}/api/orders/${orderId}/cancel`, { reason }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

export const mcpOrderRABTUL = {
  createOrder,
  getOrder,
  updateOrderStatus,
  getUserOrders,
  cancelOrder,
};

export default mcpOrderRABTUL;
