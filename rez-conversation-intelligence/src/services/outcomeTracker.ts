import { ConversationSample } from '../models/index.js';
import logger from './utils/logger.js';
import { config } from '../config/index.js';

export interface OutcomeMetrics {
  totalConversations: number;
  successfulConversations: number;
  failedConversations: number;
  resolutionRate: number;
  avgResolutionTime: number;
  medianResolutionTime: number;
  satisfactionScore: number;
  outcomeDistribution: Record<string, number>;
}

export interface OutcomeTrend {
  date: Date;
  resolutionRate: number;
  avgResolutionTime: number;
  satisfactionScore: number;
  volume: number;
}

export class OutcomeTracker {
  async trackOutcome(
    conversationId: string,
    outcome: {
      type: string;
      success: boolean;
      resolutionTime?: number;
      satisfaction?: number;
      notes?: string;
    }
  ): Promise<void> {
    try {
      const conversation = await ConversationSample.findOne({ conversationId });

      if (!conversation) {
        logger.warn('Conversation not found for outcome tracking', { conversationId });
        return;
      }

      conversation.outcome = outcome;
      await conversation.save();

      logger.info('Outcome tracked', {
        conversationId,
        type: outcome.type,
        success: outcome.success,
        resolutionTime: outcome.resolutionTime,
      });
    } catch (error) {
      logger.error('Failed to track outcome', {
        conversationId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async getMetrics(startDate?: Date, endDate?: Date): Promise<OutcomeMetrics> {
    const matchStage: Record<string, unknown> = {
      outcome: { $exists: true, $ne: null },
    };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = startDate;
      if (endDate) matchStage.createdAt.$lte = endDate;
    }

    const conversations = await ConversationSample.find(matchStage);

    if (conversations.length === 0) {
      return {
        totalConversations: 0,
        successfulConversations: 0,
        failedConversations: 0,
        resolutionRate: 0,
        avgResolutionTime: 0,
        medianResolutionTime: 0,
        satisfactionScore: 0,
        outcomeDistribution: {},
      };
    }

    const successful = conversations.filter((c) => c.outcome?.success === true);
    const failed = conversations.filter((c) => c.outcome?.success === false);

    const resolutionTimes = conversations
      .filter((c) => c.outcome?.resolutionTime !== undefined)
      .map((c) => c.outcome!.resolutionTime!)
      .sort((a, b) => a - b);

    const satisfactionScores = conversations
      .filter((c) => c.outcome?.satisfaction !== undefined)
      .map((c) => c.outcome!.satisfaction!);

    const outcomeTypes = conversations.reduce((acc, c) => {
      const type = c.outcome?.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0;

    const medianResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes[Math.floor(resolutionTimes.length / 2)]
      : 0;

    const satisfactionScore = satisfactionScores.length > 0
      ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length
      : 0;

    return {
      totalConversations: conversations.length,
      successfulConversations: successful.length,
      failedConversations: failed.length,
      resolutionRate: conversations.length > 0
        ? (successful.length / conversations.length) * 100
        : 0,
      avgResolutionTime: Math.round(avgResolutionTime),
      medianResolutionTime,
      satisfactionScore: Math.round(satisfactionScore * 100) / 100,
      outcomeDistribution: outcomeTypes,
    };
  }

  async getTrend(
    interval: 'hour' | 'day' | 'week' | 'month',
    startDate?: Date,
    endDate?: Date
  ): Promise<OutcomeTrend[]> {
    const matchStage: Record<string, unknown> = {
      outcome: { $exists: true, $ne: null },
    };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = startDate;
      if (endDate) matchStage.createdAt.$lte = endDate;
    }

    let dateFormat: string;
    switch (interval) {
      case 'hour':
        dateFormat = '%Y-%m-%d %H:00';
        break;
      case 'week':
        dateFormat = '%Y-W%V';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const results = await ConversationSample.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          total: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ['$outcome.success', true] }, 1, 0] },
          },
          avgResolutionTime: { $avg: '$outcome.resolutionTime' },
          avgSatisfaction: { $avg: '$outcome.satisfaction' },
        },
      },
      {
        $project: {
          _id: 1,
          resolutionRate: {
            $multiply: [{ $divide: ['$successful', '$total'] }, 100],
          },
          avgResolutionTime: { $round: ['$avgResolutionTime', 0] },
          satisfactionScore: { $round: ['$avgSatisfaction', 2] },
          volume: '$total',
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return results.map((r) => ({
      date: new Date(r._id),
      resolutionRate: r.resolutionRate,
      avgResolutionTime: r.avgResolutionTime || 0,
      satisfactionScore: r.satisfactionScore || 0,
      volume: r.volume,
    }));
  }

  async getOutcomeByChannel(startDate?: Date, endDate?: Date): Promise<Record<string, OutcomeMetrics>> {
    const matchStage: Record<string, unknown> = {
      outcome: { $exists: true, $ne: null },
    };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = startDate;
      if (endDate) matchStage.createdAt.$lte = endDate;
    }

    const results = await ConversationSample.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$channel',
          total: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ['$outcome.success', true] }, 1, 0] },
          },
          avgResolutionTime: { $avg: '$outcome.resolutionTime' },
          avgSatisfaction: { $avg: '$outcome.satisfaction' },
        },
      },
    ]);

    const metricsByChannel: Record<string, OutcomeMetrics> = {};

    for (const result of results) {
      const resolutionTimes = await ConversationSample.find({
        ...matchStage,
        channel: result._id,
        'outcome.resolutionTime': { $exists: true },
      }).select('outcome.resolutionTime');

      const times = resolutionTimes
        .map((c) => c.outcome!.resolutionTime!)
        .sort((a, b) => a - b);

      metricsByChannel[result._id] = {
        totalConversations: result.total,
        successfulConversations: result.successful,
        failedConversations: result.total - result.successful,
        resolutionRate: result.total > 0 ? (result.successful / result.total) * 100 : 0,
        avgResolutionTime: result.avgResolutionTime || 0,
        medianResolutionTime: times.length > 0 ? times[Math.floor(times.length / 2)] : 0,
        satisfactionScore: result.avgSatisfaction || 0,
        outcomeDistribution: {},
      };
    }

    return metricsByChannel;
  }

  async getOutcomeByIntent(startDate?: Date, endDate?: Date): Promise<Record<string, OutcomeMetrics>> {
    const matchStage: Record<string, unknown> = {
      outcome: { $exists: true, $ne: null },
    };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = startDate;
      if (endDate) matchStage.createdAt.$lte = endDate;
    }

    const results = await ConversationSample.aggregate([
      { $match: matchStage },
      { $unwind: '$extractedIntents' },
      {
        $group: {
          _id: '$extractedIntents.name',
          total: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ['$outcome.success', true] }, 1, 0] },
          },
          avgResolutionTime: { $avg: '$outcome.resolutionTime' },
          avgSatisfaction: { $avg: '$outcome.satisfaction' },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 20 },
    ]);

    const metricsByIntent: Record<string, OutcomeMetrics> = {};

    for (const result of results) {
      metricsByIntent[result._id] = {
        totalConversations: result.total,
        successfulConversations: result.successful,
        failedConversations: result.total - result.successful,
        resolutionRate: result.total > 0 ? (result.successful / result.total) * 100 : 0,
        avgResolutionTime: Math.round(result.avgResolutionTime || 0),
        medianResolutionTime: 0,
        satisfactionScore: Math.round((result.avgSatisfaction || 0) * 100) / 100,
        outcomeDistribution: {},
      };
    }

    return metricsByIntent;
  }
}

export const outcomeTracker = new OutcomeTracker();
