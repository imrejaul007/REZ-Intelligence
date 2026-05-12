/**
 * REZ Unified Intent Router
 *
 * Routes customer messages to:
 * - Agent OS (for tasks: book, order, pay)
 * - Support Copilot (for issues: refund, complaint, help)
 *
 * User doesn't know/care which system handles it.
 * They just want their problem solved.
 */

const INTENT_PATTERNS = {
  // === AGENT OS INTENTS (Tasks/Transactions) ===
  AGENT_OS: {
    // Booking intents
    BOOK: [
      'book', 'reserve', 'appointment', 'schedule',
      'want to go', 'need a table', 'make a reservation',
      'book for', 'reserve for', 'schedule for'
    ],

    // Order intents
    ORDER: [
      'order', 'buy', 'purchase', 'get me', 'i want',
      'order food', 'place order', 'i need', 'can i get',
      'want to order', 'order for delivery'
    ],

    // Payment intents
    PAY: [
      'pay', 'payment', 'checkout', 'bill', 'pay bill',
      'settle', 'complete payment', 'make payment'
    ],

    // Room service intents (Hotel)
    ROOM_SERVICE: [
      'room service', 'housekeeping', 'extra towels',
      'late checkout', 'extend stay', 'amenities',
      'hotel service', 'request'
    ],

    // Wallet intents
    WALLET: [
      'add money', 'withdraw', 'balance', 'transfer',
      'recharge', 'load money', 'my wallet'
    ],

    // Discovery intents
    DISCOVER: [
      'find', 'show me', 'recommend', 'suggest',
      "i'm bored", 'looking for', 'search', 'nearby',
      'what do you have', 'what's available'
    ],

    // Reservations
    RESERVE: [
      'reserve', 'slot', 'availability', 'check timing',
      'book slot', 'check availability'
    ]
  },

  // === SUPPORT COPILOT INTENTS (Issues/Problems) ===
  SUPPORT: {
    // Refund intents
    REFUND: [
      'refund', 'money back', 'return', 'cancel order',
      'not as described', 'want my money back', 'reverse payment'
    ],

    // Complaint intents
    COMPLAINT: [
      'complaint', 'issue', 'problem', 'wrong', 'bad',
      'terrible', 'awful', 'disappointed', 'not happy',
      'disappointed', 'frustrated', 'angry', 'report'
    ],

    // Lost/Missing intents
    LOST: [
      'lost', 'missing', 'didn\'t receive', 'never got',
      'where is my', 'tracking', 'order status'
    ],

    // Billing intents
    BILLING: [
      'charged', 'overcharged', 'double charged', 'billing issue',
      'wrong amount', 'price discrepancy', 'bill problem'
    ],

    // Technical issues
    TECHNICAL: [
      'not working', 'error', 'bug', 'crash', 'can\'t login',
      'app not working', 'can\'t access', 'technical issue'
    ],

    // Generic help
    HELP: [
      'help', 'how do i', 'how to', 'guidance',
      'need assistance', 'support', 'don\'t know how'
    ],

    // Account issues
    ACCOUNT: [
      'account', 'login', 'password', 'profile', 'change number',
      'update email', 'deactivate', 'delete account'
    ]
  },

  // === ROUTING HINTS ===
  CONTEXTUAL: {
    // Time-sensitive (Agent OS usually better)
    URGENT: [
      'asap', 'immediately', 'right now', 'urgent', 'emergency',
      'quick', 'hurry'
    ],

    // Negative sentiment (Support Copilot usually better)
    NEGATIVE: [
      'bad', 'terrible', 'worst', 'angry', 'frustrated',
      'disappointed', 'upset', 'complaint'
    ],

    // Happy/positive (Agent OS usually better)
    POSITIVE: [
      'love', 'great', 'awesome', 'amazing', 'wonderful',
      'excellent', 'fantastic'
    ]
  }
};

/**
 * Intent Router - determines where to send message
 */
class IntentRouter {
  constructor() {
    this.patterns = INTENT_PATTERNS;
  }

