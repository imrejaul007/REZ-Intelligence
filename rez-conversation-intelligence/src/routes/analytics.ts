import { Router, Request, Response, NextFunction } from 'express';
import { ConversationSample } from '../models/index.js';
import { intentExtractor } from '../services/intentExtractor.js';
import { sentimentAnalyzer } from '../services/sentimentAnalyzer.js';
import { outcomeTracker } from '../services/outcomeTracker.js';
import { feedbackLoop } from '../services/feedbackLoop.js';
import logger from './utils/logger.js';

const router = Router();

// Get intent distribution
router.get('/intents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const distribution = await ConversationSample.getIntentDistribution(startDate, endDate);

    res.json({
      success: true,
      data: {
        intents: distribution.map((d) => ({
          intent: d._id,
          count: d.count,
          avgConfidence: d.avgConfidence,
        })),
        total: distribution.reduce((sum, d) => sum + d.count, 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get sentiment trends
router.get('/sentiment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const interval = (req.query.interval as string) || 'day';
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const trends = await ConversationSample.getSentimentTrend(interval, startDate, endDate);

    res.json({
      success: true,
      data: {
        trends: trends.map((t) => ({
          date: t._id,
          avgScore: t.avgScore,
          avgComparative: t.avgComparative,
          count: t.count,
          positiveCount: t.positiveCount,
          negativeCount: t.negativeCount,
          positiveRatio: t.count > 0 ? t.positiveCount / t.count : 0,
          negativeRatio: t.count > 0 ? t.negativeCount / t.count : 0,
        })),
        summary: {
          overallAvgScore: trends.length > 0
            ? trends.reduce((sum, t) => sum + t.avgScore, 0) / trends.length
            : 0,
          totalConversations: trends.reduce((sum, t) => sum + t.count, 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get outcome metrics
router.get('/outcomes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const metrics = await outcomeTracker.getMetrics(startDate, endDate);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

// Get outcome trends
router.get('/outcomes/trend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const interval = (req.query.interval as 'hour' | 'day' | 'week' | 'month') || 'day';
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const trends = await outcomeTracker.getTrend(interval, startDate, endDate);

    res.json({
      success: true,
      data: {
        trends,
        summary: {
          avgResolutionRate: trends.length > 0
            ? trends.reduce((sum, t) => sum + t.resolutionRate, 0) / trends.length
            : 0,
          avgResolutionTime: trends.length > 0
            ? trends.reduce((sum, t) => sum + t.avgResolutionTime, 0) / trends.length
            : 0,
          avgSatisfaction: trends.length > 0
            ? trends.reduce((sum, t) => sum + t.satisfactionScore, 0) / trends.length
            : 0,
          totalVolume: trends.reduce((sum, t) => sum + t.volume, 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get outcomes by channel
router.get('/outcomes/by-channel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const metrics = await outcomeTracker.getOutcomeByChannel(startDate, endDate);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

// Get outcomes by intent
router.get('/outcomes/by-intent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const metrics = await outcomeTracker.getOutcomeByIntent(startDate, endDate);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

// Get feedback statistics
router.get('/feedback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const stats = await feedbackLoop.getStats(startDate, endDate);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

// Get conversation summary
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const matchStage: Record<string, unknown> = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = startDate;
      if (endDate) matchStage.createdAt.$lte = endDate;
    }

    const [
      totalConversations,
      activeConversations,
      labeledConversations,
      intentDistribution,
      sentimentStats,
      outcomeMetrics,
      feedbackStats,
    ] = await Promise.all([
      ConversationSample.countDocuments(matchStage),
      ConversationSample.countDocuments({ ...matchStage, status: 'active' }),
      ConversationSample.countDocuments({ ...matchStage, isLabeled: true }),
      ConversationSample.getIntentDistribution(startDate, endDate),
      outcomeTracker.getMetrics(startDate, endDate),
      feedbackLoop.getStats(startDate, endDate),
    ]);

    // Get sentiment distribution
    const sentimentDist = await ConversationSample.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$aggregatedSentiment.label',
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        conversations: {
          total: totalConversations,
          active: activeConversations,
          labeled: labeledConversations,
          labelingRate: totalConversations > 0
            ? (labeledConversations / totalConversations) * 100
            : 0,
        },
        intents: {
          count: intentDistribution.length,
          topIntents: intentDistribution.slice(0, 5).map((d) => ({
            intent: d._id,
            count: d.count,
          })),
        },
        sentiment: {
          distribution: {
            positive: sentimentDist.find((d) => d._id === 'positive')?.count || 0,
            neutral: sentimentDist.find((d) => d._id === 'neutral')?.count || 0,
            negative: sentimentDist.find((d) => d._id === 'negative')?.count || 0,
          },
        },
        outcomes: {
          resolutionRate: outcomeMetrics.resolutionRate,
          avgResolutionTime: outcomeMetrics.avgResolutionTime,
          satisfactionScore: outcomeMetrics.satisfactionScore,
        },
        feedback: {
          total: feedbackStats.totalFeedback,
          avgRating: feedbackStats.averageRating,
          pendingReview: feedbackStats.pendingReview,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Analyze text (single text analysis)
router.post('/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required for analysis',
      });
    }

    const [intent, sentiment] = await Promise.all([
      intentExtractor.extract(text),
      sentimentAnalyzer.analyze(text),
    ]);

    res.json({
      success: true,
      data: {
        intent,
        sentiment,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Batch analyze texts
router.post('/analyze/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { texts } = req.body;

    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Texts array is required',
      });
    }

    if (texts.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 texts per batch',
      });
    }

    const [intents, sentiments] = await Promise.all([
      intentExtractor.extractBatch(texts),
      sentimentAnalyzer.analyzeBatch(texts),
    ]);

    res.json({
      success: true,
      data: {
        results: texts.map((text, i) => ({
          text,
          intent: intents[i],
          sentiment: sentiments[i],
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get known intents
router.get('/intents/known', (_req: Request, res: Response) => {
  const knownIntents = intentExtractor.getKnownIntents();

  res.json({
    success: true,
    data: {
      intents: knownIntents,
      count: knownIntents.length,
    },
  });
});

export default router;
