/**
 * SUPPORT COPILOT Handlers
 *
 * UNDER Agent OS - Handles issues/problems:
 * - Refunds
 * - Complaints
 * - Lost orders
 * - Billing issues
 * - Technical problems
 */

const axios = require('axios');

class SupportHandlers {
  constructor(services) {
    this.services = services;
  }

  /**
   * Handle message routed to Support Copilot (Child of Agent OS)
   */
  async handle({ message, entities, context, intent }) {
    const lowerMessage = message.toLowerCase();

    // Determine support sub-intent
    if (this.isRefundIntent(intent, lowerMessage)) {
      return this.handleRefund({ message, entities, context });
    }

    if (this.isComplaintIntent(intent, lowerMessage)) {
      return this.handleComplaint({ message, entities, context });
    }

    if (this.isLostIntent(intent, lowerMessage)) {
      return this.handleLost({ message, entities, context });
    }

    if (this.isBillingIntent(intent, lowerMessage)) {
      return this.handleBilling({ message, entities, context });
    }

    if (this.isTechnicalIntent(intent, lowerMessage)) {
      return this.handleTechnical({ message, entities, context });
    }

    if (this.isAccountIntent(intent, lowerMessage)) {
      return this.handleAccount({ message, entities, context });
    }

    // Generic support
    return this.handleGenericSupport({ message, entities, context });
  }

  // ==========================================================================
  // REFUND HANDLERS
  // ==========================================================================

  async handleRefund({ message, entities, context }) {
    const { orderId } = entities;

    if (orderId) {
      return {
        message: `I understand you want a refund for order ${orderId}. Let me look into this...`,
        actions: [
          {
            type: 'api_call',
            service: 'support',
            handler: 'refund',
            action: 'initiate',
            params: { orderId, userId: context.userId }
          }
        ]
      };
    }

    return {
      message: `I'm sorry to hear about your experience. For refunds, I need some details:`,
      actions: [
        {
          type: 'collect_info',
          fields: [
            { name: 'orderId', prompt: 'What is your order ID?' },
            { name: 'reason', prompt: 'What is the reason for refund?' }
          ]
        }
      ]
    };
  }

  // ==========================================================================
  // COMPLAINT HANDLERS
  // ==========================================================================

  async handleComplaint({ message, entities, context }) {
    return {
      message: `I'm sorry you're having a bad experience. Let me help right away.`,
      actions: [
        {
          type: 'collect_info',
          fields: [
            { name: 'orderId', prompt: 'Order/booking ID?' },
            { name: 'issue', prompt: 'What went wrong?' },
            { name: 'type', prompt: 'Issue type?', options: ['Food quality', 'Service issue', 'Wrong item', 'Late delivery', 'Other'] }
          ]
        }
      ]
    };
  }

  // ==========================================================================
  // LOST/MISSING HANDLERS
  // ==========================================================================

  async handleLost({ message, entities, context }) {
    const { orderId } = entities;

    if (orderId) {
      return {
        message: `Let me check your order ${orderId}...`,
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

    return {
      message: `I understand your order hasn't arrived. Let me help track it. What's your order ID?`,
      actions: [
        {
          type: 'collect_info',
          fields: [
            { name: 'orderId', prompt: 'Your order ID' }
          ]
        }
      ]
    };
  }

  // ==========================================================================
  // BILLING HANDLERS
  // ==========================================================================

  async handleBilling({ message, entities, context }) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('charged') || lowerMessage.includes('overcharged')) {
      return {
        message: `I apologize for the confusion with your bill. Let me look into this immediately.`,
        actions: [
          {
            type: 'api_call',
            service: 'billing',
            action: 'investigate',
            params: { userId: context.userId }
          }
        ]
      };
    }

    if (lowerMessage.includes('double')) {
      return {
        message: `That sounds like a billing error. I'll investigate right away.`,
        actions: [
          {
            type: 'escalate',
            priority: 'high',
            handler: 'billing'
          }
        ]
      };
    }

    return {
      message: `I can help with your billing concern. What seems to be the issue?`,
      actions: [
        {
          type: 'suggest',
          options: [
            'Charged twice',
            'Wrong amount',
            'Price discrepancy',
            'Refund not received'
          ]
        }
      ]
    };
  }

  // ==========================================================================
  // TECHNICAL HANDLERS
  // ==========================================================================

  async handleTechnical({ message, entities, context }) {
    return {
      message: `I understand you're having technical issues. Let me help.`,
      actions: [
        {
          type: 'suggest',
          options: [
            "Can't login",
            'App not working',
            'Payment failed',
            'Other issue'
          ]
        }
      ]
    };
  }

  // ==========================================================================
  // ACCOUNT HANDLERS
  // ==========================================================================

  async handleAccount({ message, entities, context }) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('login') || lowerMessage.includes('password')) {
      return {
        message: `Let me help with your login issue.`,
        actions: [
          {
            type: 'suggest',
            options: [
              'Reset password',
              "Can't receive OTP",
              'Account locked',
              'Other login issue'
            ]
          }
        ]
      };
    }

    if (lowerMessage.includes('deactivate') || lowerMessage.includes('delete')) {
      return {
        message: `I understand you want to deactivate your account. This requires verification.`,
        actions: [
          {
            type: 'escalate',
            priority: 'medium',
            handler: 'account_team'
          }
        ]
      };
    }

    return {
      message: `I can help with your account. What do you need?`,
      actions: [
        {
          type: 'suggest',
          options: [
            'Update profile',
            'Change phone number',
            'Update email',
            'Deactivate account'
          ]
        }
      ]
    };
  }

  // ==========================================================================
  // GENERIC SUPPORT
  // ==========================================================================

  async handleGenericSupport({ message, entities, context }) {
    return {
      message: `I'm here to help. What can I assist you with?`,
      actions: [
        {
          type: 'suggest',
          options: [
            'Report an issue',
            'Track my order',
            'Request a refund',
            'Get help with payment'
          ]
        }
      ]
    };
  }

  // ==========================================================================
  // INTENT DETECTION
  // ==========================================================================

  isRefundIntent(intents, message) {
    return intents.some(i => i.category === 'REFUND') ||
      message.includes('refund') ||
      message.includes('money back') ||
      message.includes('return');
  }

  isComplaintIntent(intents, message) {
    return intents.some(i => i.category === 'COMPLAIN') ||
      message.includes('complaint') ||
      message.includes('bad') ||
      message.includes('terrible') ||
      message.includes('disappointed');
  }

  isLostIntent(intents, message) {
    return intents.some(i => i.category === 'LOST') ||
      message.includes('lost') ||
      message.includes('missing') ||
      message.includes("didn't receive") ||
      message.includes('where is my');
  }

  isBillingIntent(intents, message) {
    return intents.some(i => i.category === 'BILLING') ||
      message.includes('charged') ||
      message.includes('bill') ||
      message.includes('billing');
  }

  isTechnicalIntent(intents, message) {
    return intents.some(i => i.category === 'TECHNICAL') ||
      message.includes('not working') ||
      message.includes('error') ||
      message.includes('bug') ||
      message.includes('crash');
  }

  isAccountIntent(intents, message) {
    return intents.some(i => i.category === 'ACCOUNT') ||
      message.includes('account') ||
      message.includes('login') ||
      message.includes('password');
  }
}

module.exports = SupportHandlers;
