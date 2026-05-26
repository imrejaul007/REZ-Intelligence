import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { competitorService } from '../services/competitorService';
import { authMiddleware } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import {
  CompetitorVisit,
  VisitType,
  SignalType,
  Severity
} from '../types/interfaces';

const router = Router();

// Validation schemas
const competitorVisitSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  competitorId: z.string().min(1, 'Competitor ID is required'),
  competitorName: z.string().min(1, 'Competitor name is required'),
  category: z.string().min(1, 'Category is required'),
  visitDate: z.string().datetime().or(z.date()).optional(),
  spend: z.number().min(0).default(0),
  visitType: z.enum(['delivery', 'dine_in', 'pickup']),
  metadata: z.record(z.unknown()).optional()
});

const detectionInputSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  viewedCompetitorPrices: z.number().min(0).default(0),
  ratingTrend: z.number().default(0),
  visitsToNewCompetitor: z.number().min(0).default(0),
  totalSpending: z.number().min(0).default(0),
  competitorSpending: z.number().min(0).default(0),
  lastOrderDate: z.string().datetime().or(z.date()).optional(),
  averageOrderValue: z.number().min(0).default(0),
  orderFrequency: z.number().min(0).default(0),
  competitorVisits: z.array(z.object({
    competitorId: z.string(),
    competitorName: z.string(),
    category: z.string(),
    visitDate: z.string().datetime().or(z.date()),
    spend: z.number().min(0),
    visitType: z.enum(['delivery', 'dine_in', 'pickup']),
    metadata: z.record(z.unknown()).optional()
  })).optional()
});

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  minScore: z.coerce.number().min(0).max(100).optional(),
  minCompetitorShare: z.coerce.number().min(0).max(100).optional()
});

/**
 * GET /api/competitor/:userId
 * Get competitor profile for a user
 */
router.get('/:userId',
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const profile = await competitorService.getProfile(userId);

      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'Profile not found',
          timestamp: new Date()
        });
        return;
      }

      res.json({
        success: true,
        data: profile,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting competitor profile:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date()
      });
    }
  }
);

/**
 * GET /api/competitor/:userId/signals
 * Get switch signals for a user
 */
router.get('/:userId/signals',
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const signals = await competitorService.getSwitchSignals(userId);

      res.json({
        success: true,
        data: signals,
        count: signals.length,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting switch signals:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date()
      });
    }
  }
);

/**
 * GET /api/competitor/:userId/winback
 * Get win-back potential for a user
 */
router.get('/:userId/winback',
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const winBack = await competitorService.getWinBackPotential(userId);

      if (!winBack) {
        res.status(404).json({
          success: false,
          error: 'Profile not found',
          timestamp: new Date()
        });
        return;
      }

      res.json({
        success: true,
        data: winBack,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting win-back potential:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date()
      });
    }
  }
);

/**
 * POST /api/competitor/visit
 * Record a competitor visit
 */
router.post('/visit',
  authMiddleware,
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const validation = competitorVisitSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
          timestamp: new Date()
        });
        return;
      }

      const { userId, competitorId, competitorName, category, visitDate, spend, visitType, metadata } = validation.data;

      const visit: CompetitorVisit = {
        competitorId,
        competitorName,
        category,
        visitDate: visitDate ? new Date(visitDate) : new Date(),
        spend,
        visitType: visitType as VisitType,
        metadata
      };

      const profile = await competitorService.recordCompetitorVisit(userId, visit);

      res.status(201).json({
        success: true,
        data: profile,
        message: 'Competitor visit recorded',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error recording competitor visit:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date()
      });
    }
  }
);

/**
 * POST /api/competitor/detect
 * Run detection on user profile
 */
router.post('/detect',
  authMiddleware,
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const validation = detectionInputSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
          timestamp: new Date()
        });
        return;
      }

      const profile = await competitorService.updateProfileWithDetection(validation.data);

      res.status(200).json({
        success: true,
        data: profile,
        message: 'Detection completed',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error running detection:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date()
      });
    }
  }
);

/**
 * GET /api/competitor/switchers
 * Get likely switchers (high risk users)
 */
router.get('/list/switchers',
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const queryValidation = paginationSchema.safeParse(req.query);

      if (!queryValidation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: queryValidation.error.issues,
          timestamp: new Date()
        });
        return;
      }

      const { limit, minCompetitorShare } = queryValidation.data;

      const switchers = await competitorService.getSwitchers(
        limit,
        minCompetitorShare
      );

      res.json({
        success: true,
        data: switchers,
        count: switchers.length,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting switchers:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date()
      });
    }
  }
);

/**
 * GET /api/competitor/winback-list
 * Get win-back candidates
 */
router.get('/list/winback',
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const queryValidation = paginationSchema.safeParse(req.query);

      if (!queryValidation.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: queryValidation.error.issues,
          timestamp: new Date()
        });
        return;
      }

      const { limit, minScore } = queryValidation.data;

      const candidates = await competitorService.getWinBackCandidates(
        limit,
        minScore
      );

      // Format response with win-back details
      const formattedCandidates = candidates.map(profile => ({
        userId: profile.userId,
        winBackScore: profile.winBackPotential?.score || 0,
        tier: profile.winBackPotential?.tier || 'cold',
        topTrigger: profile.winBackPotential?.topTrigger || '',
        optimalChannel: profile.winBackPotential?.optimalChannel || 'sms',
        optimalTiming: profile.winBackPotential?.optimalTiming || 'evening',
        estimatedValue: profile.winBackPotential?.estimatedValue || 0,
        competitorsTargeting: profile.winBackPotential?.competitorsTargeting || [],
        recommendedOffer: profile.winBackPotential?.recommendedOffer || '',
        loyaltyScore: profile.loyaltyScore,
        competitorShare: profile.competitorActivity.competitorShare,
        lastUpdated: profile.lastUpdated
      }));

      res.json({
        success: true,
        data: formattedCandidates,
        count: formattedCandidates.length,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting win-back list:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date()
      });
    }
  }
);

/**
 * GET /api/competitor/analysis
 * Get competitor analysis
 */
router.get('/analysis/competitors',
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { competitorId } = req.query;

      const analysis = await competitorService.getCompetitorAnalysis(
        competitorId as string | undefined
      );

      res.json({
        success: true,
        data: analysis,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting competitor analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date()
      });
    }
  }
);

/**
 * DELETE /api/competitor/:userId/signals
 * Clear old signals
 */
router.delete('/:userId/signals',
  authMiddleware,
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { olderThanDays } = req.query;

      const days = parseInt(olderThanDays as string, 10) || 90;
      const clearedCount = await competitorService.clearOldSignals(userId, days);

      res.json({
        success: true,
        message: `Cleared ${clearedCount} old signals`,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error clearing signals:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date()
      });
    }
  }
);

/**
 * GET /api/competitor/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'rez-competitor-detection',
    status: 'healthy',
    timestamp: new Date()
  });
});

export default router;
