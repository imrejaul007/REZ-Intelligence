/**
 * REZ Conversation Intelligence - Topic Modeling Service
 *
 * Identifies and classifies conversation topics using LDA and keyword extraction.
 * Supports commerce-specific categories and real-time classification.
 *
 * Port: Part of REZ-Conversation-Intelligence
 */

import natural from 'natural';
import logger from './utils/logger.js';
import { config } from '../config/index.js';

const { TfIdf, LDA, Tokenizer, Stemmer, BayesClassifier } = natural;

// ============================================================================
// Types
// ============================================================================

export interface Topic {
  id: string;
  name: string;
  keywords: string[];
  confidence: number;
  category: string;
  subcategory?: string;
}

export interface TopicClassification {
  conversationId: string;
  topics: Topic[];
  primaryTopic: Topic | null;
  topicDistribution: Record<string, number>;
  classifiedAt: Date;
}

export interface TopicTrend {
  topicId: string;
  topicName: string;
  counts: Array<{
    date: string;
    count: number;
    percentage: number;
  }>;
  trend: 'rising' | 'stable' | 'declining';
  changePercentage: number;
}

// ============================================================================
// Commerce-Specific Topic Categories
// ============================================================================

const COMMERCE_TOPICS = {
  billing: {
    name: 'Billing & Payments',
    keywords: ['payment', 'invoice', 'billing', 'charge', 'refund', 'transaction', 'price', 'cost', 'fee', 'subscription', 'plan', 'credit', 'debit', 'upi', 'netbanking', 'wallet'],
    subcategories: ['payment_issue', 'billing_inquiry', 'subscription', 'pricing']
  },
  shipping: {
    name: 'Shipping & Delivery',
    keywords: ['delivery', 'shipping', 'track', 'order', 'package', 'courier', 'dispatch', 'transit', 'delivered', 'delay', 'address', 'location'],
    subcategories: ['delivery_status', 'shipping_inquiry', 'address_change', 'tracking']
  },
  support: {
    name: 'Customer Support',
    keywords: ['help', 'support', 'issue', 'problem', 'complaint', 'agent', 'representative', 'escalate', 'manager', 'ticket', 'case'],
    subcategories: ['technical_support', 'product_support', 'general_inquiry', 'complaint']
  },
  sales: {
    name: 'Sales & Orders',
    keywords: ['order', 'purchase', 'buy', 'cart', 'checkout', 'discount', 'offer', 'deal', 'promotion', 'coupon', 'product', 'item'],
    subcategories: ['order_placement', 'product_inquiry', 'discount_request', 'cross_sell']
  },
  returns: {
    name: 'Returns & Exchanges',
    keywords: ['return', 'exchange', 'replace', 'refund', 'cancel', 'wrong_item', 'damaged', 'defective', 'not_as_described', 'size_issue'],
    subcategories: ['return_request', 'exchange_request', 'refund_status', 'return_policy']
  },
  account: {
    name: 'Account & Profile',
    keywords: ['account', 'login', 'password', 'profile', 'email', 'phone', 'update', 'change', 'reset', 'verify', 'authenticate'],
    subcategories: ['login_issue', 'profile_update', 'verification', 'authentication']
  },
  loyalty: {
    name: 'Loyalty & Rewards',
    keywords: ['points', 'rewards', 'loyalty', 'cashback', 'coins', 'membership', 'tier', 'gold', 'platinum', 'referral', 'bonus'],
    subcategories: ['points_inquiry', 'redemption', 'loyalty_program', 'referral']
  },
  feedback: {
    name: 'Feedback & Reviews',
    keywords: ['feedback', 'review', 'rating', 'suggestion', 'experience', 'opinion', 'rate', 'stars', 'testimonial'],
    subcategories: ['review_request', 'feedback_submission', 'rating_issue']
  },
  technical: {
    name: 'Technical Issues',
    keywords: ['error', 'bug', 'crash', 'not_working', 'loading', 'slow', 'freeze', 'app', 'website', 'server', 'api'],
    subcategories: ['app_issue', 'website_issue', 'payment_gateway', 'integration']
  },
  general: {
    name: 'General Inquiry',
    keywords: ['information', 'details', 'how', 'what', 'when', 'where', 'why', 'about', 'timing', 'hours', 'location'],
    subcategories: ['business_hours', 'location', 'general_info']
  }
};

// ============================================================================
// Stopwords (common words to exclude)
// ============================================================================

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'want', 'like',
  'just', 'also', 'so', 'than', 'that', 'this', 'these', 'those', 'it', 'its',
  'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'our', 'their', 'what', 'which', 'who', 'whom', 'how',
  'when', 'where', 'why', 'is', 'it', 'are', 'was', 'were', 'be', 'been'
]);

// ============================================================================
// Topic Modeling Service
// ============================================================================

