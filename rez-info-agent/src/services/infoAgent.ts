import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf((info: winston.Logform.TransformableInfo) => {
  const { level, message, timestamp: ts, ...metadata } = info;
  let msg = `${ts} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  if (metadata.stack) {
    msg += `\n${metadata.stack}`;
  }
  return msg;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat)
    }),
    new winston.transports.File({
      filename: 'logs/info-agent-error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/info-agent.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

export enum InfoCategory {
  BOOKING = 'booking',
  PAYMENT = 'payment',
  CANCELLATION = 'cancellation',
  REFUND = 'refund',
  SHIPPING = 'shipping',
  ACCOUNT = 'account',
  LOYALTY = 'loyalty',
  TECHNICAL = 'technical',
  GENERAL = 'general',
  POLICIES = 'policies',
  CONTACT = 'contact',
  FAQ = 'faq'
}

export interface InfoResponse {
  success: boolean;
  message: string;
  faqs?: FAQ[];
  policies?: Policy[];
  articles?: Article[];
  guides?: Guide[];
  data?: Record<string, unknown>;
  processingTime?: number;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: InfoCategory;
  tags: string[];
  relatedFaqs: string[];
  viewCount: number;
  helpfulCount: number;
  lastUpdated: Date;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  content: string;
  category: InfoCategory;
  version: string;
  effectiveDate: Date;
  lastUpdated: Date;
  sections: PolicySection[];
}

export interface PolicySection {
  title: string;
  content: string;
  subsections?: PolicySection[];
}

export interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: InfoCategory;
  tags: string[];
  author: string;
  createdAt: Date;
  updatedAt: Date;
  viewCount: number;
  relatedArticles: string[];
}

export interface Guide {
  id: string;
  title: string;
  description: string;
  steps: GuideStep[];
  category: InfoCategory;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  tags: string[];
}

export interface GuideStep {
  step: number;
  title: string;
  description: string;
  tips?: string[];
  warnings?: string[];
}

export interface SearchParams {
  query: string;
  category?: InfoCategory;
  tags?: string[];
  limit?: number;
}

class InfoAgent {
  private readonly agentId: string;
  private readonly agentName: string;
  private searchHistory: Map<string, SearchResult[]>;

  constructor(agentId?: string, agentName?: string) {
    this.agentId = agentId || uuidv4();
    this.agentName = agentName || 'Info Agent';
    this.searchHistory = new Map();
    logger.info('Info Agent initialized', { agentId: this.agentId, agentName: this.agentName });
  }

  async processQuery(
    query: string,
    sessionId: string
  ): Promise<InfoResponse> {
    const startTime = Date.now();
    logger.info('Processing info query', { sessionId, queryLength: query.length });

    try {
      const intent = this.identifyIntent(query);
      let response: InfoResponse;

      switch (intent) {
        case 'search':
          response = await this.handleSearch(query);
          break;
        case 'policy':
          response = await this.handlePolicyQuery(query);
          break;
        case 'faq':
          response = await this.handleFaqQuery(query);
          break;
        case 'guide':
          response = await this.handleGuideQuery(query);
          break;
        case 'contact':
          response = await this.handleContactInfo(query);
          break;
        default:
          response = await this.handleGeneralQuery(query);
      }

      this.recordSearch(sessionId, query, response);
      response.processingTime = Date.now() - startTime;

      return response;

    } catch (error) {
      logger.error('Error processing query', { error, sessionId });
      throw error;
    }
  }

  private identifyIntent(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (this.matches(lowerQuery, ['policy', 'policies', 'terms', 'conditions', 'agreement'])) {
      return 'policy';
    }
    if (this.matches(lowerQuery, ['how do i', 'how to', 'guide', 'tutorial', 'steps'])) {
      return 'guide';
    }
    if (this.matches(lowerQuery, ['contact', 'email', 'phone', 'support', 'help', 'reach'])) {
      return 'contact';
    }
    if (this.matches(lowerQuery, ['faq', 'question', 'what is', 'why', 'when', 'where'])) {
      return 'faq';
    }
    if (this.matches(lowerQuery, ['search', 'find', 'look for', 'tell me about'])) {
      return 'search';
    }

    return 'general';
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private async handleSearch(query: string): Promise<InfoResponse> {
    const { searchKnowledgeBase } = await import('./knowledgeBase');

    const results = await searchKnowledgeBase(query);

    if (results.faqs.length === 0 && results.articles.length === 0 && results.policies.length === 0) {
      return {
        success: true,
        message: `I couldn't find specific information about "${query}". Here are some related topics that might help:\n\n${this.getRelatedTopics(query)}`,
        faqs: [],
        policies: [],
        articles: []
      };
    }

    let message = `Here's what I found for "${query}":\n\n`;

    if (results.faqs.length > 0) {
      message += `**Frequently Asked Questions:**\n`;
      for (const faq of results.faqs.slice(0, 3)) {
        message += `\n**Q: ${faq.question}**\n${faq.answer.substring(0, 150)}...\n`;
      }
      message += "\n";
    }

    if (results.articles.length > 0) {
      message += `**Helpful Articles:**\n`;
      for (const article of results.articles.slice(0, 2)) {
        message += `\n• ${article.title}\n${article.summary.substring(0, 100)}...\n`;
      }
      message += "\n";
    }

    if (results.policies.length > 0) {
      message += `**Related Policies:**\n`;
      for (const policy of results.policies.slice(0, 2)) {
        message += `\n• ${policy.name}\n`;
      }
    }

    return {
      success: true,
      message,
      faqs: results.faqs,
      policies: results.policies,
      articles: results.articles
    };
  }

  private async handlePolicyQuery(query: string): Promise<InfoResponse> {
    const { getPolicies } = await import('./knowledgeBase');

    const policies = getPolicies(query);

    if (policies.length === 0) {
      return {
        success: true,
        message: `I couldn't find a specific policy matching "${query}". Here are our available policies:\n\n${this.formatPolicyList()}`
      };
    }

    let message = `**Policy Information:**\n\n`;

    for (const policy of policies) {
      message += `**${policy.name}**\n`;
      message += `${policy.description}\n\n`;
      message += `**Key Points:**\n`;
      for (const section of policy.sections.slice(0, 3)) {
        message += `• ${section.title}: ${section.content.substring(0, 100)}...\n`;
      }
      message += `\n---\n\n`;
    }

    return {
      success: true,
      message,
      policies
    };
  }

  private async handleFaqQuery(query: string): Promise<InfoResponse> {
    const { getFaqs } = await import('./knowledgeBase');

    const faqs = await getFaqs(query);

    if (faqs.length === 0) {
      return {
        success: true,
        message: `I couldn't find an exact answer to your question about "${query}". Would you like me to:\n\n• Search for related topics\n• Connect you with our support team\n• Show you our most popular FAQs`
      };
    }

    let message = `**Frequently Asked Questions:**\n\n`;

    for (let i = 0; i < Math.min(faqs.length, 5); i++) {
      const faq = faqs[i];
      message += `**Q${i + 1}: ${faq.question}**\n\n${faq.answer}\n\n`;
      if (faq.tags.length > 0) {
        message += `Related: ${faq.tags.join(', ')}\n\n`;
      }
    }

    return {
      success: true,
      message,
      faqs
    };
  }

  private async handleGuideQuery(query: string): Promise<InfoResponse> {
    const { getGuides } = await import('./knowledgeBase');

    const guides = await getGuides(query);

    if (guides.length === 0) {
      return {
        success: true,
        message: `I couldn't find a guide for "${query}". Here are some available guides:\n\n${this.getAvailableGuides()}`
      };
    }

    let message = `**How-To Guide:**\n\n`;

    for (const guide of guides) {
      message += `## ${guide.title}\n\n`;
      message += `${guide.description}\n\n`;
      message += `**Difficulty:** ${guide.difficulty}\n`;
      message += `**Estimated Time:** ${guide.estimatedTime}\n\n`;
      message += `**Steps:**\n`;

      for (const step of guide.steps) {
        message += `\n**Step ${step.step}: ${step.title}**\n${step.description}\n`;
        if (step.tips && step.tips.length > 0) {
          message += `💡 Tips: ${step.tips.join(', ')}\n`;
        }
        if (step.warnings && step.warnings.length > 0) {
          message += `⚠️ Warnings: ${step.warnings.join(', ')}\n`;
        }
      }
    }

    return {
      success: true,
      message,
      guides
    };
  }

  private async handleContactInfo(query: string): Promise<InfoResponse> {
    const contactInfo = this.getContactInfo(query);

    let message = `**Contact Us**\n\n`;
    message += `We're here to help! Here are the ways you can reach us:\n\n`;
    message += `**📧 Email:**\n`;
    message += `• General Inquiries: hello@rez.com\n`;
    message += `• Support: support@rez.com\n`;
    message += `• Business: business@rez.com\n\n`;
    message += `**📞 Phone:**\n`;
    message += `• Customer Support: 1-800-REZ-HELP (1-800-739-4357)\n`;
    message += `• Available: Monday-Friday, 8AM-8PM EST\n\n`;
    message += `**💬 Live Chat:**\n`;
    message += `• Available 24/7 on our website\n\n`;
    message += `**🏢 Mailing Address:**\n`;
    message += `REZ Commerce\n`;
    message += `123 Travel Street\n`;
    message += `New York, NY 10001\n\n`;
    message += `**Response Times:**\n`;
    message += `• Email: Within 24 hours\n`;
    message += `• Phone: Immediate (during business hours)\n`;
    message += `• Chat: Immediate (24/7)\n`;

    return {
      success: true,
      message,
      data: { contactInfo }
    };
  }

  private async handleGeneralQuery(query: string): Promise<InfoResponse> {
    return {
      success: true,
      message: `Welcome to REZ Info! I can help you with:\n\n` +
        `**Frequently Asked Questions**\n` +
        `• How do I book a trip?\n` +
        `• What is your cancellation policy?\n` +
        `• How do I get a refund?\n\n` +
        `**Policies**\n` +
        `• Terms of Service\n` +
        `• Privacy Policy\n` +
        `• Refund Policy\n\n` +
        `**How-To Guides**\n` +
        `• Creating an account\n` +
        `• Making a booking\n` +
        `• Managing your trip\n\n` +
        `**Contact Support**\n` +
        `• Email, phone, or live chat\n\n` +
        `What would you like to know more about?`
    };
  }

  private getRelatedTopics(query: string): string {
    const topicMap: Record<string, string[]> = {
      'booking': ['How to book', 'Payment options', 'Confirmation'],
      'refund': ['Refund policy', 'Refund timeline', 'Cancellation'],
      'cancel': ['Cancellation policy', 'Refund eligibility', 'Date changes'],
      'account': ['Account settings', 'Password reset', 'Profile update'],
      'payment': ['Accepted payments', 'Currency', 'Pricing'],
      'loyalty': ['Points program', 'Tier benefits', 'Earn rewards']
    };

    const lowerQuery = query.toLowerCase();
    for (const [key, topics] of Object.entries(topicMap)) {
      if (lowerQuery.includes(key)) {
        return topics.map(t => `• ${t}`).join('\n');
      }
    }

    return '• How do I book a trip?\n• What is your cancellation policy?\n• How do I contact support?';
  }

  private formatPolicyList(): string {
    return `**Available Policies:**\n` +
      `• Terms of Service\n` +
      `• Privacy Policy\n` +
      `• Refund Policy\n` +
      `• Cancellation Policy\n` +
      `• Cookie Policy\n` +
      `• Accessibility Policy`;
  }

  private getAvailableGuides(): string {
    return `**Available Guides:**\n` +
      `• How to Create an Account\n` +
      `• How to Book Your First Trip\n` +
      `• How to Manage Your Booking\n` +
      `• How to Cancel a Reservation\n` +
      `• How to Request a Refund\n` +
      `• How to Use Loyalty Points\n` +
      `• How to Update Your Profile`;
  }

  private getContactInfo(query: string): Record<string, unknown> {
    return {
      email: {
        general: 'hello@rez.com',
        support: 'support@rez.com',
        business: 'business@rez.com'
      },
      phone: {
        number: '1-800-739-4357',
        hours: 'Monday-Friday, 8AM-8PM EST',
        supportType: 'Customer Support'
      },
      chat: {
        available: true,
        hours: '24/7',
        averageWaitTime: '< 2 minutes'
      },
      address: {
        company: 'REZ Commerce',
        street: '123 Travel Street',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'USA'
      }
    };
  }

  private recordSearch(sessionId: string, query: string, response: InfoResponse): void {
    const result: SearchResult = {
      query,
      timestamp: new Date(),
      resultCount: (response.faqs?.length || 0) + (response.policies?.length || 0) + (response.articles?.length || 0)
    };

    const history = this.searchHistory.get(sessionId) || [];
    history.push(result);

    if (history.length > 50) {
      history.shift();
    }

    this.searchHistory.set(sessionId, history);
  }

  async getPopularFaqs(limit: number = 10): Promise<FAQ[]> {
    const { getFaqs } = await import('./knowledgeBase');
    const allFaqs = await getFaqs('');
    return allFaqs.sort((a, b) => b.viewCount - a.viewCount).slice(0, limit);
  }

  async getPopularArticles(limit: number = 10): Promise<Article[]> {
    const { searchKnowledgeBase } = await import('./knowledgeBase');
    const results = await searchKnowledgeBase('');
    return results.articles.sort((a, b) => b.viewCount - a.viewCount).slice(0, limit);
  }

  async markFaqHelpful(faqId: string): Promise<boolean> {
    logger.info('FAQ marked helpful', { faqId });
    return true;
  }

  async trackFaqView(faqId: string): Promise<void> {
    logger.info('FAQ viewed', { faqId });
  }
}

interface SearchResult {
  query: string;
  timestamp: Date;
  resultCount: number;
}

export const infoAgent = new InfoAgent();
