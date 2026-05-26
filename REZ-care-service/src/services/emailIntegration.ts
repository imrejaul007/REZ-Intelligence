/**
 * REZ Care - Email Integration Service
 *
 * Handles incoming support emails:
 * - Parse email content
 * - Detect intent/sentiment
 * - Create tickets
 * - Auto-respond with helpful info
 * - Route to experts
 * - Escalate if needed
 */

import { logger } from '../utils/logger.js';
import { mlIntelligence } from './mlIntelligence';
import { getAIIntegration } from './aiIntegrationService';
import { getExpertRouter } from './expertRouter';

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: string[];
  date: string;
  messageId: string;
  inReplyTo?: string;
}

export interface ParsedEmail {
  email: EmailMessage;
  customerEmail: string;
  customerName?: string;
  subject: string;
  body: string;
  intent?: string;
  sentiment?: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  language?: string;
  attachments?: string[];
  isReply: boolean;
  threadId?: string;
}

export interface EmailResponse {
  to: string;
  subject: string;
  body: string;
  html?: string;
  ticketId?: string;
}

/**
 * Email Integration Service
 */
class EmailIntegration {
  private aiIntegration = getAIIntegration();
  private expertRouter = getExpertRouter();

  /**
   * Process incoming email
   */
  async processEmail(rawEmail: EmailMessage): Promise<ParsedEmail & { actions: string[] }> {
    const actions: string[] = [];

    // 1. Parse the email
    const parsed = await this.parseEmail(rawEmail);
    actions.push('email_parsed');

    // 2. Detect language
    parsed.language = this.detectLanguage(parsed.body);
    actions.push(`language_detected:${parsed.language}`);

    // 3. Analyze sentiment
    const sentimentResult = await mlIntelligence.analyzeSentiment(parsed.body);
    parsed.sentiment = sentimentResult.sentiment;
    if (sentimentResult.sentiment === 'critical_negative') {
      parsed.priority = 'urgent';
    }
    actions.push(`sentiment:${parsed.sentiment}`);

    // 4. Detect intent
    const intentResult = await this.detectIntent(parsed.body);
    parsed.intent = intentResult.intent;
    parsed.category = intentResult.category;
    actions.push(`intent:${parsed.intent}`);

    // 5. Determine priority
    if (!parsed.priority) {
      parsed.priority = this.calculatePriority(parsed);
    }
    actions.push(`priority:${parsed.priority}`);

    // 6. Route to expert if category detected
    if (parsed.category) {
      try {
        const expertResponse = await this.expertRouter.route(parsed.body, {
          platform: 'email',
          category: parsed.category,
        });
        if (expertResponse.source === 'expert') {
          actions.push(`routed_to_expert:${expertResponse.expertType}`);
        }
      } catch (e) {
        logger.warn('[Email] Expert routing failed', e);
      }
    }

    return { ...parsed, actions };
  }

  /**
   * Parse email content
   */
  private async parseEmail(email: EmailMessage): Promise<ParsedEmail> {
    // Extract customer email
    const customerEmail = this.extractEmail(email.from);

    // Extract customer name (if available)
    const customerName = this.extractName(email.from);

    // Clean body (remove quoted text, signatures)
    const cleanBody = this.cleanBody(email.body);

    // Check if this is a reply
    const isReply = !!email.inReplyTo || this.isReply(email.subject);

    return {
      email,
      customerEmail,
      customerName,
      subject: this.cleanSubject(email.subject),
      body: cleanBody,
      isReply,
      threadId: email.inReplyTo,
    };
  }

  /**
   * Extract email address from "Name <email>" format
   */
  private extractEmail(from: string): string {
    const match = from.match(/<([^>]+)>/) || [null, from];
    return match[1].trim().toLowerCase();
  }

