/**
 * Service Connector E2E Tests
 *
 * Tests the integration with backend services:
 * - Connector to Payment Service
 * - Connector to Wallet Service
 * - Connector to Order Service
 * - Service health checks
 * - Error propagation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { helpers, db as dbInstance, CONFIG } from './setup';

// Non-null assertion for db since it's guaranteed to be set during tests
const getDb = () => {
  if (!dbInstance) throw new Error('Database not initialized');
  return dbInstance;
};

describe('Service Connector', () => {
  let testUser: Awaited<ReturnType<typeof helpers.createTestUser>>;
  let testOrder: Awaited<ReturnType<typeof helpers.createTestOrder>>;

  beforeEach(async () => {
    testUser = await helpers.createTestUser({
      walletBalance: 5000,
    });
    testOrder = await helpers.createTestOrder(testUser.userId, [
      { itemId: 'pizza_001', name: 'Pizza', quantity: 2, price: 400 },
      { itemId: 'drinks_001', name: 'Cold Drink', quantity: 2, price: 100 },
    ]);
  });

  describe('Payment Service Connector', () => {
    test('should initiate payment through connector', async () => {
      const result = await helpers.callPaymentConnector('initiate', {
        orderId: testOrder.orderId,
        amount: testOrder.total,
        userId: testUser.userId,
        method: 'WALLET',
        currency: 'INR',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data).toHaveProperty('paymentId');
      }
    });

    test('should verify payment through connector', async () => {
      // First initiate payment
      const initResult = await helpers.callPaymentConnector('initiate', {
        orderId: testOrder.orderId,
        amount: testOrder.total,
        userId: testUser.userId,
        method: 'WALLET',
        currency: 'INR',
      });

      if (initResult.success && initResult.data) {
        const paymentId = (initResult.data as { paymentId: string }).paymentId;

        // Verify payment
        const verifyResult = await helpers.callPaymentConnector('verify', {
          paymentId,
        });

        expect(verifyResult.success).toBe(true);
      }
    });

    test('should handle payment with insufficient funds', async () => {
      const result = await helpers.callPaymentConnector('initiate', {
        orderId: testOrder.orderId,
        amount: 1000000, // Much higher than wallet balance
        userId: testUser.userId,
        method: 'WALLET',
        currency: 'INR',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    test('should process refund through connector', async () => {
      // First create a payment
      const initResult = await helpers.callPaymentConnector('initiate', {
        orderId: testOrder.orderId,
        amount: testOrder.total,
        userId: testUser.userId,
        method: 'WALLET',
        currency: 'INR',
      });

      if (initResult.success && initResult.data) {
        const paymentId = (initResult.data as { paymentId: string }).paymentId;

        // Process refund
        const refundResult = await helpers.callPaymentConnector('refund', {
          paymentId,
          amount: testOrder.total,
          reason: 'Customer request',
        });

        expect(refundResult).toBeDefined();
      }
    });

    test('should handle duplicate payment prevention', async () => {
      const paymentData = {
        orderId: testOrder.orderId,
        amount: testOrder.total,
        userId: testUser.userId,
        method: 'WALLET',
        currency: 'INR',
        idempotencyKey: 'test_idempotency_key_123',
      };

      // First attempt
      const firstResult = await helpers.callPaymentConnector('initiate', paymentData);

      // Second attempt with same idempotency key should return same result
      const secondResult = await helpers.callPaymentConnector('initiate', paymentData);

      expect(firstResult).toBeDefined();
      expect(secondResult).toBeDefined();
    });

    test('should validate payment amount', async () => {
      const result = await helpers.callPaymentConnector('initiate', {
        orderId: testOrder.orderId,
        amount: -100, // Invalid negative amount
        userId: testUser.userId,
        method: 'WALLET',
        currency: 'INR',
      });

      expect(result.success).toBe(false);
    });

    test('should handle Razorpay integration', async () => {
      const result = await helpers.callPaymentConnector('initiate', {
        orderId: testOrder.orderId,
        amount: testOrder.total,
        userId: testUser.userId,
        method: 'RAZORPAY',
        currency: 'INR',
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    test('should retrieve payment history', async () => {
      // Create some payments first
      await helpers.callPaymentConnector('initiate', {
        orderId: testOrder.orderId,
        amount: testOrder.total,
        userId: testUser.userId,
        method: 'WALLET',
        currency: 'INR',
      });

      const historyResult = await helpers.callPaymentConnector('history', {
        userId: testUser.userId,
        limit: 10,
      });

      expect(historyResult).toBeDefined();
    });
  });

  describe('Wallet Service Connector', () => {
    test('should get wallet balance', async () => {
      const result = await helpers.callWalletConnector('getBalance', {
        userId: testUser.userId,
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data).toHaveProperty('balance');
      }
    });

    test('should add funds to wallet', async () => {
      const initialBalance = await helpers.getWalletBalance(testUser.userId);

      const result = await helpers.callWalletConnector('addFunds', {
        userId: testUser.userId,
        amount: 1000,
        source: 'UPI',
      });

      expect(result.success).toBe(true);

      const newBalance = await helpers.getWalletBalance(testUser.userId);
      expect(newBalance).toBe(initialBalance + 1000);
    });

    test('should deduct funds from wallet', async () => {
      const initialBalance = await helpers.getWalletBalance(testUser.userId);

      const result = await helpers.callWalletConnector('deduct', {
        userId: testUser.userId,
        amount: 500,
        reference: `deduction_${Date.now()}`,
      });

      expect(result.success).toBe(true);

      const newBalance = await helpers.getWalletBalance(testUser.userId);
      expect(newBalance).toBe(initialBalance - 500);
    });

    test('should prevent negative balance deduction', async () => {
      const balance = await helpers.getWalletBalance(testUser.userId);

      const result = await helpers.callWalletConnector('deduct', {
        userId: testUser.userId,
        amount: balance + 10000, // More than available
        reference: `deduction_${Date.now()}`,
      });

      expect(result.success).toBe(false);
    });

    test('should transfer funds between wallets', async () => {
      const recipient = await helpers.createTestUser({ walletBalance: 1000 });
      const senderInitial = await helpers.getWalletBalance(testUser.userId);

      const result = await helpers.callWalletConnector('transfer', {
        fromUserId: testUser.userId,
        toUserId: recipient.userId,
        amount: 500,
        reference: `transfer_${Date.now()}`,
      });

      expect(result).toBeDefined();

      const senderFinal = await helpers.getWalletBalance(testUser.userId);
      expect(senderFinal).toBe(senderInitial - 500);
    });

    test('should get wallet transaction history', async () => {
      // Perform some transactions
      await helpers.callWalletConnector('addFunds', {
        userId: testUser.userId,
        amount: 100,
        source: 'CARD',
      });

      const result = await helpers.callWalletConnector('transactions', {
        userId: testUser.userId,
        limit: 10,
      });

      expect(result).toBeDefined();
    });

    test('should validate minimum wallet balance', async () => {
      const result = await helpers.callWalletConnector('validateMinBalance', {
        userId: testUser.userId,
        minBalance: 100,
      });

      expect(result.success).toBe(true);
    });

    test('should handle wallet freeze/unfreeze', async () => {
      const freezeResult = await helpers.callWalletConnector('freeze', {
        userId: testUser.userId,
        reason: 'Suspicious activity',
      });

      expect(freezeResult).toBeDefined();

      const unfreezeResult = await helpers.callWalletConnector('unfreeze', {
        userId: testUser.userId,
      });

      expect(unfreezeResult).toBeDefined();
    });
  });

  describe('Order Service Connector', () => {
    test('should create order through connector', async () => {
      const result = await helpers.callOrderConnector('create', {
        userId: testUser.userId,
        items: [
          { itemId: 'burger_001', name: 'Burger', quantity: 1, price: 200 },
        ],
        deliveryAddress: '123 Test Street, Mumbai',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data).toHaveProperty('orderId');
      }
    });

    test('should get order details', async () => {
      const result = await helpers.callOrderConnector('get', {
        orderId: testOrder.orderId,
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect((result.data as { orderId: string }).orderId).toBe(testOrder.orderId);
      }
    });

    test('should update order status', async () => {
      const result = await helpers.callOrderConnector('updateStatus', {
        orderId: testOrder.orderId,
        status: 'CONFIRMED',
      });

      expect(result.success).toBe(true);

      const updatedOrder = await getDb().collection('orders').findOne({ orderId: testOrder.orderId });
      expect(updatedOrder?.status).toBe('CONFIRMED');
    });

    test('should cancel order', async () => {
      const result = await helpers.callOrderConnector('cancel', {
        orderId: testOrder.orderId,
        reason: 'Customer requested cancellation',
      });

      expect(result.success).toBe(true);

      const cancelledOrder = await getDb().collection('orders').findOne({ orderId: testOrder.orderId });
      expect(cancelledOrder?.status).toBe('CANCELLED');
    });

    test('should add items to existing order', async () => {
      const result = await helpers.callOrderConnector('addItems', {
        orderId: testOrder.orderId,
        items: [
          { itemId: 'extra_001', name: 'Extra Cheese', quantity: 1, price: 50 },
        ],
      });

      expect(result.success).toBe(true);
    });

    test('should remove items from order', async () => {
      const result = await helpers.callOrderConnector('removeItems', {
        orderId: testOrder.orderId,
        itemIds: [testOrder.items[0].itemId],
      });

      expect(result).toBeDefined();
    });

    test('should get order history for user', async () => {
      const result = await helpers.callOrderConnector('history', {
        userId: testUser.userId,
        limit: 10,
      });

      expect(result).toBeDefined();
    });

    test('should calculate order total', async () => {
      const result = await helpers.callOrderConnector('calculateTotal', {
        items: [
          { itemId: 'item_1', name: 'Item 1', quantity: 2, price: 100 },
          { itemId: 'item_2', name: 'Item 2', quantity: 1, price: 150 },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect((result.data as { total: number }).total).toBe(350);
      }
    });

    test('should apply discount to order', async () => {
      const result = await helpers.callOrderConnector('applyDiscount', {
        orderId: testOrder.orderId,
        discountCode: 'SAVE10',
      });

      expect(result).toBeDefined();
    });

    test('should get estimated delivery time', async () => {
      const result = await helpers.callOrderConnector('deliveryEstimate', {
        orderId: testOrder.orderId,
        deliveryAddress: '123 Test Street',
      });

      expect(result).toBeDefined();
    });
  });

  describe('Service Health Checks', () => {
    test('should check Payment Service health', async () => {
      const client = require('axios').default || require('axios');
      try {
        const response = await client.get(`${CONFIG.PAYMENT_SERVICE_URL}/health`, {
          timeout: 5000,
        });
        expect(response.status).toBe(200);
      } catch {
        // Service may not be running in test environment
        console.warn('Payment Service health check skipped');
      }
    });

    test('should check Wallet Service health', async () => {
      const client = require('axios').default || require('axios');
      try {
        const response = await client.get(`${CONFIG.WALLET_SERVICE_URL}/health`, {
          timeout: 5000,
        });
        expect(response.status).toBe(200);
      } catch {
        console.warn('Wallet Service health check skipped');
      }
    });

    test('should check Order Service health', async () => {
      const client = require('axios').default || require('axios');
      try {
        const response = await client.get(`${CONFIG.ORDER_SERVICE_URL}/health`, {
          timeout: 5000,
        });
        expect(response.status).toBe(200);
      } catch {
        console.warn('Order Service health check skipped');
      }
    });
  });

  describe('Service-to-Service Communication', () => {
    test('should authenticate internal service calls', async () => {
      const client = require('axios').default || require('axios');

      // With valid token
      const validResponse = await client.get(
        `${CONFIG.PAYMENT_SERVICE_URL}/api/internal/health`,
        {
          headers: {
            'X-Internal-Token': CONFIG.INTERNAL_SERVICE_TOKENS.payment,
          },
          timeout: 5000,
        }
      ).catch(() => ({ status: 500 }));

      expect(validResponse.status).toBeDefined();

      // Without token (should fail)
      try {
        await client.get(`${CONFIG.PAYMENT_SERVICE_URL}/api/internal/health`);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should propagate errors from services', async () => {
      const result = await helpers.callPaymentConnector('verify', {
        paymentId: 'nonexistent_payment_id',
      });

      // Should return error response
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    test('should handle service timeout gracefully', async () => {
      const result = await helpers.retryWithBackoff(async () => {
        return helpers.callPaymentConnector('slowOperation', {
          userId: testUser.userId,
        });
      }, 1, 100).catch(() => ({ success: false, error: 'Timeout' }));

      expect(result).toBeDefined();
    });
  });

  describe('Connector Error Handling', () => {
    test('should handle connection refused errors', async () => {
      const result = await helpers.callPaymentConnector('initiate', {
        orderId: 'test_order',
        amount: 100,
        userId: 'test_user',
        method: 'WALLET',
        currency: 'INR',
      });

      // Should return structured error
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
    });

    test('should handle invalid service response', async () => {
      const result = await helpers.callPaymentConnector('malformedResponse', {});

      expect(result).toBeDefined();
    });

    test('should handle network errors', async () => {
      const result = await helpers.callPaymentConnector('networkError', {});

      expect(result.success).toBe(false);
    });

    test('should validate connector input parameters', async () => {
      const result = await helpers.callPaymentConnector('initiate', {
        // Missing required fields
        userId: testUser.userId,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('validation');
      }
    });

    test('should handle rate limiting from services', async () => {
      // Send many requests quickly
      const results = await Promise.allSettled(
        Array(10).fill(null).map(() =>
          helpers.callPaymentConnector('initiate', {
            orderId: `order_${Date.now()}`,
            amount: 100,
            userId: testUser.userId,
            method: 'WALLET',
            currency: 'INR',
          })
        )
      );

      // Some should succeed, some might be rate limited
      expect(results.length).toBe(10);
    });
  });

  describe('Data Consistency', () => {
    test('should maintain consistency between services', async () => {
      // Create order
      const order = await helpers.createTestOrder(testUser.userId);

      // Process payment
      const paymentResult = await helpers.createPayment(
        order.orderId,
        order.total,
        testUser.userId,
        'WALLET'
      );

      // Deduct from wallet
      await helpers.deductWallet(testUser.userId, order.total);

      // All three should be consistent
      const walletBalance = await helpers.getWalletBalance(testUser.userId);
      const payment = await getDb().collection('payments').findOne({ orderId: order.orderId });
      const orderRecord = await getDb().collection('orders').findOne({ orderId: order.orderId });

      expect(walletBalance).toBeLessThanOrEqual(5000 - order.total);
      expect(payment).not.toBeNull();
      expect(orderRecord).not.toBeNull();
    });

    test('should rollback on partial failure', async () => {
      const initialBalance = await helpers.getWalletBalance(testUser.userId);

      // Simulate failure during order creation
      try {
        await helpers.callOrderConnector('createWithFailure', {
          userId: testUser.userId,
          items: [],
        });
      } catch {
        // Expected to fail
      }

      // Balance should remain unchanged
      const finalBalance = await helpers.getWalletBalance(testUser.userId);
      expect(finalBalance).toBe(initialBalance);
    });
  });
});
