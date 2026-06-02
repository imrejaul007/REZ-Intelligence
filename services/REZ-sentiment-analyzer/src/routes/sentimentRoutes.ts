import { Router, Request, Response } from 'express';
import { SocialPostSchema, SocialPost } from '../types';
import { sentimentAnalyzerService } from '../services/sentimentService';
import logger from '../utils/logger';
import { ZodError } from 'zod';

const router = Router();

router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = SocialPostSchema.parse(req.body);
    const post = validatedData as SocialPost;
    const sentiment = sentimentAnalyzerService.analyzeSentiment(post);

    logger.info(`Sentiment analyzed for post: ${post.postId}`, {
      postId: post.postId,
      sentiment: sentiment.overallSentiment,
      score: sentiment.sentimentScore,
    });

    res.json({
      success: true,
      data: sentiment,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    logger.error('Error analyzing sentiment', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.post('/analyze/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { posts } = req.body;

    if (!Array.isArray(posts)) {
      res.status(400).json({
        success: false,
        error: 'posts must be an array',
      });
      return;
    }

    const results = posts.map((post) => {
      try {
        const validatedData = SocialPostSchema.parse(post);
        return sentimentAnalyzerService.analyzeSentiment(validatedData as SocialPost);
      } catch (error) {
        return {
          postId: post.postId || 'unknown',
          error: 'Validation failed',
        };
      }
    });

    const alerts = sentimentAnalyzerService.checkAlerts(
      results.filter((r) => 'sentimentScore' in r) as any[]
    );

    logger.info(`Batch sentiment analysis completed for ${posts.length} posts`);

    res.json({
      success: true,
      data: results,
      total: posts.length,
      alerts: alerts.length > 0 ? alerts : undefined,
    });
  } catch (error) {
    logger.error('Error analyzing batch sentiment', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.post('/trends', async (req: Request, res: Response): Promise<void> => {
  try {
    const { scores, startDate, endDate } = req.body;

    if (!Array.isArray(scores)) {
      res.status(400).json({
        success: false,
        error: 'scores must be an array',
      });
      return;
    }

    const trendAnalysis = sentimentAnalyzerService.analyzeTrends(scores, startDate, endDate);

    logger.info('Trend analysis completed', {
      period: trendAnalysis.period,
      sentiment: trendAnalysis.averageSentiment,
      trend: trendAnalysis.sentimentTrend,
    });

    res.json({
      success: true,
      data: trendAnalysis,
    });
  } catch (error) {
    logger.error('Error analyzing trends', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.get('/alerts', (_req: Request, res: Response): void => {
  const alerts = sentimentAnalyzerService.getUnacknowledgedAlerts();
  res.json({
    success: true,
    data: alerts,
    count: alerts.length,
  });
});

router.post('/alerts/:alertId/acknowledge', (req: Request, res: Response): void => {
  const { alertId } = req.params;
  const acknowledged = sentimentAnalyzerService.acknowledgeAlert(alertId);

  if (acknowledged) {
    res.json({
      success: true,
      message: 'Alert acknowledged',
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Alert not found',
    });
  }
});

router.post('/competitors/compare', async (req: Request, res: Response): Promise<void> => {
  try {
    const { brandScores } = req.body;

    if (typeof brandScores !== 'object' || brandScores === null) {
      res.status(400).json({
        success: false,
        error: 'brandScores must be an object with brand names as keys',
      });
      return;
    }

    const comparison = sentimentAnalyzerService.compareCompetitors(brandScores);

    logger.info('Competitor comparison completed', {
      brands: comparison.map(c => c.brand),
    });

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    logger.error('Error comparing competitors', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    modelLoaded: true,
    uptime: process.uptime(),
    version: sentimentAnalyzerService.getModelVersion(),
  });
});

export default router;
