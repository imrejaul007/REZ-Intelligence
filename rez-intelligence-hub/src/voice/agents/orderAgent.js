/**
 * Order Agent - Autonomous agent for handling voice orders
 */

const axios = require('axios');

const REZ_ORDER_SERVICE_URL = process.env.REZ_ORDER_SERVICE_URL || 'http://localhost:4012';

class OrderAgent {
  constructor() {
    this.name = 'OrderAgent';
    this.confidence = 0.95;
  }

  /**
   * Handle order intent from voice
   */
  async handle(intent, entities, context) {
    console.log(`[${this.name}] Handling order intent:`, intent);

    const actions = [];

    // Based on intent type
    switch (intent) {
      case 'quick_order':
        actions.push(await this.createQuickOrder(entities, context));
        break;
      case 'track_order':
        actions.push(await this.trackOrder(entities, context));
        break;
      case 'cancel_order':
        actions.push(await this.cancelOrder(entities, context));
        break;
      default:
        actions.push(this.unknownOrderAction());
    }

    return this.compileResponse(actions);
  }

  /**
   * Create a quick order from voice
   */
  async createQuickOrder(entities, context) {
    try {
      // Extract food items
      const items = entities.foodItems || ['biryani'];
      const orderType = entities.orderType || 'delivery';

      // Call order service
      const response = await axios.post(`${REZ_ORDER_SERVICE_URL}/api/orders`, {
        userId: context.userId,
        storeId: context.storeId,
        items: items.map(item => ({
          name: item,
          quantity: 1
        })),
        fulfillment: {
          type: orderType,
          address: context.address,
          time: entities.time
        },
        source: 'voice',
        metadata: {
          channel: 'voice',
          confidence: context.confidence
        }
      });

      return {
        action: 'CREATE_ORDER',
        success: true,
        orderId: response.data.orderId,
        message: `Your order for ${items.join(', ')} has been placed. Order ID: ${response.data.orderId}`,
        data: response.data
      };
    } catch (error) {
      console.error(`[${this.name}] Order creation failed:`, error.message);
      return {
        action: 'CREATE_ORDER',
        success: false,
        message: "I couldn't place your order. Let me connect you to our support team."
      };
    }
  }

  /**
   * Track an order
   */
  async trackOrder(entities, context) {
    try {
      const orderId = entities.orderId || context.lastOrderId;

      if (!orderId) {
        return {
          action: 'TRACK_ORDER',
          success: false,
          message: "I need your order ID to track it. Could you provide your order number?"
        };
      }

      const response = await axios.get(`${REZ_ORDER_SERVICE_URL}/api/orders/${orderId}`);

      const order = response.data;
      const statusMessage = this.getStatusMessage(order.status);

      return {
        action: 'TRACK_ORDER',
        success: true,
        orderId,
        status: order.status,
        eta: order.estimatedDelivery,
        message: statusMessage,
        data: order
      };
    } catch (error) {
      console.error(`[${this.name}] Track failed:`, error.message);
      return {
        action: 'TRACK_ORDER',
        success: false,
        message: "I couldn't find your order. Let me check with our team."
      };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(entities, context) {
    try {
      const orderId = entities.orderId || context.lastOrderId;

      if (!orderId) {
        return {
          action: 'CANCEL_ORDER',
          success: false,
          message: "I need your order ID to cancel. Could you provide your order number?"
        };
      }

      // Confirm cancellation
      const response = await axios.post(`${REZ_ORDER_SERVICE_URL}/api/orders/${orderId}/cancel`, {
        reason: 'Customer request via voice',
        source: 'voice'
      });

      return {
        action: 'CANCEL_ORDER',
        success: true,
        orderId,
        message: `Your order ${orderId} has been cancelled. You'll receive a refund within 5-7 business days.`,
        data: response.data
      };
    } catch (error) {
      console.error(`[${this.name}] Cancel failed:`, error.message);
      return {
        action: 'CANCEL_ORDER',
        success: false,
        message: "I couldn't cancel your order. It might already be preparing. Let me connect you to support."
      };
    }
  }

  /**
   * Unknown order action
   */
  unknownOrderAction() {
    return {
      action: 'UNKNOWN_ORDER',
      success: false,
      message: "I'm not sure what you'd like to order. Could you please specify what food you'd like?"
    };
  }

  /**
   * Get status message for order
   */
  getStatusMessage(status) {
    const statusMessages = {
      'placed': 'Your order has been received.',
      'confirmed': 'Your order is confirmed and being prepared.',
      'preparing': 'Your order is being prepared in the kitchen.',
      'ready': 'Your order is ready!',
      'dispatched': 'Your order is on its way!',
      'out_for_delivery': 'Your driver is picking up your order.',
      'delivered': 'Your order has been delivered. Enjoy your meal!',
      'cancelled': 'This order has been cancelled.'
    };

    return statusMessages[status] || `Your order status is: ${status}`;
  }

  /**
   * Compile response for TTS
   */
  compileResponse(actions) {
    // Combine all action messages
    const messages = actions
      .filter(a => a.message)
      .map(a => a.message);

    return {
      success: actions.some(a => a.success),
      actions,
      message: messages.join(' '),
      speak: messages.join('. ')
    };
  }
}

module.exports = new OrderAgent();
