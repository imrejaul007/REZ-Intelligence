import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { leadScoreRequestSchema } from '../middleware/validation';
import { aiLimiter, readLimiter } from '../middleware/rateLimit';
import { authenticate } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

const router = Router();

router.use(authenticate);

/**
 * POST /api/v1/leads/score
 * Score a lead
 */
router.post(
  '/score',
  aiLimiter,
  validate(leadScoreRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { leadData, merchantId } = req.body;

    logger.info('Scoring lead', { merchantId, customerId: leadData.customerId });

    // Calculate lead score
    const score = calculateLeadScore(leadData);

    res.json({
      success: true,
      data: {
        scoreId: `LS-${Date.now().toString(36)}-${uuidv4().substring(0, 6).toUpperCase()}`,
        leadData,
        ...score,
        timestamp: new Date(),
      },
    });
  })
);

/**
 * POST /api/v1/leads/bulk-score
 * Bulk lead scoring
 */
router.post(
  '/bulk-score',
  aiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { leads, merchantId } = req.body;

    if (!Array.isArray(leads) || leads.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Leads array is required',
      });
      return;
    }

    if (leads.length > 100) {
      res.status(400).json({
        success: false,
        error: 'Maximum 100 leads per request',
      });
      return;
    }

    const results = leads.map(lead => {
      const score = calculateLeadScore(lead);
      return {
        customerId: lead.customerId,
        ...score,
      };
    });

    logger.info('Bulk lead scoring completed', { merchantId, count: leads.length });

    res.json({
      success: true,
      data: results,
      count: results.length,
    });
  })
);

/**
 * GET /api/v1/leads/priorities
 * Get lead priorities
 */
router.get(
  '/priorities',
  readLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const merchantId = req.user?.merchantId || 'default';

    // Simulated priority leads
    const priorities = {
      hot: { count: 5, leads: [] },
      warm: { count: 12, leads: [] },
      cold: { count: 28, leads: [] },
      message: 'Connect to CRM for actual lead data',
    };

    res.json({
      success: true,
      data: priorities,
    });
  })
);

/**
 * Calculate lead score
 */