export class TopicModelingService {
  private tfidf: TfIdf;
  private tokenizer: Tokenizer;
  private lda: LDA;
  private classifier: BayesClassifier;
  private isClassifierTrained: boolean = false;
  private topicCache: Map<string, TopicClassification> = new Map();

  constructor() {
    this.tfidf = new TfIdf();
    this.tokenizer = new Tokenizer();
    this.lda = new LDA();
    this.classifier = new BayesClassifier();

    // Initialize pre-trained classifier for commerce topics
    this.initializeClassifier();
  }

  /**
   * Initialize the Bayes classifier with commerce topics
   */
  private initializeClassifier(): void {
    try {
      // Train with commerce topic examples
      for (const [category, topic] of Object.entries(COMMERCE_TOPICS)) {
        // Add training examples for each topic
        const examples = this.generateTrainingExamples(topic.keywords, category);
        examples.forEach(example => {
          this.classifier.addDocument(example.text, example.label);
        });
      }

      this.classifier.train();
      this.isClassifierTrained = true;
      logger.info('Topic classifier initialized', {
        topics: Object.keys(COMMERCE_TOPICS).length
      });
    } catch (error) {
      logger.error('Failed to initialize topic classifier', {
        error: (error as Error).message
      });
      this.isClassifierTrained = false;
    }
  }

  /**
   * Generate training examples from keywords
   */
  private generateTrainingExamples(
    keywords: string[],
    category: string
  ): Array<{ text: string; label: string }> {
    const examples: Array<{ text: string; label: string }> = [];

    // Generate phrases from keywords
    const phrases = [
      keywords.slice(0, 3).join(' '),
      keywords[0] + ' ' + keywords[1],
      'about ' + keywords[0],
      keywords[0] + ' related',
      keywords[0] + ' and ' + keywords[1],
    ];

    phrases.forEach(phrase => {
      examples.push({ text: phrase, label: category });
    });

    return examples;
  }

  /**
   * Extract keywords using TF-IDF
   */
  private extractKeywords(text: string, topN: number = 10): string[] {
    const tokens = this.tokenize(text);
    const filteredTokens = tokens.filter(t =>
      t.length > 2 &&
      !STOPWORDS.has(t.toLowerCase()) &&
      !/^\d+$/.test(t)
    );

    // Build TF-IDF
    this.tfidf.addDocument(filteredTokens.join(' '));

    const keywords: Array<{ term: string; tfidf: number }> = [];
    this.tfidf.listTerms(0).forEach(item => {
      keywords.push({ term: item.term, tfidf: item.tfidf });
    });

    return keywords
      .sort((a, b) => b.tfidf - a.tfidf)
      .slice(0, topN)
      .map(k => k.term);
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    // Simple tokenization - split on whitespace and remove punctuation
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  /**
   * Classify text into commerce topics
   */
  private classifyTopic(text: string): Topic | null {
    if (!this.isClassifierTrained) {
      return this.classifyByKeywordMatch(text);
    }

    try {
      const classifications = this.classifier.getClassifications(text);
      if (classifications.length === 0) {
        return this.classifyByKeywordMatch(text);
      }

      const topClassification = classifications[0];
      const category = topClassification.label as keyof typeof COMMERCE_TOPICS;
      const topicData = COMMERCE_TOPICS[category];

      if (!topicData) {
        return this.classifyByKeywordMatch(text);
      }

      return {
        id: `topic_${category}`,
        name: topicData.name,
        keywords: topicData.keywords.slice(0, 5),
        confidence: topClassification.value,
        category: category
      };
    } catch (error) {
      logger.warn('Classifier failed, using keyword matching', {
        error: (error as Error).message
      });
      return this.classifyByKeywordMatch(text);
    }
  }

  /**
   * Fallback classification using keyword matching
   */
  private classifyByKeywordMatch(text: string): Topic | null {
    const lowerText = text.toLowerCase();
    const scores: Record<string, number> = {};

    for (const [category, topicData] of Object.entries(COMMERCE_TOPICS)) {
      let score = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of topicData.keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          score += 1;
          matchedKeywords.push(keyword);
        }
      }

      if (score > 0) {
        scores[category] = score / topicData.keywords.length;
      }
    }

    if (Object.keys(scores).length === 0) {
      return {
        id: 'topic_general',
        name: 'General Inquiry',
        keywords: [],
        confidence: 0.3,
        category: 'general'
      };
    }

