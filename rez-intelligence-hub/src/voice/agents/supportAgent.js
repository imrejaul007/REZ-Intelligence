/**
 * Support Agent - Autonomous agent for handling support requests
 */

const axios = require('axios');
const { randomInt } = require('crypto');

class SupportAgent {
  constructor() {
    this.name = 'SupportAgent';
    this.escalationThreshold = 3;
  }

  /**
   * Handle support intent from voice
   */
  async handle(intent, entities, context) {
    console.log(`[${this.name}] Handling support intent:`, intent);

    // Track interaction count
    context.interactionCount = (context.interactionCount || 0) + 1;

    switch (intent) {
      case 'speak_agent':
        return this.connectToAgent(context);
      case 'complaint':
        return await this.handleComplaint(entities, context);
      case 'payment_issue':
        return await this.handlePaymentIssue(entities, context);
      case 'refund_status':
        return await this.handleRefundStatus(entities, context);
      case 'repeat':
        return this.repeatLastMessage(context);
      case 'help':
        return this.showHelp();
      default:
        return this.unknownSupportAction();
    }
  }

  /**
   * Connect to human agent
   */
  connectToAgent(context) {
    console.log(`[${this.name}] Connecting to human agent for user:`, context.userId);

    return {
      action: 'CONNECT_AGENT',
      success: true,
      transfer: true,
      message: "I'll connect you to our support team. Please hold for a moment.",
      data: {
        queuePosition: randomInt(1, 6),
        estimatedWait: randomInt(1, 4)
      }
    };
  }

  /**
   * Handle complaint
   */
  async handleComplaint(entities, context) {
    try {
      // Log complaint
      console.log(`[${this.name}] Recording complaint:`, entities);

      // Check if should escalate
      if (this.shouldEscalate(context)) {
        return this.connectToAgent(context);
      }

      return {
        action: 'HANDLE_COMPLAINT',
        success: true,
        message: "I'm sorry to hear about your experience. I've logged your complaint and our team will follow up within 24 hours. Is there anything else I can help with?",
        complaintId: `COMP-${Date.now()}`
      };
    } catch (error) {
      console.error(`[${this.name}] Complaint handling failed:`, error.message);
      return this.connectToAgent(context);
    }
  }

  /**
   * Handle payment issue
   */
  async handlePaymentIssue(entities, context) {
    try {
      // Check for specific issue
      const orderId = entities.orderId || context.lastOrderId;

      if (orderId) {
        // Get order payment details
        // This would call the order service
        return {
          action: 'HANDLE_PAYMENT_ISSUE',
          success: true,
          message: "I can see your payment. Let me check the details. Payment issues typically resolve within 1-2 hours. Would you like me to escalate this?",
          orderId
        };
      }

      return {
        action: 'HANDLE_PAYMENT_ISSUE',
        success: true,
        message: "For payment issues, I'll need your order ID. Could you provide that?",
        needsMoreInfo: true,
        requiredField: 'orderId'
      };
    } catch (error) {
      console.error(`[${this.name}] Payment issue handling failed:`, error.message);
      return this.connectToAgent(context);
    }
  }

  /**
   * Handle refund status query
   */
  async handleRefundStatus(entities, context) {
    try {
      const orderId = entities.orderId || context.lastOrderId;

      if (!orderId) {
        return {
          action: 'REFUND_STATUS',
          success: false,
          message: "I need your order ID to check refund status. Could you provide it?"
        };
      }

      // This would call the payment service
      return {
        action: 'REFUND_STATUS',
        success: true,
        message: "Your refund is being processed and should reach your account within 5-7 business days.",
        orderId,
        refundAmount: entities.amount || 'original amount'
      };
    } catch (error) {
      console.error(`[${this.name}] Refund status failed:`, error.message);
      return this.connectToAgent(context);
    }
  }

  /**
   * Repeat last message
   */
  repeatLastMessage(context) {
    const lastMessage = context.lastMessage || "I'm sorry, I don't have anything to repeat.";

    return {
      action: 'REPEAT',
      success: true,
      message: lastMessage
    };
  }

  /**
   * Show help options
   */
  showHelp() {
    return {
      action: 'SHOW_HELP',
      success: true,
      message: "I can help you with: Placing orders, Tracking deliveries, Booking tables or appointments, Checking refund status, Filing complaints. What would you like help with?",
      options: [
        'Place an order',
        'Track my order',
        'Book a table',
        'Check refund status',
        'Speak to support'
      ]
    };
  }

  /**
   * Determine if should escalate
   */
  shouldEscalate(context) {
    return context.interactionCount >= this.escalationThreshold ||
           context.sentiment === 'angry' ||
           context.complaintSeverity === 'high';
  }

  /**
   * Unknown support action
   */
  unknownSupportAction() {
    return {
      action: 'UNKNOWN_SUPPORT',
      success: false,
      message: "I'm not sure how to help with that. Could you please provide more details, or say 'speak to agent' to connect with our team?"
    };
  }
}

module.exports = new SupportAgent();
