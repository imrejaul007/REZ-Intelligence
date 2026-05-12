/**
 * AGENT OS Handlers
 *
 * Handles tasks/transactions:
 * - Bookings
 * - Orders
 * - Payments
 * - Discovery
 * - Wallet
 */

const axios = require('axios');

class AgentOSHandlers {
  constructor(services) {
    this.services = services;
  }

  /**
   * Handle message routed to Agent OS
   */
  async handle({ message, entities, context, intent }) {
    const lowerMessage = message.toLowerCase();

    // Determine sub-intent
    if (this.isBookingIntent(intent)) {
      return this.handleBooking({ message, entities, context });
    }

    if (this.isOrderIntent(intent)) {
      return this.handleOrder({ message, entities, context });
    }

    if (this.isPaymentIntent(intent)) {
      return this.handlePayment({ message, entities, context });
    }

    if (this.isDiscoveryIntent(intent)) {
      return this.handleDiscovery({ message, entities, context });
    }

    if (this.isWalletIntent(intent)) {
      return this.handleWallet({ message, entities, context });
    }

    // Default - try to understand and help
    return this.handleGeneral({ message, entities, context });
  }

  // ==========================================================================
  // BOOKING HANDLERS
  // ==========================================================================

  async handleBooking({ message, entities, context }) {
    // Extract booking details
    const { bookingId, date, time, partySize } = entities;

    if (bookingId) {
      // Check booking status
      return {
        message: `Let me check your booking status...`,
        actions: [
          {
            type: 'api_call',
            service: 'booking',
            action: 'get_status',
            params: { bookingId }
          }
        ]
      };
    }

    // Create new booking
    return {
      message: `I can help you with a booking! What would you like to book?`,
      actions: [
        {
          type: 'suggest',
          options: [
            'Table at a restaurant',
            'Hotel room',
            'Activity or experience',
            'Event tickets'
          ]
        }
      ]
    };
  }

  // ==========================================================================
  // ORDER HANDLERS
  // ==========================================================================

  async handleOrder({ message, entities, context }) {
    const { orderId } = entities;

    if (orderId) {
      // Track existing order
      return {
        message: `Let me track your order...`,
        actions: [
          {
            type: 'api_call',
            service: 'order',
            action: 'track',
            params: { orderId }
          }
        ]
      };
    }

    // New order
    return {
      message: `I can help you order! What would you like to order?`,
      actions: [
        {
          type: 'suggest',
          options: [
            'Order food',
            'Buy a product',
            'Order room service'
          ]
        }
      ]
    };
  }

  // ==========================================================================
  // PAYMENT HANDLERS
  // ==========================================================================

  async handlePayment({ message, entities, context }) {
    return {
      message: `I can help with payment. What would you like to pay for?`,
      actions: [
        {
          type: 'suggest',
          options: [
            'Pay my hotel bill',
            'Settle restaurant bill',
            'Checkout cart',
            'Add money to wallet'
          ]
        }
      ]
    };
  }

  // ==========================================================================
  // DISCOVERY HANDLERS
  // ==========================================================================

  async handleDiscovery({ message, entities, context }) {
    // Mood-based discovery
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("i'm bored") || lowerMessage.includes('bored')) {
      return {
        message: `I get it! Let me suggest something fun based on your mood...`,
        actions: [
          {
            type: 'api_call',
            service: 'discovery',
            action: 'mood_based',
            params: { mood: 'bored' }
          }
        ]
      };
    }

    if (lowerMessage.includes('celebrate')) {
      return {
        message: `Celebration time! Let me find great venues...`,
        actions: [
          {
            type: 'api_call',
            service: 'discovery',
            action: 'mood_based',
            params: { mood: 'celebrate' }
          }
        ]
      };
    }

    if (lowerMessage.includes('relax')) {
      return {
        message: `Time to unwind. Let me find relaxing options...`,
        actions: [
          {
            type: 'api_call',
            service: 'discovery',
            action: 'mood_based',
            params: { mood: 'relax' }
          }
        ]
      };
    }

    if (lowerMessage.includes('date')) {
      return {
        message: `Let me find perfect date spots...`,
        actions: [
          {
            type: 'api_call',
            service: 'discovery',
            action: 'mood_based',
            params: { mood: 'date' }
          }
        ]
      };
    }

    // General search
    return {
      message: `I can help you discover! What are you looking for?`,
      actions: [
        {
          type: 'suggest',
          options: [
            'Nearby restaurants',
            'Activities near me',
            'Popular experiences',
            'Today's deals'
          ]
        }
      ]
    };
  }

  // ==========================================================================
  // WALLET HANDLERS
  // ==========================================================================

  async handleWallet({ message, entities, context }) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('balance') || lowerMessage.includes('how much')) {
      return {
        message: `Let me check your wallet balance...`,
        actions: [
          {
            type: 'api_call',
            service: 'wallet',
            action: 'get_balance',
            params: { userId: context.userId }
          }
        ]
      };
    }

    if (lowerMessage.includes('add money') || lowerMessage.includes('recharge')) {
      return {
        message: `I can help you add money to your wallet. How much would you like to add?`,
        actions: [
          {
            type: 'suggest',
            options: ['₹100', '₹500', '₹1000', 'Other amount']
          }
        ]
      };
    }

    return {
      message: `I can help with your wallet. What would you like to do?`,
      actions: [
        {
          type: 'suggest',
          options: [
            'Check balance',
            'Add money',
            'View transactions',
            'Pay someone'
          ]
        }
      ]
    };
  }

  // ==========================================================================
  // GENERAL HANDLER
  // ==========================================================================

  async handleGeneral({ message, entities, context }) {
    return {
      message: `I'm here to help! I can assist with:`,
      actions: [
        {
          type: 'suggest',
          options: [
            'Book something',
            'Order food or product',
            'Discover nearby places',
            'Pay a bill'
          ]
        }
      ]
    };
  }

  // ==========================================================================
  // INTENT DETECTION
  // ==========================================================================

  isBookingIntent(intents) {
    return intents.some(i =>
      i.category === 'BOOK' || i.category === 'RESERVE'
    );
  }

  isOrderIntent(intents) {
    return intents.some(i => i.category === 'ORDER');
  }

  isPaymentIntent(intents) {
    return intents.some(i =>
      i.category === 'PAY' || i.category === 'WALLET'
    );
  }

  isDiscoveryIntent(intents) {
    return intents.some(i =>
      i.category === 'DISCOVER' || i.category === 'SEARCH'
    );
  }

  isWalletIntent(intents) {
    return intents.some(i => i.category === 'WALLET');
  }
}

module.exports = AgentOSHandlers;
