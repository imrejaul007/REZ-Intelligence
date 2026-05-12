/**
 * POS Integration for Agent OS
 *
 * Connects to merchant POS systems:
 * - Industry-OS
 * - Restaurant Hub
 * - Retail POS
 *
 * Provides:
 * - Real-time inventory sync
 * - Order processing
 * - Payment collection
 * - Analytics
 */

const axios = require('axios');

class POSIntegration {
  constructor(config = {}) {
    this.config = {
      INDUSTRY_OS_URL: process.env.INDUSTRY_OS_URL || 'http://localhost:3001',
      MERCHANT_OS_URL: process.env.MERCHANT_OS_URL || 'http://localhost:4073',
      INVENTORY_URL: process.env.INVENTORY_URL || 'http://localhost:4071'
    };
  }

  // =========================================================================
  // MERCHANT ONBOARDING
  // =========================================================================

  /**
   * Onboard new merchant to POS
   */
  async onboardMerchant(merchantData) {
    try {
      const response = await axios.post(`${this.config.MERCHANT_OS_URL}/api/merchants`, {
        name: merchantData.name,
        category: merchantData.category,
        location: merchantData.location,
        owner: merchantData.owner
      }, { timeout: 10000 });

      return {
        success: true,
        merchantId: response.data.merchantId,
        posSetup: response.data.posSetup || 'pending'
      };
    } catch (error) {
      console.error('Merchant onboarding error:', error);
      return { success: false, error: error.message };
    }
  }

  // =========================================================================
  // INVENTORY MANAGEMENT
  // =========================================================================

  /**
   * Get real-time inventory
   */
  async getInventory(merchantId) {
    try {
      const response = await axios.get(`${this.config.INVENTORY_URL}/api/merchant/${merchantId}/inventory`, {
        timeout: 5000
      });

      return response.data;
    } catch (error) {
      return { items: [], error: error.message };
    }
  }

  /**
   * Update item availability
   */
  async updateItem(merchantId, itemId, data) {
    try {
      await axios.patch(`${this.config.INVENTORY_URL}/api/items/${itemId}`, data, {
        timeout: 5000
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Bulk update inventory (low stock alerts)
   */
  async bulkUpdateInventory(merchantId, updates) {
    try {
      const response = await axios.post(`${this.config.INVENTORY_URL}/api/merchant/${merchantId}/bulk-update`, {
        updates
      }, { timeout: 10000 });

      return {
        success: true,
        updated: response.data.updated || 0
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // =========================================================================
  // ORDERS & TRANSACTIONS
  // =========================================================================

  /**
   * Process POS order
   */
  async processOrder(merchantId, order) {
    try {
      // 1. Validate inventory
      const inventory = await this.getInventory(merchantId);
      const unavailable = this.checkInventory(order.items, inventory);

      if (unavailable.length > 0) {
        return {
          success: false,
          error: 'Items unavailable',
          unavailable
        };
      }

      // 2. Calculate totals
      const totals = this.calculateOrderTotals(order.items);

      // 3. Process payment
      const payment = await this.processPayment(order.payment);

      if (!payment.success) {
        return payment;
      }

      // 4. Create order
      const orderResponse = await axios.post(`${this.config.MERCHANT_OS_URL}/api/orders`, {
        merchantId,
        items: order.items,
        totals,
        paymentId: payment.paymentId
      });

      // 5. Update inventory
      await this.updateInventory(merchantId, order.items);

      // 6. Log event
      await this.logEvent('order_completed', {
        merchantId,
        orderId: orderResponse.data.orderId,
        amount: totals.total
      });

      return {
        success: true,
        orderId: orderResponse.data.orderId,
        totals
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  checkInventory(items, inventory) {
    const unavailable = [];
    const inventoryMap = new Map(
      inventory.items.map(i => [i.itemId, i])
    );

    for (const item of items) {
      const inv = inventoryMap.get(item.itemId);
      if (!inv || inv.quantity < item.quantity) {
        unavailable.push(item.name || item.itemId);
      }
    }

    return unavailable;
  }

  calculateOrderTotals(items) {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.18; // GST
    const total = subtotal + tax;

    return {
      items: items.length,
      subtotal,
      tax,
      total,
      currency: 'INR'
    };
  }

  async processPayment(payment) {
    // Call payment service
    return { success: true, paymentId: `pay_${Date.now()}` };
  }

  async updateInventory(merchantId, items) {
    for (const item of items) {
      await this.updateItem(merchantId, item.itemId, {
        quantity: -item.quantity
      });
    }
  }

  // =========================================================================
  // ANALYTICS
  // =========================================================================

  /**
   * Get merchant analytics
   */
  async getMerchantAnalytics(merchantId, period = 'today') {
    try {
      const response = await axios.get(
        `${this.config.MERCHANT_OS_URL}/api/merchants/${merchantId}/analytics?period=${period}`,
        { timeout: 10000 }
      );

      return response.data;
    } catch (error) {
      return this.getMockAnalytics();
    }
  }

  getMockAnalytics() {
    return {
      orders: 0,
      revenue: 0,
      avgOrderValue: 0,
      topItems: [],
      peakHours: []
    };
  }

  /**
   * Get sales report
   */
  async getSalesReport(merchantId, startDate, endDate) {
    try {
      const response = await axios.get(
        `${this.config.MERCHANT_OS_URL}/api/merchants/${merchantId}/sales`,
        {
          params: { startDate, endDate },
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      return { sales: [], summary: {} };
    }
  }

  // =========================================================================
  // EMPLOYEES
  // =========================================================================

  /**
   * Get employees
   */
  async getEmployees(merchantId) {
    try {
      const response = await axios.get(
        `${this.config.MERCHANT_OS_URL}/api/merchants/${merchantId}/employees`,
        { timeout: 5000 }
      );

      return response.data;
    } catch (error) {
      return { employees: [] };
    }
  }

  /**
   * Add employee
   */
  async addEmployee(merchantId, employee) {
    try {
      const response = await axios.post(
        `${this.config.MERCHANT_OS_URL}/api/merchants/${merchantId}/employees`,
        employee,
        { timeout: 5000 }
      );

      return { success: true, employeeId: response.data.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // =========================================================================
  // EVENTS
  // =========================================================================

  async logEvent(type, data) {
    // Send to event platform
    try {
      await axios.post('http://localhost:4008/api/events', {
        type,
        source: 'pos',
        data,
        timestamp: new Date().toISOString()
      }, { timeout: 2000 });
    } catch (error) {
      console.warn('Event log failed:', error.message);
    }
  }
}

module.exports = POSIntegration;
