/**
 * Usage Routes
 * API endpoints for tracking and retrieving usage metrics
 */

import { Router, Request, Response, NextFunction } from 'express';
import { logger, logMetric } from '../utils/logger.js';
import { UsageMetrics, VoiceAgentType } from '../types';

const router = Router();

// In-memory usage tracking (in production, use a database)
interface UsageRecord {
  timestamp: Date;
  type: 'transcription' | 'synthesis' | 'call';
  agentType?: VoiceAgentType;
  duration?: number;
  success: boolean;
  error?: string;
}

const usageHistory: UsageRecord[] = [];
const MAX_HISTORY_SIZE = 10000;

/**
 * Record usage metric
 */
export function recordUsage(record: Omit<UsageRecord, 'timestamp'>): void {
  usageHistory.push({
    ...record,
    timestamp: new Date()
  });

  // Trim history if too large
  if (usageHistory.length > MAX_HISTORY_SIZE) {
    usageHistory.shift();
  }

  // Log metric
  logMetric(`${record.type}_${record.success ? 'success' : 'failure'}`, 1, {
    agentType: record.agentType
  });
}

/**
 * GET /api/usage
 * Get usage metrics summary
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Filter records for today
    const todayRecords = usageHistory.filter(r => r.timestamp >= dayStart);

    // Calculate metrics
    const metrics: UsageMetrics = {
      totalCalls: todayRecords.filter(r => r.type === 'call' && r.success).length,
      completedCalls: todayRecords.filter(r => r.type === 'call' && r.success).length,
      failedCalls: todayRecords.filter(r => r.type === 'call' && !r.success).length,
      totalDurationSeconds: todayRecords
        .filter(r => r.type === 'call' && r.success && r.duration)
        .reduce((sum, r) => sum + (r.duration || 0), 0),
      totalTranscriptions: todayRecords.filter(r => r.type === 'transcription' && r.success).length,
      totalSyntheses: todayRecords.filter(r => r.type === 'synthesis' && r.success).length,
      averageSentiment: 0.8, // Placeholder
      byAgentType: {
        [VoiceAgentType.SALES]: {
          count: todayRecords.filter(r => r.type === 'call' && r.agentType === VoiceAgentType.SALES).length,
          avgDuration: calculateAvgDuration(todayRecords, VoiceAgentType.SALES)
        },
        [VoiceAgentType.SUPPORT]: {
          count: todayRecords.filter(r => r.type === 'call' && r.agentType === VoiceAgentType.SUPPORT).length,
          avgDuration: calculateAvgDuration(todayRecords, VoiceAgentType.SUPPORT)
        },
        [VoiceAgentType.INFO]: {
          count: todayRecords.filter(r => r.type === 'call' && r.agentType === VoiceAgentType.INFO).length,
          avgDuration: calculateAvgDuration(todayRecords, VoiceAgentType.INFO)
        }
      }
    };

    res.status(200).json({
      date: now.toISOString().split('T')[0],
      metrics
    });
  } catch (error) {
    logger.error('Failed to get usage metrics', { error });
    res.status(500).json({ error: 'Failed to retrieve usage metrics' });
  }
});

/**
 * GET /api/usage/history
 * Get usage history with optional filters
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, type, agentType, limit = '100' } = req.query;

    let records = [...usageHistory];

    // Apply filters
    if (startDate) {
      const start = new Date(startDate as string);
      records = records.filter(r => r.timestamp >= start);
    }

    if (endDate) {
      const end = new Date(endDate as string);
      records = records.filter(r => r.timestamp <= end);
    }

    if (type) {
      records = records.filter(r => r.type === type);
    }

    if (agentType) {
      records = records.filter(r => r.agentType === agentType);
    }

    // Sort by timestamp descending and limit
    records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const limitNum = Math.min(parseInt(limit as string, 10), 1000);
    records = records.slice(0, limitNum);

    res.status(200).json({
      count: records.length,
      records: records.map(r => ({
        timestamp: r.timestamp.toISOString(),
        type: r.type,
        agentType: r.agentType,
        duration: r.duration,
        success: r.success,
        error: r.error
      }))
    });
  } catch (error) {
    logger.error('Failed to get usage history', { error });
    res.status(500).json({ error: 'Failed to retrieve usage history' });
  }
});

/**
 * GET /api/usage/cost
 * Get cost estimates (placeholder)
 */
