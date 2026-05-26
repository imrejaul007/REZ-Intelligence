import { ConversationSample } from '../models/index.js';
import { intentExtractor } from '../services/intentExtractor.js';
import { sentimentAnalyzer } from '../services/sentimentAnalyzer.js';
import logger from './utils/logger';
import { config } from '../config/index.js';

export interface ExtractionResult {
  processedCount: number;
  failedCount: number;
  errors: Array<{ conversationId: string; error: string }>;
}

export class ExtractionPipeline {
  private batchSize = 50;
  private concurrency = 5;

  async run(): Promise<ExtractionResult> {
    const result: ExtractionResult = {
      processedCount: 0,
      failedCount: 0,
      errors: [],
    };

    logger.info('Starting extraction pipeline');

    try {
      // Get unprocessed conversations
      const unprocessed = await ConversationSample.findUnprocessed();

      if (unprocessed.length === 0) {
        logger.info('No unprocessed conversations found');
        return result;
      }

      logger.info(`Found ${unprocessed.length} unprocessed conversations`);

      // Process in batches
      for (let i = 0; i < unprocessed.length; i += this.batchSize) {
        const batch = unprocessed.slice(i, i + this.batchSize);

        // Process batch with concurrency limit
        const batchResults = await Promise.allSettled(
          batch.map((conv) => this.processConversation(conv.conversationId))
        );

        for (const [index, promiseResult] of batchResults.entries()) {
          if (promiseResult.status === 'fulfilled') {
            result.processedCount++;
          } else {
            result.failedCount++;
            result.errors.push({
              conversationId: batch[index].conversationId,
              error: promiseResult.reason?.message || 'Unknown error',
            });
          }
        }
      }

      logger.info('Extraction pipeline completed', {
        processed: result.processedCount,
        failed: result.failedCount,
      });

      return result;
    } catch (error) {
      logger.error('Extraction pipeline failed', { error: (error as Error).message });
      throw error;
    }
  }

  private async processConversation(conversationId: string): Promise<void> {
    const conversation = await ConversationSample.findOne({ conversationId });

    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const updatedMessages = [];

    for (const message of conversation.messages) {
      const updatedMessage = { ...message.toObject() };

      // Extract intent if enabled
      if (config.ENABLE_INTENT_EXTRACTION && !updatedMessage.intent) {
        try {
          updatedMessage.intent = await intentExtractor.extract(updatedMessage.content);
        } catch (error) {
          logger.warn('Intent extraction failed for message', {
            messageId: updatedMessage.id,
            error: (error as Error).message,
          });
        }
      }

      // Analyze sentiment if enabled
      if (config.ENABLE_SENTIMENT_ANALYSIS && !updatedMessage.sentiment) {
        try {
          updatedMessage.sentiment = await sentimentAnalyzer.analyze(updatedMessage.content);
        } catch (error) {
          logger.warn('Sentiment analysis failed for message', {
            messageId: updatedMessage.id,
            error: (error as Error).message,
          });
        }
      }

      updatedMessages.push(updatedMessage);
    }

    // Update conversation with processed messages
    conversation.messages = updatedMessages as typeof conversation.messages;
    conversation.extractedIntents = this.aggregateIntents(updatedMessages);
    conversation.aggregatedSentiment = this.aggregateSentiment(updatedMessages);
    conversation.processedAt = new Date();
    conversation.isLabeled = true;

    // Calculate label quality
    conversation.labelQuality = this.calculateLabelQuality(
      conversation.extractedIntents,
      conversation.aggregatedSentiment
    );

    await conversation.save();

    logger.debug('Conversation processed', { conversationId });
  }

  private aggregateIntents(messages: Array<{ intent?: { name: string; confidence: number } }>): Array<{
    name: string;
    confidence: number;
  }> {
    const intentCounts = new Map<string, { confidence: number; count: number }>();

    for (const msg of messages) {
      if (msg.intent) {
        const current = intentCounts.get(msg.intent.name) || { confidence: 0, count: 0 };
        intentCounts.set(msg.intent.name, {
          confidence: Math.max(current.confidence, msg.intent.confidence),
          count: current.count + 1,
        });
      }
    }

    return Array.from(intentCounts.entries())
      .map(([name, data]) => ({ name, confidence: data.confidence }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  private aggregateSentiment(messages: Array<{
    sentiment?: { score: number; comparative: number; confidence: number; label: string };
  }>): {
    score: number;
    comparative: number;
    confidence: number;
    label: 'positive' | 'neutral' | 'negative';
    messageCount: number;
  } {
    const sentiments = messages
      .filter((m) => m.sentiment)
      .map((m) => m.sentiment!);

    if (sentiments.length === 0) {
      return {
        score: 0,
        comparative: 0,
        confidence: 0,
        label: 'neutral',
        messageCount: 0,
      };
    }

    const avgScore = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;
    const avgComparative = sentiments.reduce((sum, s) => sum + s.comparative, 0) / sentiments.length;
    const avgConfidence = sentiments.reduce((sum, s) => sum + s.confidence, 0) / sentiments.length;

    let label: 'positive' | 'neutral' | 'negative';
    if (avgScore > 0.05) label = 'positive';
    else if (avgScore < -0.05) label = 'negative';
    else label = 'neutral';

    return {
      score: avgScore,
      comparative: avgComparative,
      confidence: avgConfidence,
      label,
      messageCount: sentiments.length,
    };
  }

  private calculateLabelQuality(
    intents: Array<{ confidence: number }>,
    sentiment: { confidence: number }
  ): 'high' | 'medium' | 'low' {
    const avgIntentConfidence =
      intents.length > 0
        ? intents.reduce((sum, i) => sum + i.confidence, 0) / intents.length
        : 0;

    const avgConfidence = (avgIntentConfidence + sentiment.confidence) / 2;

    if (avgConfidence >= 0.75) return 'high';
    if (avgConfidence >= 0.5) return 'medium';
    return 'low';
  }

  async runForConversation(conversationId: string): Promise<void> {
    await this.processConversation(conversationId);
  }

  async runForBatch(conversationIds: string[]): Promise<ExtractionResult> {
    const result: ExtractionResult = {
      processedCount: 0,
      failedCount: 0,
      errors: [],
    };

    const batchResults = await Promise.allSettled(
      conversationIds.map((id) => this.processConversation(id))
    );

    for (const [index, promiseResult] of batchResults.entries()) {
      if (promiseResult.status === 'fulfilled') {
        result.processedCount++;
      } else {
        result.failedCount++;
        result.errors.push({
          conversationId: conversationIds[index],
          error: promiseResult.reason?.message || 'Unknown error',
        });
      }
    }

    return result;
  }
}

export const extractionPipeline = new ExtractionPipeline();
