import { v4 as uuidv4 } from 'uuid';
import { Feedback, ConversationSample } from '../models/index.js';
import logger from './utils/logger';
import { NotFoundError } from '../utils/errors.js';
import { FeedbackCreate } from '../utils/validators.js';

export interface FeedbackStats {
  totalFeedback: number;
  pendingReview: number;
  pendingProcessing: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  feedbackTypeDistribution: Record<string, number>;
  correctionCount: number;
  suggestionCount: number;
}

export class FeedbackLoop {
  async submitFeedback(data: FeedbackCreate): Promise<typeof Feedback.prototype> {
    const feedbackId = uuidv4();

    const feedback = new Feedback({
      feedbackId,
      conversationId: data.conversationId,
      type: data.type,
      rating: data.rating,
      corrections: data.corrections || [],
      suggestions: data.suggestions || [],
      sentiment: data.sentiment,
      feedback: data.feedback,
      metadata: data.metadata || {},
      status: 'pending',
    });

    await feedback.save();

    logger.info('Feedback submitted', {
      feedbackId,
      conversationId: data.conversationId,
      type: data.type,
    });

    // Process feedback asynchronously
    this.processFeedback(feedbackId).catch((error) => {
      logger.error('Async feedback processing failed', {
        feedbackId,
        error: error.message,
      });
    });

    return feedback;
  }

  async getFeedback(feedbackId: string): Promise<typeof Feedback.prototype> {
    const feedback = await Feedback.findOne({ feedbackId });

    if (!feedback) {
      throw new NotFoundError('Feedback', feedbackId);
    }

    return feedback;
  }

  async getFeedbackByConversation(conversationId: string): Promise<typeof Feedback.prototype[]> {
    return Feedback.findByConversation(conversationId);
  }

  async listFeedback(filters: {
    type?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{
    feedback: typeof Feedback.prototype[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (filters.type) query.type = filters.type;
    if (filters.status) query.status = filters.status;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const [feedback, total] = await Promise.all([
      Feedback.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Feedback.countDocuments(query),
    ]);

    return {
      feedback,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async processFeedback(feedbackId: string): Promise<void> {
    const feedback = await Feedback.findOne({ feedbackId });

    if (!feedback) {
      throw new NotFoundError('Feedback', feedbackId);
    }

    if (feedback.status !== 'pending') {
      logger.info('Feedback already processed', { feedbackId, status: feedback.status });
      return;
    }

    try {
      // Update conversation with feedback info if applicable
      if (feedback.type === 'rating' && feedback.rating) {
        await ConversationSample.findOneAndUpdate(
          { conversationId: feedback.conversationId },
          {
            $set: {
              'outcome.satisfaction': feedback.rating,
            },
          }
        );
      }

      // Process corrections for intent refinement
      if (feedback.type === 'correction' && feedback.corrections.length > 0) {
        await this.processCorrections(feedback.conversationId, feedback.corrections);
      }

      feedback.status = 'processed';
      feedback.processedAt = new Date();
      await feedback.save();

      logger.info('Feedback processed', { feedbackId });
    } catch (error) {
      logger.error('Feedback processing failed', {
        feedbackId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async markAsReviewed(
    feedbackId: string,
    reviewerId: string,
    notes?: string
  ): Promise<typeof Feedback.prototype> {
    const feedback = await Feedback.findOne({ feedbackId });

    if (!feedback) {
      throw new NotFoundError('Feedback', feedbackId);
    }

    feedback.status = 'reviewed';
    feedback.reviewedAt = new Date();
    feedback.reviewerId = reviewerId;
    if (notes) feedback.reviewNotes = notes;

    await feedback.save();

    logger.info('Feedback marked as reviewed', { feedbackId, reviewerId });

    return feedback;
  }

  async markAsApplied(feedbackId: string): Promise<typeof Feedback.prototype> {
    const feedback = await Feedback.findOne({ feedbackId });

    if (!feedback) {
      throw new NotFoundError('Feedback', feedbackId);
    }

    feedback.status = 'applied';
    await feedback.save();

    logger.info('Feedback marked as applied', { feedbackId });

    return feedback;
  }

  async getPendingReviews(): Promise<typeof Feedback.prototype[]> {
    return Feedback.findPendingReviews();
  }

  async getStats(startDate?: Date, endDate?: Date): Promise<FeedbackStats> {
    const matchStage: Record<string, unknown> = {};

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = startDate;
      if (endDate) matchStage.createdAt.$lte = endDate;
    }

    const [allFeedback, pendingReview, pendingProcessing, ratings] = await Promise.all([
      Feedback.countDocuments(matchStage),
      Feedback.countDocuments({ ...matchStage, status: 'reviewed' }),
      Feedback.countDocuments({ ...matchStage, status: 'pending' }),
      Feedback.find({
        ...matchStage,
        type: 'rating',
        rating: { $exists: true, $ne: null },
      }).select('rating'),
    ]);

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    for (const r of ratings) {
      if (r.rating) {
        ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
        totalRating += r.rating;
      }
    }

    const avgRating = ratings.length > 0 ? totalRating / ratings.length : 0;

    const feedbackTypeDistribution = await Feedback.aggregate([
      { $match: matchStage },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    const typeDist: Record<string, number> = {};
    for (const item of feedbackTypeDistribution) {
      typeDist[item._id] = item.count;
    }

    const correctionCount = typeDist['correction'] || 0;
    const suggestionCount = typeDist['suggestion'] || 0;

    return {
      totalFeedback: allFeedback,
      pendingReview,
      pendingProcessing,
      averageRating: Math.round(avgRating * 100) / 100,
      ratingDistribution,
      feedbackTypeDistribution: typeDist,
      correctionCount,
      suggestionCount,
    };
  }

  private async processCorrections(
    conversationId: string,
    corrections: Array<{
      messageId?: string;
      originalIntent: string;
      correctedIntent: string;
      explanation?: string;
    }>
  ): Promise<void> {
    const conversation = await ConversationSample.findOne({ conversationId });

    if (!conversation) {
      logger.warn('Conversation not found for corrections', { conversationId });
      return;
    }

    // Log corrections for intent model improvement
    logger.info('Processing intent corrections', {
      conversationId,
      correctionCount: corrections.length,
      corrections: corrections.map((c) => ({
        from: c.originalIntent,
        to: c.correctedIntent,
      })),
    });

    // Mark conversation as needing re-labeling with higher quality
    conversation.isLabeled = true;
    conversation.labelQuality = 'high';
    await conversation.save();
  }
}

export const feedbackLoop = new FeedbackLoop();
