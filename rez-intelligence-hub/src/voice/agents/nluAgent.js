/**
 * NLU Agent - Natural Language Understanding for voice
 * Handles entity extraction, sentiment analysis, context management
 */

class NLUAgent {
  constructor() {
    this.name = 'NLUAgent';
  }

  /**
   * Process and understand voice input
   */
  async process(text, context = {}) {
    console.log(`[${this.name}] Processing:`, text);

    return {
      entities: this.extractEntities(text),
      sentiment: this.analyzeSentiment(text),
      language: this.detectLanguage(text),
      entities: this.extractEntities(text),
      cleanedText: this.cleanText(text),
      context: this.updateContext(text, context)
    };
  }

  /**
   * Extract entities from text
   */
  extractEntities(text) {
    const entities = {};

    // Food items
    const foodPatterns = /(?:i want|i need|order)\s+(.+?)(?:\s+for|\s+to|\s*$)/i;
    const foodMatch = text.match(foodPatterns);
    if (foodMatch) {
      entities.food = foodMatch[1].trim();
    }

    // Specific foods
    const foods = text.match(/\b(biryani|pizza|burger|chicken|rice|curry|noodles|pasta|salad|soup|dessert|drink|beverage|coffee|tea)\b/gi);
    if (foods) {
      entities.foodItems = [...new Set(foods.map(f => f.toLowerCase()))];
    }

    // Numbers
    const numberMatch = text.match(/\b(\d+)\b/);
    if (numberMatch) {
      entities.number = parseInt(numberMatch[1]);
    }

    // Time patterns
    const timePatterns = [
      /(\d{1,2}):?(\d{2})?\s*(am|pm)/i,
      /(in\s+)?(\d+)\s*(minutes?|hours?)/i
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.time = match[0];
        break;
      }
    }

    // Date patterns
    const datePatterns = [
      /today/i,
      /tomorrow/i,
      /next\s+(week|month)/i
    ];

    for (const pattern of datePatterns) {
      if (pattern.test(text)) {
        entities.date = pattern.toString();
        break;
      }
    }

    // Names
    const nameMatch = text.match(/name(?:\s+is)?\s+(\w+)/i);
    if (nameMatch) {
      entities.name = nameMatch[1];
    }

    // Phone
    const phoneMatch = text.match(/\b(\d{10})\b/);
    if (phoneMatch) {
      entities.phone = phoneMatch[1];
    }

    // Order ID
    const orderIdMatch = text.match(/order\s*#?\s*([A-Z0-9-]+)/i);
    if (orderIdMatch) {
      entities.orderId = orderIdMatch[1];
    }

    // Adjectives (for sentiment)
    const positiveWords = ['great', 'good', 'love', 'amazing', 'excellent', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'awful', 'worst', 'hate', 'angry', 'frustrated'];

    entities.sentiment = this.analyzeSentiment(text);

    return entities;
  }

  /**
   * Analyze sentiment
   */
  analyzeSentiment(text) {
    const positiveWords = ['great', 'good', 'love', 'amazing', 'excellent', 'fantastic', 'thank', 'thanks', 'please'];
    const negativeWords = ['bad', 'terrible', 'awful', 'worst', 'hate', 'angry', 'frustrated', 'annoyed', 'disappointed'];

    const words = text.toLowerCase().split(/\s+/);
    let score = 0;

    for (const word of words) {
      if (positiveWords.includes(word)) score += 1;
      if (negativeWords.includes(word)) score -= 1;
    }

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  /**
   * Detect language
   */
  detectLanguage(text) {
    // Simple Hindi detection
    const hindiChars = /[ऀ-ॿ]/;
    if (hindiChars.test(text)) {
      return 'hi';
    }

    // Simple Tamil detection
    const tamilChars = /[஀-௿]/;
    if (tamilChars.test(text)) {
      return 'ta';
    }

    return 'en';
  }

  /**
   * Clean text for processing
   */
  cleanText(text) {
    return text
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  /**
   * Update context from text
   */
  updateContext(text, currentContext) {
    const updated = { ...currentContext };

    // Extract and update entities
    const entities = this.extractEntities(text);

    if (entities.food) updated.lastFood = entities.food;
    if (entities.number) updated.lastNumber = entities.number;
    if (entities.orderId) updated.lastOrderId = entities.orderId;
    if (entities.name) updated.customerName = entities.name;
    if (entities.phone) updated.phone = entities.phone;

    // Update sentiment
    updated.sentiment = entities.sentiment;

    // Track conversation
    updated.conversationHistory = [
      ...(currentContext.conversationHistory || []),
      { role: 'user', text, timestamp: Date.now() }
    ].slice(-10); // Keep last 10

    return updated;
  }

  /**
   * Get context summary
   */
  getContextSummary(context) {
    return {
      userId: context.userId,
      lastOrder: context.lastOrderId,
      lastFood: context.lastFood,
      sentiment: context.sentiment,
      interactionCount: context.conversationHistory?.length || 0
    };
  }
}

module.exports = new NLUAgent();
