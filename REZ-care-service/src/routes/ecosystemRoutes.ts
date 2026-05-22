/**
 * REZ Care Service - Ecosystem Integration Routes
 *
 * Connects to REZ infrastructure services:
 * - REZ-memory-layer (4201) - Customer Timeline
 * - REZ-unified-profile (4060) - Unified Profile
 * - REZ-workflow-builder (4045) - Automation Workflows
 * - Vector Search - RAG/Knowledge Base
 */

import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  memoryLayer,
  unifiedProfile,
  workflowBuilder,
  vectorSearch,
  enrichCustomerContext,
  recordSupportInteraction,
  triggerSupportWorkflow,
  getAISuggestedResponse,
  checkAllServicesHealth,
} from '../integrations/ecosystemServices';

const router = express.Router();

// ============================================
// HEALTH CHECK
// ============================================

/**
 * GET /api/ecosystem/health
 * Check health of all ecosystem services
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await checkAllServicesHealth();
    const allHealthy = Object.values(health).every(Boolean);

    res.json({
      success: true,
      services: health,
      status: allHealthy ? 'healthy' : 'degraded',
    });
  } catch (error) {
    logger.error('[Ecosystem] Health check failed', error);
    res.status(500).json({ success: false, error: 'Health check failed' });
  }
});

// ============================================
// CUSTOMER CONTEXT
// ============================================

/**
 * GET /api/ecosystem/customer/:customerId
 * Get enriched customer context (timeline + profile + patterns)
 */
router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { ticketId, message } = req.query;

    const context = await enrichCustomerContext(customerId, {
      ticketId: ticketId as string,
      message: message as string,
    });

    res.json({
      success: true,
      data: context,
    });
  } catch (error) {
    logger.error('[Ecosystem] Failed to get customer context', error);
    res.status(500).json({ success: false, error: 'Failed to get customer context' });
  }
});

// ============================================
// TIMELINE
// ============================================

/**
 * POST /api/ecosystem/timeline
 * Add event to customer timeline
 */
router.post('/timeline', async (req: Request, res: Response) => {
  try {
    const { customerId, eventType, data, sentiment, intent, category } = req.body;

    const result = await memoryLayer.addToTimeline({
      customerId,
      eventType,
      source: 'REZ-care',
      data,
      sentiment,
      intent,
      category,
    });

    res.json(result);
  } catch (error) {
    logger.error('[Ecosystem] Failed to add timeline event', error);
    res.status(500).json({ success: false, error: 'Failed to add event' });
  }
});

/**
 * GET /api/ecosystem/timeline/:customerId
 * Get customer timeline
 */
router.get('/timeline/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { limit, type, startDate, endDate } = req.query;

    const result = await memoryLayer.getTimeline(customerId, {
      limit: limit ? parseInt(limit as string) : 20,
      type: type as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      events: result.events,
    });
  } catch (error) {
    logger.error('[Ecosystem] Failed to get timeline', error);
    res.status(500).json({ success: false, error: 'Failed to get timeline' });
  }
});

/**
 * GET /api/ecosystem/timeline/:customerId/summary
 * Get timeline summary
 */
router.get('/timeline/:customerId/summary', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const summary = await memoryLayer.getTimelineSummary(customerId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('[Ecosystem] Failed to get timeline summary', error);
    res.status(500).json({ success: false, error: 'Failed to get summary' });
  }
});

/**
 * GET /api/ecosystem/timeline/:customerId/patterns
 * Detect patterns in customer journey
 */
router.get('/timeline/:customerId/patterns', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const patterns = await memoryLayer.detectPatterns(customerId);

    res.json({
      success: true,
      data: patterns,
    });
  } catch (error) {
    logger.error('[Ecosystem] Failed to detect patterns', error);
    res.status(500).json({ success: false, error: 'Failed to detect patterns' });
  }
});

// ============================================
// PROFILE
// ============================================

/**
 * GET /api/ecosystem/profile/:customerId
 * Get unified customer profile
 */
router.get('/profile/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const result = await unifiedProfile.getProfile(customerId);

    res.json({
      success: true,
      profile: result.profile,
    });
  } catch (error) {
    logger.error('[Ecosystem] Failed to get profile', error);
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

/**
 * GET /api/ecosystem/profile/:customerId/segments
 * Get customer segments
 */
router.get('/profile/:customerId/segments', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const result = await unifiedProfile.getSegments(customerId);

    res.json({
      success: true,
      segments: result.segments,
    });
  } catch (error) {
    logger.error('[Ecosystem] Failed to get segments', error);
    res.status(500).json({ success: false, error: 'Failed to get segments' });
  }
});