  /**
   * Extract name from "Name <email>" format
   */
  private extractName(from: string): string | undefined {
    const match = from.match(/^([^<]+)</);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Clean subject line
   */
  private cleanSubject(subject: string): string {
    return subject
      .replace(/^(RE:|Fwd?:|Re:)/gi, '')
      .replace(/\[.*?\]/g, '')
      .trim();
  }

  /**
   * Clean email body
   */
  private cleanBody(body: string): string {
    // Remove quoted text
    let cleaned = body
      .split('\n')
      .filter(line => !line.startsWith('>'))
      .join('\n');

    // Remove common signatures
    const sigPatterns = [
      /--\s*$/,
      /___\s*$/,
      /Best regards,/i,
      /Thanks,/i,
      /Sent from my/i,
    ];

    for (const pattern of sigPatterns) {
      cleaned = cleaned.split(pattern)[0];
    }

    return cleaned.trim();
  }

  /**
   * Check if email is a reply
   */
  private isReply(subject: string): boolean {
    return /^(RE:|Fwd?:|Re:)/i.test(subject);
  }

  /**
   * Detect language
   */
  private detectLanguage(text: string): string {
    // Simple language detection
    const patterns = {
      hi: /\b(namaste|namaskar|kaise|kya|hai)\b/i,
      en: /\b(the|is|are|have|has|you|your)\b/i,
      ta: /\b(epdi|ungal|naan|thangal)\b/i,
      te: /\b(ela| nuvvu| nenu)\b/i,
      bn: /\b(tumi|ami|ki|ke)\b/i,
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) return lang;
    }

    return 'en';
  }

  /**
   * Detect intent from email content
   */
  private async detectIntent(body: string): Promise<{ intent: string; category: string }> {
    const lower = body.toLowerCase();

    // Cancellation
    if (lower.includes('cancel') || lower.includes('cancelled') || lower.includes('want to cancel')) {
      return { intent: 'cancellation', category: 'order' };
    }

    // Refund
    if (lower.includes('refund') || lower.includes('money back') || lower.includes('return')) {
      return { intent: 'refund', category: 'payment' };
    }

    // Delivery
    if (lower.includes('delivery') || lower.includes('shipping') || lower.includes('not received')) {
      return { intent: 'delivery', category: 'delivery' };
    }

    // Payment issue
    if (lower.includes('payment') || lower.includes('transaction') || lower.includes('failed')) {
      return { intent: 'payment_issue', category: 'payment' };
    }

    // Technical
    if (lower.includes('error') || lower.includes('not working') || lower.includes('bug')) {
      return { intent: 'technical', category: 'technical' };
    }

    // Complaint
    if (lower.includes('complaint') || lower.includes('worst') || lower.includes('terrible')) {
      return { intent: 'complaint', category: 'other' };
    }

    // Feedback
    if (lower.includes('feedback') || lower.includes('suggestion') || lower.includes('improve')) {
      return { intent: 'feedback', category: 'other' };
    }

    // General inquiry
    return { intent: 'inquiry', category: 'other' };
  }

