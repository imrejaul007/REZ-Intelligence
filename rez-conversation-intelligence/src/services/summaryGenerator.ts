/**
 * REZ Conversation Intelligence - Summary Generation Service
 *
 * Generates intelligent summaries from conversation messages.
 * Extracts key points, decisions, questions, and sentiment.
 *
 * Port: Part of REZ-Conversation-Intelligence
 */

import logger from './utils/logger.js';
import { config } from '../config/index.js';
import { sentimentAnalyzer } from './sentimentAnalyzer.js';
import { topicModeling } from './topicModeling.js';

// ============================================================================
// Types
// ============================================================================

export interface ConversationSummary {
  shortSummary: string;
  keyPoints: string[];
  questions: string[];
  decisions: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  topics: string[];
  participants: {
    id: string;
    type: 'user' | 'agent' | 'bot';
    messageCount: number;
  }[];
  duration?: {
    start: Date;
    end: Date;
    minutes: number;
  };
  resolution?: {
    resolved: boolean;
    resolution?: string;
  };
  metadata: {
    generatedAt: Date;
    modelVersion: string;
    messageCount: number;
  };
}

export interface MessageSummary {
  id: string;
  content: string;
  senderType: 'user' | 'agent' | 'bot';
  senderId: string;
  timestamp: Date;
  importance: number;
  isKeyPoint: boolean;
  summary?: string;
}

// ============================================================================
// Summary Generator Service
// ============================================================================

export class SummaryGenerator {
  private sentimentAnalyzer = sentimentAnalyzer;
  private topicModeling = topicModeling;
  private maxSummaryLength: number;
  private maxKeyPoints: number;

  constructor() {
    this.maxSummaryLength = config.SUMMARY_MAX_LENGTH || 200;
    this.maxKeyPoints = config.SUMMARY_MAX_KEY_POINTS || 5;
  }

