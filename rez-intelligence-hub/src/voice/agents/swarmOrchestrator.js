/**
 * Swarm Orchestrator - Coordinates multiple AI agents
 * Routes voice requests to the right agents
 */

const orderAgent = require('./orderAgent');
const bookingAgent = require('./bookingAgent');
const supportAgent = require('./supportAgent');
const nluAgent = require('./nluAgent');

class SwarmOrchestrator {
  constructor() {
    this.name = 'SwarmOrchestrator';
    this.agents = {
      order: orderAgent,
      booking: bookingAgent,
      support: supportAgent
    };
    this.nlu = nluAgent;
  }

  /**
   * Route and process voice request
   */
  async route(request, context = {}) {
    console.log(`[${this.name}] Routing request:`, request.text?.substring(0, 50));

    try {
      // 1. NLU Processing
      const nluResult = await this.nlu.process(request.text, context);
      console.log(`[${this.name}] NLU result:`, nluResult.sentiment);

      // 2. Determine primary agent
      const agentType = this.determineAgent(nluResult.intent);
      console.log(`[${this.name}] Selected agent:`, agentType);

      // 3. Execute with agent
      const agent = this.agents[agentType];
      const result = await agent.handle(nluResult.intent, nluResult.entities, {
        ...context,
        ...nluResult
      });

      // 4. Add metadata
      result.meta = {
        agent: agentType,
        intent: nluResult.intent,
        sentiment: nluResult.sentiment,
        language: nluResult.language,
        confidence: request.confidence || 0.9,
        timestamp: Date.now()
      };

      // 5. Update context
      result.updatedContext = nluResult.context;

      return result;

    } catch (error) {
      console.error(`[${this.name}] Routing error:`, error);
      return {
        success: false,
        action: 'ERROR',
        message: "I'm having trouble understanding. Could you please repeat?",
        error: error.message
      };
    }
  }

  /**
   * Determine which agent to use based on intent
   */
  determineAgent(intent) {
    const agentMap = {
      // Order intents
      'quick_order': 'order',
      'track_order': 'order',
      'cancel_order': 'order',
      'restaurant_order': 'order',

      // Booking intents
      'restaurant_reserve': 'booking',
      'book_slot': 'booking',
      'reschedule': 'booking',

      // Support intents
      'speak_agent': 'support',
      'complaint': 'support',
      'payment_issue': 'support',
      'refund_status': 'support',
      'repeat': 'support',
      'help': 'support'
    };

    return agentMap[intent] || 'support';
  }

  /**
   * Multi-agent coordination for complex requests
   */
  async coordinate(request, context = {}) {
    console.log(`[${this.name}] Coordinated request`);

    // For complex requests, run multiple agents
    const results = await Promise.allSettled([
      this.route(request, context)
    ]);

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
    const failed = results.filter(r => r.status === 'rejected' || !r.value?.success);

    if (successful.length > 0) {
      return successful[0].value;
    }

    if (failed.length > 0) {
      // Try support agent as fallback
      return this.agents.support.handle('speak_agent', {}, context);
    }

    return {
      success: false,
      message: "I'm having trouble processing your request. Connecting you to support."
    };
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      orchestrator: 'ready',
      agents: Object.keys(this.agents).reduce((acc, name) => {
        acc[name] = 'ready';
        return acc;
      }, {}),
      nlu: 'ready'
    };
  }
}

module.exports = new SwarmOrchestrator();