  /**
   * Calculate priority based on content
   */
  private calculatePriority(parsed: ParsedEmail): 'low' | 'medium' | 'high' | 'urgent' {
    const lower = parsed.body.toLowerCase();

    // Urgent keywords
    if (/urgent|immediately|asap|emergency|critical/.test(lower)) {
      return 'urgent';
    }

    // High priority
    if (/(cancel|complaint|lawyer|legal|media|news)/.test(lower)) {
      return 'high';
    }

    // Medium priority
    if (/(question|help|information|inquiry)/.test(lower)) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Generate auto-response
   */
  async generateAutoResponse(parsed: ParsedEmail): Promise<EmailResponse> {
    const greeting = parsed.customerName
      ? `Hi ${parsed.customerName},\n\n`
      : `Hi,\n\n`;

    // Escalation response for urgent
    if (parsed.priority === 'urgent') {
      return {
        to: parsed.customerEmail,
        subject: `Re: ${parsed.subject}`,
        body: `${greeting}Thank you for reaching out. Your message has been marked as urgent and our team is prioritizing it.\n\nOur support team will respond within 2 hours.\n\nTicket ID: ${parsed.threadId || 'NEW'}\n\nBest regards,\nReZ Support Team`,
      };
    }

    // Category-specific responses
    const categoryResponses: Record<string, { subject: string; body: string }> = {
      order: {
        subject: `Re: ${parsed.subject}`,
        body: `${greeting}Thank you for contacting us about your order.\n\nWe've received your message and our team is looking into it. You'll receive a response within 24 hours.\n\nIn the meantime, you can track your order status in our app.\n\nTicket ID: ${parsed.threadId || 'NEW'}\n\nBest regards,\nReZ Support Team`,
      },
      payment: {
        subject: `Re: ${parsed.subject}`,
        body: `${greeting}Thank you for contacting us about your payment.\n\nOur billing team will review your case and respond within 12 hours.\n\nIf you need immediate assistance, please call our helpline.\n\nTicket ID: ${parsed.threadId || 'NEW'}\n\nBest regards,\nReZ Support Team`,
      },
      delivery: {
        subject: `Re: ${parsed.subject}`,
        body: `${greeting}Thank you for reaching out about your delivery.\n\nWe'll check the status of your order and provide an update within 4 hours.\n\nYou can also track your delivery in real-time through our app.\n\nTicket ID: ${parsed.threadId || 'NEW'}\n\nBest regards,\nReZ Support Team`,
      },
      other: {
        subject: `Re: ${parsed.subject}`,
        body: `${greeting}Thank you for contacting ReZ Support.\n\nWe've received your message and our team will respond within 24 hours.\n\nTicket ID: ${parsed.threadId || 'NEW'}\n\nBest regards,\nReZ Support Team`,
      },
    };

    const response = categoryResponses[parsed.category || 'other'];

    return {
      to: parsed.customerEmail,
      subject: response.subject,
      body: response.body,
    };
  }

  /**
   * Generate AI-powered response
   */
  async generateAIResponse(parsed: ParsedEmail): Promise<EmailResponse> {
    try {
      const response = await this.aiIntegration.getChatResponse(parsed.body, {
        customerId: parsed.customerEmail,
        platform: 'email',
        category: parsed.category,
      });

      return {
        to: parsed.customerEmail,
        subject: `Re: ${parsed.subject}`,
        body: response?.response || 'Thank you for contacting us. Our team will respond shortly.',
        ticketId: parsed.threadId,
      };
    } catch (error) {
      logger.error('[Email] AI response generation failed', error);
      return this.generateAutoResponse(parsed);
    }
  }

  /**
   * Create ticket from email
   */
  async createTicketFromEmail(parsed: ParsedEmail): Promise<{ ticketId: string }> {
    const ticketId = `EMAIL-${Date.now()}-${parsed.customerEmail.split('@')[0]}`;

    logger.info('[Email] Creating ticket from email', {
      ticketId,
      customer: parsed.customerEmail,
      category: parsed.category,
      priority: parsed.priority,
    });

    // In real implementation, this would save to MongoDB
    return { ticketId };
  }

  /**
   * Send email (using notification service)
   */
  async sendEmail(response: EmailResponse): Promise<boolean> {
    try {
      // In real implementation, this would use SendGrid/SES
      logger.info('[Email] Sending auto-response', {
        to: response.to,
        subject: response.subject,
      });
      return true;
    } catch (error) {
      logger.error('[Email] Failed to send response', error);
      return false;
    }
  }

  /**
   * Full email processing pipeline
   */
  async processEmailPipeline(rawEmail: EmailMessage): Promise<{
    ticketId: string;
    response: EmailResponse;
    parsed: ParsedEmail;
  }> {
    // 1. Process email
    const parsed = await this.processEmail(rawEmail);

    // 2. Create ticket
    const { ticketId } = await this.createTicketFromEmail(parsed);

    // 3. Generate response
    const response = await this.generateAutoResponse(parsed);

    // 4. Send response
    await this.sendEmail(response);

    return { ticketId, response, parsed };
  }
}

export const emailIntegration = new EmailIntegration();
export { EmailIntegration };
