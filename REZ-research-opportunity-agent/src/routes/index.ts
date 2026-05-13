import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  researchAgent,
  opportunityAgent,
  insightAgent,
} from '../agents/index.js';
import {
  opportunityService,
  alertService,
  campaignRecommendationService,
} from '../services/index.js';
import { dailyWorker, weeklyWorker, realTimeWorker } from '../workers/index.js';
import { InsightReportModel } from '../models/index.js';
import { OpportunityStatus, OpportunityType } from '../types/index.js';
import { API_LIMITS } from '../constants/thresholds.js';
import logger from '../utils/logger.js';

const log = logger.child({ context: 'Routes' });

const router = Router();

// Validation schemas
const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(API_LIMITS.MAX_PAGE_SIZE).default(20),
});

const OpportunityStatusUpdateSchema = z.object({
  status: z.nativeEnum(OpportunityStatus),
});

const CampaignFromInsightSchema = z.object({
  campaignName: z.string().optional(),
  startDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  budget: z.number().positive().optional(),
});

const QuerySchema = z.object({
  query: z.string().min(1).max(API_LIMITS.MAX_QUERY_LENGTH),
  context: z.record(z.unknown()).optional(),
});

// Helper function for API responses
function apiResponse<T>(res: Response, data: T, meta?: object) {
  res.json({ success: true, data, meta });
}

function apiError(res: Response, statusCode: number, code: string, message: string, details?: unknown) {
  res.status(statusCode).json({
    success: false,
    error: { code, message, details },
  });
}

// ============================================
// RESEARCH ROUTES
// ============================================

/**
 * POST /api/research/analyze
 * Full business analysis
 */
router.post('/research/analyze', async (req: Request, res: Response) => {
  try {
    log.info('Received full analysis request');

    const analysis = await researchAgent.conductFullAnalysis();

    apiResponse(res, {
      summary: analysis.summary,
      sections: analysis.sections,
      metrics: analysis.metrics,
      insights: analysis.insights,
      generatedAt: analysis.generatedAt,
    });
  } catch (error) {
    log.error('Full analysis failed', { error: (error as Error).message });
    apiError(res, 500, 'ANALYSIS_FAILED', 'Failed to conduct full analysis');
  }
});

/**
 * POST /api/research/competitors
 * Competitor analysis
 */
router.post('/research/competitors', async (req: Request, res: Response) => {
  try {
    log.info('Received competitor analysis request');

    const analysis = await researchAgent.analyzeCompetitors();

    apiResponse(res, analysis);
  } catch (error) {
    log.error('Competitor analysis failed', { error: (error as Error).message });
    apiError(res, 500, 'ANALYSIS_FAILED', 'Failed to conduct competitor analysis');
  }
});

/**
 * POST /api/research/segments
 * Segment deep-dive
 */
router.post('/research/segments', async (req: Request, res: Response) => {
  try {
    log.info('Received segment analysis request');

    const analysis = await researchAgent.analyzeSegments();

    apiResponse(res, analysis);
  } catch (error) {
    log.error('Segment analysis failed', { error: (error as Error).message });
    apiError(res, 500, 'ANALYSIS_FAILED', 'Failed to conduct segment analysis');
  }
});

/**
 * GET /api/research/reports
 * List insight reports
 */
router.get('/research/reports', async (req: Request, res: Response) => {
  try {
    const pagination = PaginationSchema.parse(req.query);
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const type = req.query.type as 'daily' | 'weekly' | 'monthly' | 'custom' | undefined;

    let reports;
    if (type) {
      reports = await InsightReportModel.findByType(type);
    } else {
      reports = await InsightReportModel.findRecent(limit);
    }

    const total = await InsightReportModel.countDocuments(type ? { type } : {});

    apiResponse(res, reports, {
      page,
      limit,
      total,
      hasMore: offset + reports.length < total,
    });
  } catch (error) {
    log.error('Failed to list reports', { error: (error as Error).message });
    apiError(res, 500, 'QUERY_FAILED', 'Failed to list reports');
  }
});

// ============================================
// OPPORTUNITIES ROUTES
// ============================================

/**
 * GET /api/opportunities
 * List opportunities
 */