function calculateLeadScore(lead: any) {
  let totalScore = 0;
  const maxScore = 100;

  const breakdown = {
    intent: { score: 0, maxScore: 30, factors: [] },
    engagement: { score: 0, maxScore: 40, factors: [] },
    demographic: { score: 0, maxScore: 15, factors: [] },
    behavioral: { score: 0, maxScore: 15, factors: [] },
  };

  // Intent scoring
  if (lead.interest?.timeline === 'immediate') {
    breakdown.intent.score += 30;
    breakdown.intent.factors.push({ name: 'Immediate purchase intent', value: 30, maxValue: 30, weight: 1 });
  } else if (lead.interest?.timeline === '1_month') {
    breakdown.intent.score += 20;
    breakdown.intent.factors.push({ name: 'Purchase within 1 month', value: 20, maxValue: 30, weight: 0.67 });
  } else if (lead.interest?.timeline === '3_months') {
    breakdown.intent.score += 10;
    breakdown.intent.factors.push({ name: 'Purchase within 3 months', value: 10, maxValue: 30, weight: 0.33 });
  } else {
    breakdown.intent.factors.push({ name: 'Exploring options', value: 0, maxValue: 30, weight: 0 });
  }

  if (lead.interest?.vehicleId) {
    breakdown.intent.score += 5;
    breakdown.intent.factors.push({ name: 'Specific vehicle interest', value: 5, maxValue: 5, weight: 1 });
  }

  if (lead.interest?.budget?.max) {
    const budgetScore = Math.min(10, lead.interest.budget.max / 50000);
    breakdown.intent.score += budgetScore;
    breakdown.intent.factors.push({ name: 'Budget defined', value: budgetScore, maxValue: 10, weight: budgetScore / 10 });
  }

  // Engagement scoring
  const pagesViewed = lead.engagement?.pagesViewed || 0;
  breakdown.engagement.score += Math.min(15, pagesViewed);
  breakdown.engagement.factors.push({ name: 'Pages viewed', value: Math.min(15, pagesViewed), maxValue: 15, weight: Math.min(1, pagesViewed / 15) });

  const inquiries = lead.engagement?.inquiriesMade || 0;
  breakdown.engagement.score += Math.min(10, inquiries * 3);
  breakdown.engagement.factors.push({ name: 'Inquiries made', value: Math.min(10, inquiries * 3), maxValue: 10, weight: Math.min(1, inquiries / 3.33) });

  const testDrives = lead.engagement?.testDrivesTaken || 0;
  breakdown.engagement.score += Math.min(15, testDrives * 7);
  breakdown.engagement.factors.push({ name: 'Test drives taken', value: Math.min(15, testDrives * 7), maxValue: 15, weight: Math.min(1, testDrives / 2.14) });

  // Demographic scoring
  if (lead.demographic?.location) {
    breakdown.demographic.score += 5;
    breakdown.demographic.factors.push({ name: 'Location known', value: 5, maxValue: 5, weight: 1 });
  }

  if (lead.demographic?.occupation) {
    breakdown.demographic.score += 5;
    breakdown.demographic.factors.push({ name: 'Occupation known', value: 5, maxValue: 5, weight: 1 });
  }

  if (lead.customerPhone) {
    breakdown.demographic.score += 5;
    breakdown.demographic.factors.push({ name: 'Contact info available', value: 5, maxValue: 5, weight: 1 });
  }

  // Behavioral scoring
  if (lead.source === 'walk-in' || lead.source === 'referral') {
    breakdown.behavioral.score += 10;
    breakdown.behavioral.factors.push({ name: 'High-intent source', value: 10, maxValue: 10, weight: 1 });
  } else if (lead.source === 'web' || lead.source === 'mobile') {
    breakdown.behavioral.score += 5;
    breakdown.behavioral.factors.push({ name: 'Digital source', value: 5, maxValue: 10, weight: 0.5 });
  }

  if (lead.engagement?.lastActivity) {
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(lead.engagement.lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    );
    const recencyScore = Math.max(0, 5 - daysSinceActivity * 0.5);
    breakdown.behavioral.score += recencyScore;
    breakdown.behavioral.factors.push({ name: 'Recent activity', value: recencyScore, maxValue: 5, weight: recencyScore / 5 });
  }

  totalScore = breakdown.intent.score + breakdown.engagement.score + breakdown.demographic.score + breakdown.behavioral.score;

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (totalScore >= 80) grade = 'A';
  else if (totalScore >= 60) grade = 'B';
  else if (totalScore >= 40) grade = 'C';
  else if (totalScore >= 20) grade = 'D';
  else grade = 'F';

  // Calculate percentile
  const percentile = Math.round((totalScore / maxScore) * 100);

  // Generate insights
  const insights = [];
  if (breakdown.engagement.score >= 30) {
    insights.push({ type: 'strength', description: 'High engagement level' });
  }
  if (breakdown.intent.score >= 20) {
    insights.push({ type: 'strength', description: 'Clear purchase intent' });
  }
  if (breakdown.behavioral.score < 5) {
    insights.push({ type: 'concern', description: 'Low recent activity - may need re-engagement' });
  }
  if (totalScore >= 60) {
    insights.push({ type: 'opportunity', description: 'Good fit for immediate outreach' });
  }

  // Recommended actions
  const recommendedActions = [];
  if (totalScore >= 70) {
    recommendedActions.push({ action: 'Call within 24 hours', priority: 'high', reason: 'High-value lead' });
    recommendedActions.push({ action: 'Schedule test drive', priority: 'high', reason: 'Strong purchase intent' });
  } else if (totalScore >= 40) {
    recommendedActions.push({ action: 'Send follow-up email', priority: 'medium', reason: 'Warm lead - nurture relationship' });
    recommendedActions.push({ action: 'Share relevant inventory', priority: 'medium', reason: 'Maintain engagement' });
  } else {
    recommendedActions.push({ action: 'Add to nurture sequence', priority: 'low', reason: 'Build relationship over time' });
  }

  return {
    score: { total: Math.round(totalScore), max: maxScore, grade, percentile },
    breakdown: Object.entries(breakdown).map(([category, data]) => ({
      category,
      ...data,
    })),
    insights,
    recommendedActions,
    nextBestAction: recommendedActions[0]?.action || 'No action recommended',
    conversionProbability: totalScore / 100,
  };
}

export default router;