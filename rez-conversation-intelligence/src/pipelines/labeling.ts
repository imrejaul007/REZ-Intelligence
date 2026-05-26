import { ConversationSample, Feedback } from '../models/index.js';
import logger from './utils/logger';

export interface LabelingResult {
  labeledCount: number;
  updatedCount: number;
  skippedCount: number;
}

export interface LabelingRule {
  name: string;
  condition: (conversation: typeof ConversationSample.prototype) => boolean;
  label: {
    intent?: string;
    quality?: 'high' | 'medium' | 'low';
    metadata?: Record<string, unknown>;
  };
}

// Define labeling rules based on conversation characteristics
const LABELING_RULES: LabelingRule[] = [
  {
    name: 'high_confidence_intent',
    condition: (conv) => {
      const topIntent = conv.extractedIntents[0];
      return topIntent && topIntent.confidence >= 0.85;
    },
    label: { quality: 'high' },
  },
  {
    name: 'user_feedback_corrected',
    condition: (conv) => conv.labelQuality === 'high' && conv.isLabeled,
    label: { quality: 'high' },
  },
  {
    name: 'resolved_positive_sentiment',
    condition: (conv) =>
      conv.outcome?.success === true &&
      conv.aggregatedSentiment.label === 'positive',
    label: { quality: 'high' },
  },
  {
    name: 'resolved_negative_sentiment',
    condition: (conv) =>
      conv.outcome?.success === true &&
      conv.aggregatedSentiment.label === 'negative',
    label: { quality: 'medium' },
  },
  {
    name: 'unresolved_complaint',
    condition: (conv) =>
      conv.outcome?.success === false &&
      conv.aggregatedSentiment.label === 'negative',
    label: { quality: 'low' },
  },
  {
    name: 'multi_turn_conversation',
    condition: (conv) => conv.messages.length >= 5,
    label: { quality: 'high' },
  },
  {
    name: 'single_message',
    condition: (conv) => conv.messages.length === 1,
    label: { quality: 'medium' },
  },
];

export class LabelingPipeline {
  private rules = LABELING_RULES;

  async run(): Promise<LabelingResult> {
    const result: LabelingResult = {
      labeledCount: 0,
      updatedCount: 0,
      skippedCount: 0,
    };

    logger.info('Starting labeling pipeline');

    try {
      // Get conversations that need labeling or re-labeling
      const conversations = await ConversationSample.find({
        $or: [
          { isLabeled: false },
          { labelQuality: { $exists: false } },
          { labelQuality: 'low' },
        ],
        status: { $ne: 'archived' },
      }).limit(500);

      if (conversations.length === 0) {
        logger.info('No conversations need labeling');
        return result;
      }

      logger.info(`Found ${conversations.length} conversations to label`);

      for (const conversation of conversations) {
        const labelingResult = await this.labelConversation(conversation);

        if (labelingResult.isNew) {
          result.labeledCount++;
        } else if (labelingResult.updated) {
          result.updatedCount++;
        } else {
          result.skippedCount++;
        }
      }

      logger.info('Labeling pipeline completed', result);

      return result;
    } catch (error) {
      logger.error('Labeling pipeline failed', { error: (error as Error).message });
      throw error;
    }
  }

  async labelConversation(
    conversation: typeof ConversationSample.prototype
  ): Promise<{ isNew: boolean; updated: boolean }> {
    let isNew = !conversation.isLabeled;
    let updated = false;

    // Apply all matching rules
    for (const rule of this.rules) {
      try {
        if (rule.condition(conversation)) {
          if (rule.label.quality) {
            const newQuality = this.determineQuality(
              conversation.labelQuality,
              rule.label.quality
            );
            if (newQuality !== conversation.labelQuality) {
              conversation.labelQuality = newQuality;
              updated = true;
            }
          }

          if (rule.label.intent && conversation.extractedIntents.length === 0) {
            conversation.extractedIntents = [{ name: rule.label.intent, confidence: 0.5 }];
            updated = true;
          }

          if (rule.label.metadata) {
            conversation.metadata = {
              ...conversation.metadata,
              ...rule.label.metadata,
              labeledBy: rule.name,
            };
            updated = true;
          }
        }
      } catch (error) {
        logger.warn('Rule evaluation failed', {
          rule: rule.name,
          conversationId: conversation.conversationId,
          error: (error as Error).message,
        });
      }
    }

    // Mark as labeled
    if (!conversation.isLabeled || updated) {
      conversation.isLabeled = true;
      updated = true;
    }

    if (updated) {
      await conversation.save();
    }

    return { isNew, updated };
  }

  private determineQuality(
    current: 'high' | 'medium' | 'low' | undefined,
    newQuality: 'high' | 'medium' | 'low'
  ): 'high' | 'medium' | 'low' {
    const qualityOrder = { low: 1, medium: 2, high: 3 };

    if (!current) return newQuality;

    // Only upgrade quality, never downgrade from rules
    return qualityOrder[newQuality] > qualityOrder[current]
      ? newQuality
      : current;
  }

  async applyCorrectionsFromFeedback(): Promise<number> {
    logger.info('Applying corrections from feedback');

    const pendingCorrections = await Feedback.findPendingCorrections();
    let updatedCount = 0;

    for (const feedback of pendingCorrections) {
      if (feedback.type !== 'correction' || !feedback.corrections.length) {
        continue;
      }

      const conversation = await ConversationSample.findOne({
        conversationId: feedback.conversationId,
      });

      if (!conversation) {
        logger.warn('Conversation not found for correction', {
          conversationId: feedback.conversationId,
        });
        continue;
      }

      // Apply corrections to conversation
      for (const correction of feedback.corrections) {
        // Find and update matching intent in conversation
        const intentIndex = conversation.extractedIntents.findIndex(
          (i) => i.name === correction.originalIntent
        );

        if (intentIndex !== -1) {
          // Update intent name if it's a name correction
          conversation.extractedIntents[intentIndex] = {
            name: correction.correctedIntent,
            confidence: conversation.extractedIntents[intentIndex].confidence,
          };
        }

        // Update message-level intent if messageId is provided
        if (correction.messageId) {
          const message = conversation.messages.find(
            (m) => m.id === correction.messageId
          );
          if (message?.intent) {
            message.intent = {
              ...message.intent,
              name: correction.correctedIntent,
            };
          }
        }
      }

      // Upgrade label quality since feedback was received
      conversation.labelQuality = 'high';
      conversation.metadata = {
        ...conversation.metadata,
        lastCorrectedAt: new Date(),
        correctionFeedbackId: feedback.feedbackId,
      };

      await conversation.save();

      // Mark feedback as processed
      feedback.status = 'processed';
      feedback.processedAt = new Date();
      await feedback.save();

      updatedCount++;
    }

    logger.info(`Applied ${updatedCount} corrections from feedback`);
    return updatedCount;
  }

  addRule(rule: LabelingRule): void {
    this.rules.push(rule);
    logger.info('Added labeling rule', { ruleName: rule.name });
  }

  getRules(): LabelingRule[] {
    return [...this.rules];
  }

  clearRules(): void {
    this.rules = [];
    logger.info('Cleared all labeling rules');
  }
}

export const labelingPipeline = new LabelingPipeline();