  /**
   * Generate comprehensive summary from conversation messages
   */
  async generateSummary(
    conversationId: string,
    messages: Array<{
      id: string;
      content: string;
      senderType: 'user' | 'agent' | 'bot';
      senderId: string;
      timestamp: Date;
    }>
  ): Promise<ConversationSummary> {
    try {
      logger.info('Generating conversation summary', {
        conversationId,
        messageCount: messages.length
      });

      if (messages.length === 0) {
        return this.generateEmptySummary();
      }

      // Sort messages by timestamp
      const sortedMessages = [...messages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Calculate message importance
      const messagesWithImportance = this.scoreMessageImportance(sortedMessages);

      // Extract components
      const keyPoints = this.extractKeyPoints(messagesWithImportance);
      const questions = this.extractQuestions(messages);
      const decisions = this.extractDecisions(messages);
      const topics = await this.extractTopics(messages);
      const sentiment = await this.analyzeOverallSentiment(messages);
      const participants = this.analyzeParticipants(sortedMessages);
      const duration = this.calculateDuration(sortedMessages);
      const resolution = this.analyzeResolution(sortedMessages, sentiment);
      const shortSummary = this.generateShortSummary(
        keyPoints,
        questions,
        decisions,
        resolution,
        sentiment
      );

      const summary: ConversationSummary = {
        shortSummary,
        keyPoints,
        questions,
        decisions,
        sentiment,
        sentimentScore: sentiment.score,
        topics,
        participants,
        duration,
        resolution,
        metadata: {
          generatedAt: new Date(),
          modelVersion: '1.0.0',
          messageCount: messages.length
        }
      };

      logger.info('Summary generated', {
        conversationId,
        keyPointCount: keyPoints.length,
        questionCount: questions.length,
        decisionCount: decisions.length
      });

      return summary;
    } catch (error) {
      logger.error('Summary generation failed', {
        conversationId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Generate empty summary for no messages
   */
  private generateEmptySummary(): ConversationSummary {
    return {
      shortSummary: 'No messages in conversation',
      keyPoints: [],
      questions: [],
      decisions: [],
      sentiment: 'neutral',
      sentimentScore: 0,
      topics: [],
      participants: [],
      metadata: {
        generatedAt: new Date(),
        modelVersion: '1.0.0',
        messageCount: 0
      }
    };
  }

  /**
   * Score message importance using multiple factors
   */
  private scoreMessageImportance(messages: Array<{
    id: string;
    content: string;
    senderType: string;
    senderId: string;
    timestamp: Date;
  }>): MessageSummary[] {
    const scoredMessages: MessageSummary[] = [];

    for (const message of messages) {
      let importance = 0.5; // Base importance

      // First message gets boost (context)
      if (messages.indexOf(message) === 0) {
        importance += 0.2;
      }

      // Last message gets boost (conclusion)
      if (messages.indexOf(message) === messages.length - 1) {
        importance += 0.15;
      }

      // Questions are important
      if (message.content.includes('?')) {
        importance += 0.15;
      }

      // Agent responses are often key
      if (message.senderType === 'agent') {
        importance += 0.05;
      }

      // Long messages might contain key info
      const wordCount = message.content.split(/\s+/).length;
      if (wordCount > 50) importance += 0.1;
      else if (wordCount < 10) importance -= 0.1;

      // Check for important keywords
      const importantKeywords = [
        'confirmed', 'agreed', 'decided', 'resolved', 'cancelled',
        'refund', 'exchange', 'replacement', 'urgent', 'important',
        'done', 'completed', 'fixed', 'solved'
      ];
      const contentLower = message.content.toLowerCase();
      for (const keyword of importantKeywords) {
        if (contentLower.includes(keyword)) {
          importance += 0.1;
        }
      }

      scoredMessages.push({
        ...message,
        importance: Math.min(importance, 1),
        isKeyPoint: importance > 0.7
      });
    }

    return scoredMessages;
  }

  /**
   * Extract key points from conversation
   */
  private extractKeyPoints(messages: MessageSummary[]): string[] {
    const keyPoints: string[] = [];
    const seenPoints = new Set<string>();

    // Get high importance messages
    const importantMessages = messages
      .filter(m => m.importance > 0.6)
      .sort((a, b) => b.importance - a.importance);

    for (const msg of importantMessages) {
      if (keyPoints.length >= this.maxKeyPoints) break;

      const summary = this.summarizeText(msg.content);
      const normalized = summary.toLowerCase().trim();

      // Avoid duplicates
      if (!seenPoints.has(normalized) && summary.length > 10) {
        seenPoints.add(normalized);
        keyPoints.push(summary);
      }
    }

    // If no key points found, use first message summary
    if (keyPoints.length === 0 && messages.length > 0) {
      keyPoints.push(this.summarizeText(messages[0].content));
    }

    return keyPoints;
  }

  /**
   * Extract questions from conversation
   */
  private extractQuestions(messages: Array<{
    id: string;
    content: string;
  }>): string[] {
    const questions: string[] = [];

    for (const msg of messages) {
      // Find question sentences
      const questionMatches = msg.content.match(/[^.!?]*\?[^.!?]*/g);

      if (questionMatches) {
        for (const question of questionMatches) {
          const trimmed = question.trim();
          if (trimmed.length > 10 && trimmed.length < 300) {
            questions.push(trimmed);
          }
        }
      }
    }

    // Return unique questions, most recent first
    const uniqueQuestions = [...new Set(questions)];
    return uniqueQuestions.slice(0, 5);
  }

  /**
   * Extract decisions from conversation
   */
  private extractDecisions(messages: Array<{
    id: string;
    content: string;
    senderType: string;
  }>): string[] {
    const decisions: string[] = [];
    const decisionPatterns = [
      /\b(agreed|agreement|decided|decision|moving forward|confirmed|confirmed)\b.*/i,
      /\b(will|shall)\s+[^.]*(?:approved|accepted|confirmed|agreed)/i,
      /\b(we'll|i'll)\s+[^.]*(?:proceed|go ahead|do it)/i,
      /\b(let's|let us)\s+[^.]*(?:proceed|go ahead|do it|start)/i,
      /\b(good|great|okay|ok)\s+[^.]*(?:let's|let me|i'll|we'll)/i,
      /\b(approved|accepted|confirmed|booked|scheduled|reserved)/i
    ];

    for (const msg of messages) {
      // Agent decisions are more authoritative
      const boost = msg.senderType === 'agent' ? 0.1 : 0;

      for (const pattern of decisionPatterns) {
        const match = msg.content.match(pattern);
        if (match) {
          const decision = match[0].trim();
          if (decision.length > 10 && decision.length < 200) {
            decisions.push(decision);
          }
        }
      }
    }

    // Return unique decisions
    return [...new Set(decisions)].slice(0, 5);
  }

  /**
   * Extract topics from conversation
   */
  private async extractTopics(messages: Array<{
    id: string;
    content: string;
  }>): Promise<string[]> {
    try {
      const fullText = messages.map(m => m.content).join(' ');
      const topic = await this.topicModeling.classifyText(fullText);

      return topic ? [topic.name] : [];
    } catch (error) {
      logger.warn('Topic extraction failed', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Analyze overall sentiment
   */
  private async analyzeOverallSentiment(messages: Array<{
    id: string;
    content: string;
  }>): Promise<{ label: 'positive' | 'neutral' | 'negative'; score: number }> {
    try {
      const fullText = messages.map(m => m.content).join(' ');
      const result = await this.sentimentAnalyzer.analyze(fullText);

      return {
        label: result.label,
        score: result.score
      };
    } catch (error) {
      logger.warn('Sentiment analysis failed', { error: (error as Error).message });
      return { label: 'neutral', score: 0 };
    }
  }

  /**
   * Analyze participants
   */
  private analyzeParticipants(messages: Array<{
    id: string;
    senderType: string;
    senderId: string;
  }>): ConversationSummary['participants'] {
    const participantMap = new Map<string, {
      id: string;
      type: 'user' | 'agent' | 'bot';
      count: number;
    }>();

    for (const msg of messages) {
      const type = msg.senderType as 'user' | 'agent' | 'bot';
      const existing = participantMap.get(msg.senderId);

      if (existing) {
        existing.count++;
      } else {
        participantMap.set(msg.senderId, {
          id: msg.senderId,
          type,
          count: 1
        });
      }
    }

    return Array.from(participantMap.values())
      .sort((a, b) => b.count - a.count)
      .map(p => ({
        id: p.id,
        type: p.type,
        messageCount: p.count
      }));
  }

  /**
   * Calculate conversation duration
   */
  private calculateDuration(messages: Array<{ timestamp: Date }>): {
    start: Date;
    end: Date;
    minutes: number;
  } | undefined {
    if (messages.length < 2) return undefined;

    const timestamps = messages.map(m => new Date(m.timestamp).getTime());
    const start = new Date(Math.min(...timestamps));
    const end = new Date(Math.max(...timestamps));
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);

    return { start, end, minutes };
  }

  /**
   * Analyze if conversation was resolved
   */
  private analyzeResolution(
    messages: Array<{ content: string; senderType: string }>,
    sentiment: { label: string }
  ): ConversationSummary['resolution'] {
    const resolutionKeywords = [
      'resolved', 'fixed', 'solved', 'completed', 'done',
      'taken care of', 'no problem', 'all set', 'good to go',
      'sorted', 'handled'
    ];

    const unresolutionKeywords = [
      'still', 'not resolved', 'unresolved', 'pending', 'waiting',
      'follow up', 'escalated'
    ];

    const lastAgentMessage = [...messages]
      .reverse()
      .find(m => m.senderType === 'agent');

    const contentLower = lastAgentMessage?.content.toLowerCase() || '';

    let resolved = false;
    let resolution: string | undefined;

    for (const keyword of resolutionKeywords) {
      if (contentLower.includes(keyword)) {
        resolved = true;
        resolution = 'Resolved with positive outcome';
        break;
      }
    }

    if (!resolved) {
      for (const keyword of unresolutionKeywords) {
        if (contentLower.includes(keyword)) {
          resolution = 'Requires follow-up';
          break;
        }
      }
    }

    // Also check sentiment
    if (sentiment.label === 'positive' && resolved) {
      resolution = resolution || 'Positive resolution confirmed';
    }

    return {
      resolved,
      resolution
    };
  }

  /**
   * Generate short summary (1-2 sentences)
   */
  private generateShortSummary(
    keyPoints: string[],
    questions: string[],
    decisions: string[],
    resolution: ConversationSummary['resolution'],
    sentiment: { label: string }
  ): string {
    const parts: string[] = [];

    // Start with main topic
    if (keyPoints.length > 0) {
      parts.push(this.truncateText(keyPoints[0], 100));
    }

    // Add question context if unresolved
    if (!resolution?.resolved && questions.length > 0) {
      parts.push(`Question raised: ${this.truncateText(questions[0], 80)}`);
    }

    // Add decision context
    if (decisions.length > 0) {
      parts.push(`Decision: ${this.truncateText(decisions[0], 80)}`);
    }

    // Add resolution status
    if (resolution?.resolved) {
      parts.push('Issue resolved.');
    } else if (resolution?.resolution) {
      parts.push(resolution.resolution);
    }

    // Add sentiment context
    if (sentiment.label === 'negative' && !resolution?.resolved) {
      parts.push('Customer expressed dissatisfaction.');
    }

    // Limit length
    const summary = parts.join(' ');
    return this.truncateText(summary, this.maxSummaryLength);
  }

  /**
   * Summarize a single text message
   */
  private summarizeText(text: string): string {
    // Remove common prefixes
    let cleaned = text
      .replace(/^(hi|hello|hey|good (?:morning|afternoon|evening),?\s*/i, '')
      .replace(/^(thank you|thanks),?\s*/i, '')
      .trim();

    // Take first sentence or truncate
    const firstSentence = cleaned.match(/^[^.!?]+[.!?]/);
    if (firstSentence) {
      return firstSentence[0].trim();
    }

    return this.truncateText(cleaned, 100);
  }

  /**
   * Truncate text to max length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Generate meeting notes format
   */
  async generateMeetingNotes(
    conversationId: string,
    messages: Array<{
      id: string;
      content: string;
      senderType: 'user' | 'agent' | 'bot';
      senderId: string;
      timestamp: Date;
    }>
  ): Promise<string> {
    const summary = await this.generateSummary(conversationId, messages);

    const notes = `
# Meeting Notes - ${new Date().toLocaleDateString()}

## Summary
${summary.shortSummary}

## Key Points
${summary.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

${summary.questions.length > 0 ? `## Open Questions
${summary.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
` : ''}

${summary.decisions.length > 0 ? `## Decisions Made
${summary.decisions.map((d, i) => `${i + 1}. ${d}`).join('\n')}
` : ''}

## Participants
${summary.participants.map(p => `- ${p.type}: ${p.id} (${p.messageCount} messages)`).join('\n')}

${summary.duration ? `## Duration
- Start: ${summary.duration.start.toLocaleTimeString()}
- End: ${summary.duration.end.toLocaleTimeString()}
- Total: ${summary.duration.minutes} minutes
` : ''}

## Status
- Sentiment: ${summary.sentiment} (score: ${summary.sentimentScore.toFixed(2)})
- Resolution: ${summary.resolution?.resolved ? '✅ Resolved' : '⚠️ Requires follow-up'}
${summary.resolution?.resolution ? `- ${summary.resolution.resolution}` : ''}

---
*Generated by REZ Conversation Intelligence*
`.trim();

    return notes;
  }
}

// Export singleton instance
export const summaryGenerator = new SummaryGenerator();
export default summaryGenerator;