  /**
   * Route a message to the appropriate handler
   * @param {string} message - User's message
   * @param {object} context - Additional context (userId, app, etc.)
   * @returns {object} { route: 'agent-os' | 'support-copilot' | 'both', intents: [], confidence: number }
   */
  route(message, context = {}) {
    const lowerMessage = message.toLowerCase();
    const scores = this.calculateScores(lowerMessage, context);

    // Determine primary route
    let route;
    const agentOsScore = scores.agentOs;
    const supportScore = scores.support;
    const confidence = Math.abs(agentOsScore - supportScore);

    if (agentOsScore > supportScore + 0.2) {
      route = 'agent-os';
    } else if (supportScore > agentOsScore + 0.2) {
      route = 'support-copilot';
    } else {
      // Ambiguous - default to agent-os for tasks, support for issues
      route = supportScore >= agentOsScore ? 'support-copilot' : 'agent-os';
    }

    // Check for emergency/escalation
    if (scores.urgent || scores.negative) {
      // For complaints, always involve support copilot
      if (scores.negative > 0.3) {
        route = 'support-copilot';
      }
    }

    return {
      route,
      intents: scores.detectedIntents,
      confidence: Math.max(agentOsScore, supportScore),
      alternative: agentOsScore === supportScore ? null :
        (route === 'agent-os' ? 'support-copilot' : 'agent-os'),
      scores: {
        agentOs: agentOsScore,
        support: supportScore
      }
    };
  }

  /**
   * Calculate scores for each route
   */
  calculateScores(message, context) {
    let agentOsScore = 0;
    let supportScore = 0;
    const detectedIntents = [];

    // Check Agent OS patterns
    for (const [category, patterns] of Object.entries(this.patterns.AGENT_OS)) {
      for (const pattern of patterns) {
        if (message.includes(pattern)) {
          agentOsScore += 1;
          detectedIntents.push({ type: 'agent-os', category, pattern });
        }
      }
    }

    // Check Support patterns
    for (const [category, patterns] of Object.entries(this.patterns.SUPPORT)) {
      for (const pattern of patterns) {
        if (message.includes(pattern)) {
          supportScore += 1;
          detectedIntents.push({ type: 'support', category, pattern });
        }
      }
    }

    // Check contextual hints
    let urgent = false;
    let negative = false;

    for (const pattern of [...(this.patterns.CONTEXTUAL.URGENT || []), ...(this.patterns.CONTEXTUAL.NEGATIVE || [])]) {
      if (message.includes(pattern)) {
        if (this.patterns.CONTEXTUAL.URGENT.includes(pattern)) urgent = true;
        if (this.patterns.CONTEXTUAL.NEGATIVE.includes(pattern)) negative = true;
      }
    }

    // Normalize scores
    const maxPossible = Math.max(
      Object.values(this.patterns.AGENT_OS).flat().length,
      Object.values(this.patterns.SUPPORT).flat().length
    );

    return {
      agentOs: agentOsScore / maxPossible,
      support: supportScore / maxPossible,
      detectedIntents,
      urgent,
      negative
    };
  }

  /**
   * Extract entities from message for routing
   */
  extractEntities(message) {
    const entities = {
      orderId: this.extractPattern(message, /order[ #]?(\w+)/i),
      bookingId: this.extractPattern(message, /booking[ #]?(\w+)/i),
      amount: this.extractAmount(message),
      date: this.extractDate(message),
      time: this.extractTime(message),
      merchantId: this.extractPattern(message, /merchant[ #]?(\w+)/i),
      userId: this.extractPattern(message, /user[ #]?(\w+)/i)
    };

    return entities;
  }

  extractPattern(text, regex) {
    const match = text.match(regex);
    return match ? match[1] : null;
  }

  extractAmount(text) {
    const match = text.match(/₹?(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  extractDate(text) {
    // Simple date patterns
    const patterns = [
      { pattern: /tomorrow/i, offset: 1 },
      { pattern: /today/i, offset: 0 },
      { pattern: /next week/i, offset: 7 }
    ];

    for (const { pattern, offset } of patterns) {
      if (pattern.test(text)) {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        return date.toISOString();
      }
    }

    return null;
  }

  extractTime(text) {
    const match = text.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (match) {
      return {
        hour: parseInt(match[1]),
        minute: parseInt(match[2] || 0),
        period: match[3] || null
      };
    }
    return null;
  }
}

module.exports = { IntentRouter, INTENT_PATTERNS };
