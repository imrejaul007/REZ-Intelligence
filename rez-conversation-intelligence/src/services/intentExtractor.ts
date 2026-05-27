import { SentimentAnalyzer } from 'sentiment';
import natural from 'natural';
import compromise from 'compromise';
import { config } from '../config/index.js';
import logger from './utils/logger.js';
import { Intent } from '../utils/validators.js';

// Core intent patterns for commerce platform
const INTENT_PATTERNS: Record<string, RegExp[]> = {
  'product_inquiry': [
    /\b(what|which|how|where|when|who)\b.*\b(product|item|item|service)\b/i,
    /\b(price|cost|amount|fee|charge)\b/i,
    /\b(specification|feature|detail|description)\b/i,
    /\b(available|in stock|availability)\b/i,
  ],
  'order_status': [
    /\b(order|purchase|transaction)\b.*\b(status|track|tracking|progress)\b/i,
    /\b(where|when)\b.*\b(arrive|deliver|ship|shipment)\b/i,
    /\b(delivery|shipping)\b.*\b(date|time|eta)\b/i,
    /\border\s*(#|number|no\.?)?\s*[\w\d-]+/i,
  ],
  'payment_issue': [
    /\b(payment|transaction|pay)\b.*\b(fail|error|problem|issue|reject|decline)\b/i,
    /\b(card|credit|debit)\b.*\b(denied|decline|failed)\b/i,
    /\b(pay|checkout)\b.*\b(not working|error|stuck)\b/i,
    /\brefund\b.*\b(status|when|where)\b/i,
  ],
  'cancellation': [
    /\b(cancel|cancellation|stop)\b.*\b(order|purchase|subscription|plan)\b/i,
    /\b(terminate|end)\b.*\b(service|subscription|account)\b/i,
    /\bdon't\s+want\s+(to\s+)?(order|buy|purchase)\b/i,
    /\bchange\s+my\s+mind\b/i,
  ],
  'return_exchange': [
    /\b(return|refund|exchange|replace|swap)\b/i,
    /\b(send\s+back|get\s+back|gave\s+back)\b/i,
    /\b(wrong|defective|damaged|broken)\b.*\b(item|product|package)\b/i,
    /\b(item|product)\b.*\b(not\s+as\s+described|wrong\s+size|different)\b/i,
  ],
  'complaint': [
    /\b(complaint|issue|problem|wrong|bad|terrible|awful|frustrated)\b/i,
    /\b(not\s+happy|not\s+satisfied|disappointed|angry)\b/i,
    /\b(unacceptable|ridiculous|outrageous)\b/i,
    /\b(speaking\s+to|ask\s+for|want\s+to)\b.*\b(manager|supervisor|escalate)\b/i,
  ],
  'greeting': [
    /\b(hi|hello|hey|good\s+morning|good\s+afternoon|good\s+evening)\b/i,
    /\bhow\s+(are\s+you|do\s+you\s+do)\b/i,
  ],
  'farewell': [
    /\b(bye|goodbye|see\s+you|take\s+care|thanks|thank\s+you)\b/i,
    /\b(that'?s?\s+all|done|finished)\b/i,
  ],
  'account_help': [
    /\b(account|login|sign\s+in|password|reset|forgot)\b/i,
    /\b(update\s+(my\s+)?account|change\s+(my\s+)?email|phone)\b/i,
  ],
  'shipping_inquiry': [
    /\b(shipping|delivery|shipping\s+cost|delivery\s+time|free\s+shipping)\b/i,
    /\b(deliver|shipping)\b.*\b(to|address|location)\b/i,
    /\b(express|standard|overnight|same\s+day)\s*(delivery|shipping)\b/i,
  ],
  'discount_promo': [
    /\b(discount|coupon|code|promo|promotion|offer|deal|sale)\b/i,
    /\b(percent\s+off|%\s+off|save\s+\$|free\s+shipping)\b/i,
    /\b(membership|member|loyalty|reward|point)\b/i,
  ],
  'technical_support': [
    /\b(technical|tech|support|help|issue|problem|error|bug)\b/i,
    /\b(app|website|platform|system)\b.*\b(not\s+working|crash|freeze|slow)\b/i,
    /\b(update|upgrade|install|download)\b.*\b(issue|problem|error)\b/i,
  ],
  'feedback': [
    /\b(feedback|review|rate|rating|suggestion|recommend)\b/i,
    /\b(tell\s+us|share|your\s+(thought|opinion|experience))\b/i,
  ],
  'reservation': [
    /\b(reserv|book|appointment|schedule)\b/i,
    /\b(table|room|seat|slot|time)\b/i,
    /\b(available|book|reserve)\b.*\b(date|time)\b/i,
  ],
};

// NLP-based intent extraction using keyword extraction
const TfIdf = natural.TfIdf;

export class IntentExtractor {
  private sentiment: SentimentAnalyzer;
  private tfidf: TfIdf;
  private confidenceThreshold: number;

  constructor() {
    this.sentiment = new SentimentAnalyzer({ type: 'afinn' });
    this.tfidf = new TfIdf();
    this.confidenceThreshold = config.INTENT_CONFIDENCE_THRESHOLD;

    // Build TF-IDF model from intent patterns
    this.buildIntentModel();
  }

  private buildIntentModel(): void {
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      const documents: string[] = [];

      for (const pattern of patterns) {
        // Generate sample texts from patterns
        documents.push(pattern.source);
      }

      // Add intent name and variations
      documents.push(intent.replace(/_/g, ' '));

      this.tfidf.addDocument(documents.join(' '));
    }
  }

  async extract(text: string): Promise<Intent> {
    try {
      // Use pattern matching first for high-confidence matches
      const patternResults = this.matchPatterns(text);

      if (patternResults.length > 0 && patternResults[0].confidence >= 0.8) {
        return patternResults[0];
      }

      // Fall back to TF-IDF based extraction
      const tfidfResults = this.extractWithTfidf(text);

      // Combine results
      if (patternResults.length > 0 && tfidfResults) {
        // Use pattern match if it's higher confidence
        if (patternResults[0].confidence >= tfidfResults.confidence) {
          return {
            ...patternResults[0],
            alternatives: tfidfResults.alternatives || [],
          };
        }
        return {
          ...tfidfResults,
          alternatives: patternResults.map((p) => ({
            name: p.name,
            confidence: p.confidence,
          })),
        };
      }

      if (patternResults.length > 0) {
        return patternResults[0];
      }

      if (tfidfResults) {
        return tfidfResults;
      }

      // Default to general inquiry
      return {
        name: 'general_inquiry',
        confidence: 0.3,
      };
    } catch (error) {
      logger.error('Intent extraction failed', { error: (error as Error).message, text: text.slice(0, 100) });
      return {
        name: 'unknown',
        confidence: 0,
      };
    }
  }

  private matchPatterns(text: string): Array<{ name: string; confidence: number }> {
    const results: Array<{ name: string; confidence: number }> = [];

    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      let matchCount = 0;

      for (const pattern of patterns) {
        if (pattern.test(text)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const confidence = Math.min(0.5 + (matchCount * 0.15), 0.95);
        results.push({ name: intent, confidence });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private extractWithTfidf(text: string): Intent | null {
    try {
      // Extract key terms using NLP
      const doc = compromise(text);
      const nouns = doc.nouns().out('array') as string[];
      const verbs = doc.verbs().out('array') as string[];
      const keywords = [...nouns, ...verbs].slice(0, 5);

      if (keywords.length === 0) {
        return null;
      }

      // Score against known intents
      const scores: Record<string, number> = {};

      for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
        let score = 0;
        for (const keyword of keywords) {
          for (const pattern of patterns) {
            if (pattern.test(keyword)) {
              score += 0.3;
            }
          }
          // Also check if keyword appears in intent name
          if (intent.replace(/_/g, ' ').includes(keyword.toLowerCase())) {
            score += 0.2;
          }
        }
        scores[intent] = Math.min(score, 0.9);
      }

      const sortedIntents = Object.entries(scores)
        .filter(([_, score]) => score > 0.1)
        .sort((a, b) => b[1] - a[1]);

      if (sortedIntents.length === 0) {
        return null;
      }

      const [topIntent, topScore] = sortedIntents[0];
      const alternatives = sortedIntents
        .slice(1, 4)
        .map(([name, confidence]) => ({ name, confidence }));

      return {
        name: topIntent,
        confidence: topScore,
        alternatives: alternatives.length > 0 ? alternatives : undefined,
      };
    } catch (error) {
      logger.warn('TF-IDF extraction failed', { error: (error as Error).message });
      return null;
    }
  }

  async extractBatch(texts: string[]): Promise<Intent[]> {
    return Promise.all(texts.map((text) => this.extract(text)));
  }

  getKnownIntents(): string[] {
    return Object.keys(INTENT_PATTERNS);
  }

  addCustomIntent(name: string, patterns: RegExp[]): void {
    INTENT_PATTERNS[name] = patterns;
    this.buildIntentModel();
    logger.info('Custom intent added', { name, patternCount: patterns.length });
  }
}

export const intentExtractor = new IntentExtractor();