/**
 * GET /api/ecosystem/profile/:customerId/signals
 * Get signal scores
 */
router.get('/profile/:customerId/signals', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const result = await unifiedProfile.getSignalScores(customerId);

    res.json({
      success: true,
      scores: result.scores,
    });
  } catch (error) {
    logger.error('[Ecosystem] Failed to get signals', error);
    res.status(500).json({ success: false, error: 'Failed to get signals' });
  }
});

// ============================================
// WORKFLOWS
// ============================================

/**
 * POST /api/ecosystem/workflows/trigger
 * Trigger support workflow
 */
router.post('/workflows/trigger', async (req: Request, res: Response) => {
  try {
    const { workflowName, customerId, context } = req.body;

    const result = await triggerSupportWorkflow(workflowName, customerId, context);

    res.json(result);
  } catch (error) {
    logger.error('[Ecosystem] Failed to trigger workflow', error);
    res.status(500).json({ success: false, error: 'Failed to trigger workflow' });
  }
});

/**
 * GET /api/ecosystem/workflows/:executionId
 * Get workflow status
 */
router.get('/workflows/:executionId', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const result = await workflowBuilder.getWorkflowStatus(executionId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[Ecosystem] Failed to get workflow status', error);
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

// ============================================
// KNOWLEDGE / RAG
// ============================================

/**
 * POST /api/ecosystem/knowledge/search
 * Semantic search for knowledge base
 */
router.post('/knowledge/search', async (req: Request, res: Response) => {
  try {
    const { query, limit, category, threshold } = req.body;

    const result = await vectorSearch.semanticSearch(query, {
      limit,
      category,
      threshold,
    });

    res.json({
      success: true,
      results: result.results,
    });
  } catch (error) {
    logger.error('[Ecosystem] Knowledge search failed', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

/**
 * POST /api/ecosystem/knowledge/rag
 * Get RAG context for AI
 */
router.post('/knowledge/rag', async (req: Request, res: Response) => {
  try {
    const { query, customerId } = req.body;

    const result = await vectorSearch.getRAGContext(query, customerId);

    res.json({
      success: true,
      context: result.context,
      sources: result.sources,
    });
  } catch (error) {
    logger.error('[Ecosystem] RAG context failed', error);
    res.status(500).json({ success: false, error: 'Failed to get context' });
  }
});

/**
 * POST /api/ecosystem/knowledge/index
 * Index document for RAG
 */
router.post('/knowledge/index', async (req: Request, res: Response) => {
  try {
    const { id, title, content, category, metadata } = req.body;

    const result = await vectorSearch.indexDocument({
      id,
      title,
      content,
      category,
      metadata,
    });

    res.json(result);
  } catch (error) {
    logger.error('[Ecosystem] Index failed', error);
    res.status(500).json({ success: false, error: 'Failed to index' });
  }
});

// ============================================
// AI SUGGESTIONS
// ============================================

/**
 * POST /api/ecosystem/ai/suggest
 * Get AI-suggested response for ticket
 */
router.post('/ai/suggest', async (req: Request, res: Response) => {
  try {
    const { customerId, message, category, sentiment } = req.body;

    const suggestion = await getAISuggestedResponse(customerId, {
      message,
      category,
      sentiment,
    });

    res.json({
      success: true,
      ...suggestion,
    });
  } catch (error) {
    logger.error('[Ecosystem] AI suggestion failed', error);
    res.status(500).json({ success: false, error: 'Failed to get suggestion' });
  }
});

// ============================================
// RECORD INTERACTION
// ============================================

/**
 * POST /api/ecosystem/record
 * Record support interaction to timeline
 */
router.post('/record', async (req: Request, res: Response) => {
  try {
    const { customerId, type, data, sentiment, intent, category } = req.body;

    await recordSupportInteraction(customerId, {
      type,
      data,
      sentiment,
      intent,
      category,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('[Ecosystem] Failed to record interaction', error);
    res.status(500).json({ success: false, error: 'Failed to record' });
  }
});

export default router;