    const topCategory = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])[0][0];

    const topicData = COMMERCE_TOPICS[topCategory as keyof typeof COMMERCE_TOPICS];
    return {
      id: `topic_${topCategory}`,
      name: topicData.name,
      keywords: topicData.keywords.slice(0, 5),
      confidence: scores[topCategory],
      category: topCategory
    };
  }

  /**
   * Classify a conversation
   */
  async classifyConversation(
    conversationId: string,
    messages: Array<{ content: string; senderType: string }>
  ): Promise<TopicClassification> {
    try {
      // Combine all message content
      const fullText = messages.map(m => m.content).join(' ');

      // Extract keywords
      const keywords = this.extractKeywords(fullText);

      // Classify primary topic
      const primaryTopic = this.classifyTopic(fullText);

      // Classify message-level topics
      const topics: Topic[] = [];
      const topicDistribution: Record<string, number> = {};
      let totalMessages = messages.length;

      for (let i = 0; i < messages.length; i++) {
        const messageTopic = this.classifyTopic(messages[i].content);
        if (messageTopic) {
          topics.push(messageTopic);

          // Count topic distribution
          topicDistribution[messageTopic.category] =
            (topicDistribution[messageTopic.category] || 0) + 1;
        }
      }

      // Normalize distribution
      for (const topic in topicDistribution) {
        topicDistribution[topic] = Math.round(
          (topicDistribution[topic] / totalMessages) * 100
        ) / 100;
      }

      const classification: TopicClassification = {
        conversationId,
        topics,
        primaryTopic,
        topicDistribution,
        classifiedAt: new Date()
      };

      // Cache result
      this.topicCache.set(conversationId, classification);

      logger.debug('Conversation classified', {
        conversationId,
        primaryTopic: primaryTopic?.name,
        topicCount: topics.length
      });

      return classification;
    } catch (error) {
      logger.error('Topic classification failed', {
        conversationId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Classify single text
   */
  async classifyText(text: string): Promise<Topic> {
    const topic = this.classifyTopic(text);
    return topic || {
      id: 'topic_unknown',
      name: 'Unknown',
      keywords: [],
      confidence: 0,
      category: 'unknown'
    };
  }

  /**
   * Get topic trends over time
   */
  getTopicTrends(
    topicClassifications: TopicClassification[],
    period: 'day' | 'week' | 'month' = 'day'
  ): TopicTrend[] {
    const topicCounts: Record<string, Record<string, number>> = {};
    const topicNames: Record<string, string> = {};

    // Count topics by period
    for (const classification of topicClassifications) {
      const dateKey = this.getDateKey(classification.classifiedAt, period);

      for (const topic of classification.topics) {
        if (!topicCounts[topic.category]) {
          topicCounts[topic.category] = {};
          topicNames[topic.category] = topic.name;
        }

        topicCounts[topic.category][dateKey] =
          (topicCounts[topic.category][dateKey] || 0) + 1;
      }
    }

    // Calculate trends
    const trends: TopicTrend[] = [];

    for (const [category, counts] of Object.entries(topicCounts)) {
      const dates = Object.keys(counts).sort();
      const total = Object.values(counts).reduce((a, b) => a + b, 0);

      const trendCounts = dates.map(date => ({
        date,
        count: counts[date],
        percentage: Math.round((counts[date] / total) * 100)
      }));

      // Calculate trend direction
      let trend: 'rising' | 'stable' | 'declining' = 'stable';
      let changePercentage = 0;

      if (dates.length >= 2) {
        const firstCount = counts[dates[0]];
        const lastCount = counts[dates[dates.length - 1]];
        changePercentage = firstCount > 0
          ? Math.round(((lastCount - firstCount) / firstCount) * 100)
          : 0;

        if (changePercentage > 10) trend = 'rising';
        else if (changePercentage < -10) trend = 'declining';
      }

      trends.push({
        topicId: `topic_${category}`,
        topicName: topicNames[category] || category,
        counts: trendCounts,
        trend,
        changePercentage
      });
    }

    return trends.sort((a, b) =>
      (b.counts[b.counts.length - 1]?.count || 0) -
      (a.counts[a.counts.length - 1]?.count || 0)
    );
  }

  /**
   * Get date key for grouping
   */
  private getDateKey(date: Date, period: 'day' | 'week' | 'month'): string {
    const d = new Date(date);
    switch (period) {
      case 'day':
        return d.toISOString().split('T')[0];
      case 'week':
        const weekNum = Math.ceil((d.getDate()) / 7);
        return `${d.getFullYear()}-W${weekNum}`;
      case 'month':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  /**
   * Get all available topic categories
   */
  getTopicCategories(): Array<{ id: string; name: string; keywords: string[] }> {
    return Object.entries(COMMERCE_TOPICS).map(([id, data]) => ({
      id: `topic_${id}`,
      name: data.name,
      keywords: data.keywords
    }));
  }

  /**
   * Clear topic cache
   */
  clearCache(): void {
    this.topicCache.clear();
    logger.info('Topic cache cleared');
  }

  /**
   * Get cached classification
   */
  getCachedClassification(conversationId: string): TopicClassification | undefined {
    return this.topicCache.get(conversationId);
  }
}

// Export singleton instance
export const topicModeling = new TopicModelingService();
export default topicModeling;