router.get('/cost', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todayRecords = usageHistory.filter(r => r.timestamp >= dayStart);

    // Calculate cost estimates (placeholder - use actual pricing)
    const transcriptionCount = todayRecords.filter(r => r.type === 'transcription' && r.success).length;
    const synthesisCount = todayRecords.filter(r => r.type === 'synthesis' && r.success).length;

    // Estimated costs (in production, use actual API pricing)
    const costs = {
      transcription: {
        count: transcriptionCount,
        costPerUnit: 0.006, // $0.006 per second for Whisper
        estimatedTotal: transcriptionCount * 0.006
      },
      synthesis: {
        count: synthesisCount,
        costPerUnit: 0.03, // $0.03 per 1000 characters for ElevenLabs
        estimatedTotal: synthesisCount * 0.03
      },
      twilio: {
        inboundCalls: todayRecords.filter(r => r.type === 'call').length,
        costPerMinute: 0.0085, // Twilio voice rate
        estimatedTotal: todayRecords
          .filter(r => r.type === 'call' && r.duration)
          .reduce((sum, r) => sum + ((r.duration || 0) / 60) * 0.0085, 0)
      },
      total: 0
    };

    costs.total = costs.transcription.estimatedTotal + costs.synthesis.estimatedTotal + costs.twilio.estimatedTotal;

    res.status(200).json({
      date: now.toISOString().split('T')[0],
      currency: 'USD',
      breakdown: costs
    });
  } catch (error) {
    logger.error('Failed to calculate costs', { error });
    res.status(500).json({ error: 'Failed to calculate cost estimates' });
  }
});

/**
 * GET /api/usage/health
 * Get service health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const { getSTTService } = await import('../services/sttService');
    const { getTTSService } = await import('../services/ttsService');

    const sttService = getSTTService();
    const ttsService = getTTSService();

    const [sttHealthy, ttsHealthy] = await Promise.all([
      sttService.healthCheck().catch(() => false),
      ttsService.healthCheck().catch(() => false)
    ]);

    const allHealthy = sttHealthy && ttsHealthy;

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        openai_whisper: sttHealthy ? 'operational' : 'degraded',
        elevenlabs: ttsHealthy ? 'operational' : 'degraded',
        twilio: 'operational' // Would need actual health check
      }
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

/**
 * GET /api/usage/realtime
 * Get real-time usage stats
 */
router.get('/realtime', async (req: Request, res: Response) => {
  try {
    const { getConversationService } = await import('../services/conversationService');
    const conversationService = getConversationService();

    const stats = conversationService.getStats();
    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

    const hourRecords = usageHistory.filter(r => r.timestamp >= hourStart);

    res.status(200).json({
      timestamp: now.toISOString(),
      activeConversations: stats.active,
      totalToday: stats.total,
      lastHour: {
        transcriptions: hourRecords.filter(r => r.type === 'transcription').length,
        syntheses: hourRecords.filter(r => r.type === 'synthesis').length,
        calls: hourRecords.filter(r => r.type === 'call').length,
        errors: hourRecords.filter(r => !r.success).length
      }
    });
  } catch (error) {
    logger.error('Failed to get realtime stats', { error });
    res.status(500).json({ error: 'Failed to retrieve realtime stats' });
  }
});

/**
 * Helper: Calculate average call duration by agent type
 */
function calculateAvgDuration(records: UsageRecord[], agentType: VoiceAgentType): number {
  const agentRecords = records.filter(
    r => r.type === 'call' && r.agentType === agentType && r.duration && r.success
  );

  if (agentRecords.length === 0) return 0;

  const totalDuration = agentRecords.reduce((sum, r) => sum + (r.duration || 0), 0);
  return totalDuration / agentRecords.length;
}

export default router;