router.get('/opportunities', async (req: Request, res: Response) => {
  try {
    const pagination = PaginationSchema.parse(req.query);
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const status = req.query.status as OpportunityStatus | undefined;
    const type = req.query.type as OpportunityType | undefined;

    const result = await opportunityService.findAll({
      status,
      type,
      limit,
      offset,
    });

    apiResponse(res, result.opportunities, {
      page,
      limit,
      total: result.total,
      hasMore: offset + result.opportunities.length < result.total,
    });
  } catch (error) {
    log.error('Failed to list opportunities', { error: (error as Error).message });
    apiError(res, 500, 'QUERY_FAILED', 'Failed to list opportunities');
  }
});

/**
 * GET /api/opportunities/:id
 * Get opportunity details
 */
router.get('/opportunities/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const opportunity = await opportunityService.findById(id);

    if (!opportunity) {
      apiError(res, 404, 'NOT_FOUND', `Opportunity not found: ${id}`);
      return;
    }

    apiResponse(res, opportunity);
  } catch (error) {
    log.error('Failed to get opportunity', { error: (error as Error).message });
    apiError(res, 500, 'QUERY_FAILED', 'Failed to get opportunity');
  }
});

/**
 * POST /api/opportunities/generate
 * Generate new opportunities
 */
router.post('/opportunities/generate', async (req: Request, res: Response) => {
  try {
    log.info('Generating new opportunities');

    const result = await opportunityAgent.generateOpportunities();

    apiResponse(res, {
      opportunities: result.opportunities,
      summary: result.summary,
      highPriorityCount: result.highPriorityCount,
    });
  } catch (error) {
    log.error('Failed to generate opportunities', { error: (error as Error).message });
    apiError(res, 500, 'GENERATION_FAILED', 'Failed to generate opportunities');
  }
});

/**
 * PATCH /api/opportunities/:id/status
 * Update opportunity status
 */
router.patch('/opportunities/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = OpportunityStatusUpdateSchema.parse(req.body);

    const opportunity = await opportunityService.updateStatus(id, status);

    if (!opportunity) {
      apiError(res, 404, 'NOT_FOUND', `Opportunity not found: ${id}`);
      return;
    }

    apiResponse(res, opportunity);
  } catch (error) {
    if (error instanceof z.ZodError) {
      apiError(res, 400, 'VALIDATION_ERROR', 'Invalid request', error.errors);
      return;
    }
    log.error('Failed to update opportunity status', { error: (error as Error).message });
    apiError(res, 500, 'UPDATE_FAILED', 'Failed to update opportunity status');
  }
});

/**
 * POST /api/opportunities/:id/approve
 * Approve opportunity
 */
router.post('/opportunities/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const opportunity = await opportunityService.approve(id);

    if (!opportunity) {
      apiError(res, 404, 'NOT_FOUND', `Opportunity not found: ${id}`);
      return;
    }

    apiResponse(res, opportunity);
  } catch (error) {
    log.error('Failed to approve opportunity', { error: (error as Error).message });
    apiError(res, 500, 'APPROVAL_FAILED', 'Failed to approve opportunity');
  }
});

/**
 * POST /api/opportunities/:id/execute
 * Create campaign from opportunity
 */
router.post('/opportunities/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const params = CampaignFromInsightSchema.parse(req.body);

    const campaign = await campaignRecommendationService.createCampaignFromInsight({
      opportunityId: id,
      ...params,
    });

    // Update opportunity status to executed
    await opportunityService.updateStatus(id, OpportunityStatus.EXECUTED);

    apiResponse(res, campaign);
  } catch (error) {
    if (error instanceof z.ZodError) {
      apiError(res, 400, 'VALIDATION_ERROR', 'Invalid request', error.errors);
      return;
    }
    log.error('Failed to execute opportunity', { error: (error as Error).message });
    apiError(res, 500, 'EXECUTION_FAILED', 'Failed to execute opportunity');
  }
});

/**
 * GET /api/opportunities/stats
 * Get opportunity statistics
 */
router.get('/opportunities/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await opportunityService.getStats();
    apiResponse(res, stats);
  } catch (error) {
    log.error('Failed to get stats', { error: (error as Error).message });
    apiError(res, 500, 'QUERY_FAILED', 'Failed to get statistics');
  }
});

// ============================================
// INSIGHTS ROUTES
// ============================================

/**
 * GET /api/insights/daily
 * Daily insight summary
 */
