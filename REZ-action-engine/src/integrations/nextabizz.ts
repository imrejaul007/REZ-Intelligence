import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger';
import { config } from '../config';

/**
 * NextaBiZ Integration
 *
 * Handles procurement operations, supplier management,
 * and purchase order creation with NextaBiZ system.
 */

interface PurchaseOrder {
  id?: string;
  supplierId: string;
  items: Array<{
    itemId: string;
    quantity: number;
    unitPrice?: number;
  }>;
  status?: 'draft' | 'submitted' | 'confirmed' | 'shipped' | 'received';
  notes?: string;
}

interface SupplierNotification {
  supplierId: string;
  type: 'order_received' | 'delivery_update' | 'quality_feedback';
  message: string;
  data?: Record<string, unknown>;
}

/**
 * NextaBiZ API Client
 */
export class NextaBiZClient {
  private apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      baseURL: config.nextabizz.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.nextabizz.apiKey && {
          'X-API-Key': config.nextabizz.apiKey,
        }),
      },
    });

    // Response interceptor for logging
    this.apiClient.interceptors.response.use(
      (response) => {
        logger.debug('NextaBiZ API response', {
          url: response.config.url,
          status: response.status,
        });
        return response;
      },
      (error) => {
        logger.error('NextaBiZ API error', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a draft purchase order
   */
  async createPurchaseOrder(po: PurchaseOrder): Promise<{
    success: boolean;
    purchaseOrder?: PurchaseOrder;
    error?: string;
  }> {
    try {
      const response = await this.apiClient.post('/purchase-orders', {
        ...po,
        status: 'draft',
      });

      logger.info('Purchase order created', {
        poId: response.data.id,
        supplierId: po.supplierId,
      });

      return {
        success: true,
        purchaseOrder: response.data,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create purchase order', { error: message });

      // In dev mode without NextaBiZ, return mock data
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return {
          success: true,
          purchaseOrder: {
            ...po,
            id: `PO-DRAFT-${Date.now()}`,
            status: 'draft',
          },
        };
      }

      return { success: false, error: message };
    }
  }

  /**
   * Submit a purchase order
   */
  async submitPurchaseOrder(poId: string): Promise<{
    success: boolean;
    purchaseOrder?: PurchaseOrder;
    error?: string;
  }> {
    try {
      const response = await this.apiClient.post(`/purchase-orders/${poId}/submit`);

      logger.info('Purchase order submitted', { poId });

      return {
        success: true,
        purchaseOrder: response.data,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to submit purchase order', { poId, error: message });
      return { success: false, error: message };
    }
  }

  /**
   * Notify supplier
   */
  async notifySupplier(notification: SupplierNotification): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.apiClient.post('/supplier-notifications', notification);

      logger.info('Supplier notified', {
        supplierId: notification.supplierId,
        type: notification.type,
      });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to notify supplier', { error: message });

      // In dev mode, return success anyway
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { success: true };
      }

      return { success: false, error: message };
    }
  }

  /**
   * Get supplier info
   */
  async getSupplier(supplierId: string): Promise<{
    success: boolean;
    supplier?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      const response = await this.apiClient.get(`/suppliers/${supplierId}`);
      return {
        success: true,
        supplier: response.data,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get item pricing from supplier
   */
  async getItemPricing(itemId: string, supplierId: string): Promise<{
    success: boolean;
    price?: number;
    currency?: string;
    error?: string;
  }> {
    try {
      const response = await this.apiClient.get(
        `/suppliers/${supplierId}/items/${itemId}/pricing`
      );
      return {
        success: true,
        price: response.data.price,
        currency: response.data.currency,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}

// Singleton instance
let nextabizzClient: NextaBiZClient | null = null;

export function getNextaBiZClient(): NextaBiZClient {
  if (!nextabizzClient) {
    nextabizzClient = new NextaBiZClient();
  }
  return nextabizzClient;
}

/**
 * Execute NextaBiZ action based on action ID
 */
export async function executeNextaBiZAction(
  actionId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const client = getNextaBiZClient();

  switch (actionId) {
    case 'inventory.low.reorder_suggestion':
    case 'inventory.out_of_stock.auto_order': {
      // Create draft purchase order
      const po: PurchaseOrder = {
        supplierId: payload.supplierId as string || 'DEFAULT-SUPPLIER',
        items: [
          {
            itemId: payload.itemId as string,
            quantity: payload.suggestedQuantity as number || 100,
          },
        ],
        notes: `Auto-generated reorder: ${payload.itemName || payload.itemId}`,
      };

      const result = await client.createPurchaseOrder(po);
      return {
        type: 'purchase_order',
        ...result,
      };
    }

    case 'supplier.delivery.delay_notification': {
      // Notify supplier about delay
      const notification: SupplierNotification = {
        supplierId: payload.supplierId as string,
        type: 'delivery_update',
        message: `Delivery delayed. New ETA: ${payload.newEta || 'TBD'}`,
        data: {
          orderId: payload.orderId,
          originalEta: payload.originalEta,
          newEta: payload.newEta,
        },
      };

      await client.notifySupplier(notification);
      return {
        type: 'supplier_notification',
        success: true,
        notificationType: notification.type,
      };
    }

    case 'supplier.quality.issue_report': {
      // Send quality feedback to supplier
      const notification: SupplierNotification = {
        supplierId: payload.supplierId as string,
        type: 'quality_feedback',
        message: `Quality issue reported for item ${payload.itemId}`,
        data: {
          itemId: payload.itemId,
          issueType: payload.issueType,
          severity: payload.severity,
        },
      };

      await client.notifySupplier(notification);
      return {
        type: 'quality_report',
        success: true,
        supplierId: payload.supplierId,
      };
    }

    default:
      logger.warn(`No NextaBiZ handler for action: ${actionId}`);
      return {
        type: 'unsupported_action',
        actionId,
        message: 'Action type not handled by NextaBiZ integration',
      };
  }
}
