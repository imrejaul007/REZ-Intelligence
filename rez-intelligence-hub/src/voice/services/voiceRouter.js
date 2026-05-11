/**
 * Voice Intent Classifier
 * Classifies voice commands and maps to actions
 */

class VoiceIntentClassifier {
  constructor() {
    // Voice-specific patterns with higher confidence for voice
    this.voicePatterns = {
      // Quick actions (common in voice)
      'quick_order': /\b(order|want|need|get|buy)\b.*\b(biryani|pizza|burger|food)\b/i,
      'track_order': /\b(track|where|status|find)\b.*\b(order|delivery)\b/i,
      'cancel_order': /\b(cancel|stop|abort)\b.*\b(order|delivery)\b/i,
      'speak_agent': /\b(speak|talk|connect)\b.*\b(agent|person|someone|human|operator)\b/i,
      'repeat': /\b(repeat|say again|what)\b/i,
      'slower': /\b(slow|slower)\b/i,
      'louder': /\b(loud|louder|speak up)\b/i,
      'help': /\b(help|assist|support)\b/i,

      // Restaurant patterns
      'restaurant_order': /\b(order|want)\b.*\b(delivery|pickup|takeout|dine.?in)\b/i,
      'restaurant_reserve': /\b(book|reserve|table|reservation)\b.*\b(for|at)\b/i,
      'restaurant_menu': /\b(menu|items|dishes|what do you have)\b/i,
      'restaurant_hours': /\b(hours|open|close|when)\b.*\b(restaurant|available)\b/i,
      'restaurant_location': /\b(address|location|where| directions)\b.*\b(restaurant|here)\b/i,

      // Booking patterns
      'book_slot': /\b(book|schedule|appointment)\b.*\b(at|for)\b/i,
      'reschedule': /\b(change|reschedule|move)\b.*\b(appointment|booking)\b/i,

      // Payment patterns
      'payment_issue': /\b(payment|pay|bill|charge)\b.*\b(issue|problem|wrong|failed)\b/i,
      'refund_status': /\b(refund|money back)\b.*\b(status|where|when)\b/i,

      // Complaint patterns
      'complaint': /\b(complaint|issue|problem|wrong|bad|terrible|worst)\b/i,
      'feedback': /\b(feedback|suggestion|improve)\b/i,

      // General
      'greeting': /\b(hi|hello|hey|good morning|good evening)\b/i,
      'goodbye': /\b(bye|thanks|thank you|goodbye|see you)\b/i,
      'affirmative': /\b(yes|yeah|yep|sure|ok|okay|go ahead)\b/i,
      'negative': /\b(no|nope|nah|don't|cancel|stop)\b/i
    };

    // Confidence thresholds
    this.HIGH_CONFIDENCE = 0.9;
    this.MEDIUM_CONFIDENCE = 0.7;
    this.LOW_CONFIDENCE = 0.5;
  }

  /**
   * Classify voice input
   */
  classify(text) {
    const results = [];

    for (const [intent, pattern] of Object.entries(this.voicePatterns)) {
      if (pattern.test(text)) {
        const confidence = this.calculateConfidence(intent, text);
        results.push({
          intent,
          confidence,
          matched: pattern.toString(),
          text
        });
      }
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    if (results.length === 0) {
      return {
        intent: 'unknown',
        confidence: 0,
        suggestions: this.getSuggestions(text)
      };
    }

    return results[0];
  }

  /**
   * Calculate confidence based on context
   */
  calculateConfidence(intent, text) {
    let confidence = this.MEDIUM_CONFIDENCE;

    // Boost for exact matches
    if (this.exactMatch(intent, text)) {
      confidence = this.HIGH_CONFIDENCE;
    }

    // Context-aware adjustments
    if (text.includes('please')) {
      confidence += 0.05;
    }

    if (text.includes('urgent') || text.includes('asap')) {
      confidence += 0.05;
    }

    return Math.min(confidence, 0.99);
  }

  /**
   * Check for exact intent match
   */
  exactMatch(intent, text) {
    const exactPatterns = {
      'quick_order': /^(order|want|need)\s+(.+)(\s+for\s+\w+)?$/i,
      'speak_agent': /^(speak|talk|connect)\s+to\s+(agent|someone)/i,
      'cancel_order': /^cancel\s+(my\s+)?order$/i,
      'greeting': /^(hi|hello|hey)$/i,
      'goodbye': /^(bye|thanks|thank\s+you)$/i
    };

    const pattern = exactPatterns[intent];
    return pattern ? pattern.test(text.trim()) : false;
  }

  /**
   * Get suggestions for unknown intent
   */
  getSuggestions(text) {
    return [
      'Try saying: "I want to order biryani"',
      'Try saying: "Track my order"',
      'Try saying: "Book a table"',
      'Try saying: "Speak to an agent"'
    ];
  }

  /**
   * Extract entities from voice input
   */
  extractEntities(text, intent) {
    const entities = {};

    // Extract time patterns
    const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      entities.time = {
        hour: parseInt(timeMatch[1]),
        minute: parseInt(timeMatch[2] || '0'),
        period: timeMatch[3]?.toLowerCase()
      };
    }

    // Extract date patterns
    const datePatterns = [
      /today/i,
      /tomorrow/i,
      /next\s+(week|month)/i,
      /(\d{1,2})(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i
    ];
    for (const pattern of datePatterns) {
      if (pattern.test(text)) {
        entities.date = pattern.toString().replace(/\//g, '');
        break;
      }
    }

    // Extract numbers
    const numberMatch = text.match(/(\d+)/);
    if (numberMatch) {
      entities.number = parseInt(numberMatch[1]);
    }

    // Extract food items
    const foodPatterns = /(biryani|pizza|burger|chicken|rice|curry|noodles|pasta|salad|soup|dessert|drink|beverage)/gi;
    const foods = text.match(foodPatterns);
    if (foods) {
      entities.foodItems = foods;
    }

    // Extract order type
    if (/delivery/i.test(text)) entities.orderType = 'delivery';
    if (/pickup|takeout/i.test(text)) entities.orderType = 'pickup';
    if (/dine.?in|restaurant/i.test(text)) entities.orderType = 'dine-in';

    return entities;
  }

  /**
   * Batch classify multiple utterances
   */
  classifyBatch(utterances) {
    return utterances.map(text => ({
      text,
      ...this.classify(text)
    }));
  }
}

module.exports = new VoiceIntentClassifier();
