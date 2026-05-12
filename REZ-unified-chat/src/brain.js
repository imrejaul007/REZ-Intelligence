/**
 * REZ Agent OS Brain
 *
 * Connects to ALL intelligence services:
 * - Intent Graph
 * - Memory Engine
 * - Identity Graph
 * - Taste Profile
 * - Reorder Engine
 * - Autonomous Agents
 * - Event Platform
 * - Support Copilot
 *
 * One brain to rule them all.
 */

const IntelligenceClient = require('./intelligenceClient');

class AgentOSBrain {
  constructor() {
    this.intelligence = IntelligenceClient;
  }

  /**
   * Get complete user context for any request
   */
  async getContext(userId, phone, email, namespace) {
    return await this.intelligence.getUserContext(userId, phone, email);
  }

  /**
   * Enhance response with intelligence
   */
  async enhanceResponse(response, context) {
    const enhanced = { ...response };

    // Add personalization hints
    if (context.profile) {
      enhanced.contextualHints = {
        userSegment: context.profile.segment || 'unknown',
        preferences: context.profile.preferences || {},
        history: context.memories || []
      };
    }

    // Add reorder predictions
    if (context.predictions?.length > 0) {
      enhanced.suggestions = context.predictions.slice(0, 3).map(p => ({
        type: 'reorder',
        item: p.itemName,
        reason: p.reason || 'You ordered this before'
      }));
    }

    // Add taste profile
    if (context.taste) {
      enhanced.personalization = {
        cuisines: context.taste.cuisines || [],
        priceRange: context.taste.priceRange || 'medium',
        dietary: context.taste.dietary || []
      };
    }

    return enhanced;
  }

  /**
   * Log conversation to memory
   */
  async remember(userId, message, response, routing) {
    await this.intelligence.storeMemory(userId, {
      type: 'conversation',
      message,
      response: response.slice(0, 200),
      routing,
      namespace: 'agent-os'
    });
  }

  /**
   * Log event to intelligence
   */
  async log(userId, eventType, data) {
    await this.intelligence.logEvent({
      type: eventType,
      userId,
      data
    });
  }
}

module.exports = AgentOSBrain;