router.get('/insights/daily', async (_req: Request, res: Response) => {
  try {
    const dailyInsight = await insightAgent.generateDailyInsight();
    apiResponse(res, dailyInsight);
  } catch (error) {
    log.error('Failed to generate daily insight', { error: (error as Error).message });
    apiError(res, 500, 'GENERATION_FAILED', 'Failed to generate daily insight');
  }
});

/**
 * GET /api/insights/alerts
 * Active alerts
 */
router.get('/insights/alerts', async (req: Request, res: Response) => {
  try {
    const acknowledged = req.query.acknowledged === 'true' ? true :
                         req.query.acknowledged === 'false' ? false : undefined;

    const result = await alertService.findAll({
      acknowledged,
      limit: API_LIMITS.DEFAULT_PAGE_SIZE,
    });

    apiResponse(res, result.alerts, { total: result.total });
  } catch (error) {
    log.error('Failed to list alerts', { error: (error as Error).message });
    apiError(res, 500, 'QUERY_FAILED', 'Failed to list alerts');
  }
});

/**
 * POST /api/insights/query
 * Natural language query
 */
router.post('/insights/query', async (req: Request, res: Response) => {
  try {
    const { query, context } = QuerySchema.parse(req.body);

    const response = await insightAgent.query({ query, context });

    apiResponse(res, response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      apiError(res, 400, 'VALIDATION_ERROR', 'Invalid request', error.errors);
      return;
    }
    log.error('Query processing failed', { error: (error as Error).message });
    apiError(res, 500, 'QUERY_FAILED', 'Failed to process query');
  }
});

// ============================================
// CAMPAIGNS ROUTES
// ============================================

/**
 * POST /api/campaigns/from-insight
 * Create campaign from insight
 */
router.post('/campaigns/from-insight', async (req: Request, res: Response) => {
  try {
    const params = CampaignFromInsightSchema.extend({
      opportunityId: z.string().uuid(),
    }).parse(req.body);

    const campaign = await campaignRecommendationService.createCampaignFromInsight(params);

    apiResponse(res, campaign);
  } catch (error) {
    if (error instanceof z.ZodError) {
      apiError(res, 400, 'VALIDATION_ERROR', 'Invalid request', error.errors);
      return;
    }
    log.error('Failed to create campaign', { error: (error as Error).message });
    apiError(res, 500, 'CREATION_FAILED', 'Failed to create campaign');
  }
});

// ============================================
// WORKER ROUTES
// ============================================

/**
 * POST /api/workers/daily/run
 * Run daily briefing on-demand
 */
router.post('/workers/daily/run', async (_req: Request, res: Response) => {
  try {
    const task = await dailyWorker.runOnDemand();
    apiResponse(res, task);
  } catch (error) {
    log.error('Failed to run daily briefing', { error: (error as Error).message });
    apiError(res, 500, 'EXECUTION_FAILED', 'Failed to run daily briefing');
  }
});

/**
 * POST /api/workers/weekly/run
 * Run weekly report on-demand
 */
router.post('/workers/weekly/run', async (_req: Request, res: Response) => {
  try {
    const task = await weeklyWorker.runOnDemand();
    apiResponse(res, task);
  } catch (error) {
    log.error('Failed to run weekly report', { error: (error as Error).message });
    apiError(res, 500, 'EXECUTION_FAILED', 'Failed to run weekly report');
  }
});

/**
 * GET /api/workers/status
 * Get worker status
 */
router.get('/workers/status', async (_req: Request, res: Response) => {
  try {
    const realtimeStatus = realTimeWorker.getCurrentStatus();
    const dailyTasks = dailyWorker.getRecentTasks(5);
    const weeklyTasks = weeklyWorker.getRecentTasks(5);

    apiResponse(res, {
      realtime: realtimeStatus,
      daily: {
        recentTasks: dailyTasks,
      },
      weekly: {
        recentTasks: weeklyTasks,
      },
    });
  } catch (error) {
    log.error('Failed to get worker status', { error: (error as Error).message });
    apiError(res, 500, 'QUERY_FAILED', 'Failed to get worker status');
  }
});

// ============================================
// HEALTH CHECK
// ============================================

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', async (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-research-opportunity-agent',
    timestamp: new Date().toISOString(),
  });
});

export default router;
