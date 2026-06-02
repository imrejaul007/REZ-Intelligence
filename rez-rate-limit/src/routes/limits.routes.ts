import { Router, Request, Response } from 'express';
import { rateLimitService } from '../services/rateLimitService';
import { RateLimitKey } from '../types';
import { endpointConfigs, config } from '../config';

const router = Router();

/**
 * GET /api/limits/status
 * Get current rate limit status and configuration
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const stats = await rateLimitService.getStats();

    res.json({
      success: true,
      data: {
        redis: {
          connected: stats.totalKeys >= 0,
          keyCount: stats.totalKeys,
        },
        config: {
          defaultWindowMs: config.defaultWindowMs,
          defaultMaxRequests: config.defaultMaxRequests,
          defaultBurstLimit: config.defaultBurstLimit,
          defaultBurstWindowMs: config.defaultBurstWindowMs,
        },
        endpointConfigs: endpointConfigs,
      },
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rate limit status',
    });
  }
});

/**
 * GET /api/limits/check/:type/:identifier
 * Check current usage for a specific rate limit key
 * type: 'user', 'ip', or 'endpoint'
 * identifier: the specific ID (user ID, IP address, or endpoint path)
 */
router.get('/check/:type/:identifier', async (req: Request, res: Response) => {
  try {
    const { type, identifier } = req.params;

    if (!['user', 'ip', 'endpoint'].includes(type)) {
      res.status(400).json({
        success: false,
        error: 'Invalid type. Must be "user", "ip", or "endpoint"',
      });
      return;
    }

    const key: RateLimitKey = {
      type: type as 'user' | 'ip' | 'endpoint',
      identifier,
    };

    const windowSizeMs = parseInt(req.query.windowMs as string) || 60000;
    const usage = await rateLimitService.getCurrentUsage(key, windowSizeMs);

    res.json({
      success: true,
      data: {
        key,
        currentUsage: usage,
        windowSizeMs,
      },
    });
  } catch (error) {
    console.error('Error checking limit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check rate limit',
    });
  }
});

/**
 * POST /api/limits/reset
 * Reset rate limit for a specific key
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const { type, identifier, endpoint } = req.body;

    if (!type || !identifier) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: type and identifier',
      });
      return;
    }

    if (!['user', 'ip', 'endpoint'].includes(type)) {
      res.status(400).json({
        success: false,
        error: 'Invalid type. Must be "user", "ip", or "endpoint"',
      });
      return;
    }

    const key: RateLimitKey = {
      type,
      identifier,
      endpoint,
    };

    const success = await rateLimitService.resetLimit(key);

    res.json({
      success,
      data: {
        key,
        message: success ? 'Rate limit reset successfully' : 'Failed to reset rate limit',
      },
    });
  } catch (error) {
    console.error('Error resetting limit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset rate limit',
    });
  }
});

/**
 * POST /api/limits/batch-reset
 * Reset rate limits for multiple keys
 */
router.post('/batch-reset', async (req: Request, res: Response) => {
  try {
    const { keys } = req.body;

    if (!Array.isArray(keys) || keys.length === 0) {
      res.status(400).json({
        success: false,
        error: 'keys must be a non-empty array',
      });
      return;
    }

    const results: { key: RateLimitKey; success: boolean }[] = [];

    for (const keyData of keys) {
      if (!keyData.type || !keyData.identifier) {
        results.push({
          key: keyData,
          success: false,
        });
        continue;
      }

      const key: RateLimitKey = {
        type: keyData.type,
        identifier: keyData.identifier,
        endpoint: keyData.endpoint,
      };

      const success = await rateLimitService.resetLimit(key);
      results.push({ key, success });
    }

    const allSuccess = results.every(r => r.success);

    res.json({
      success: allSuccess,
      data: {
        results,
        total: results.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    });
  } catch (error) {
    console.error('Error batch resetting limits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to batch reset rate limits',
    });
  }
});

/**
 * POST /api/limits/config/endpoint
 * Update rate limit configuration for an endpoint
 */
router.post('/config/endpoint', async (req: Request, res: Response) => {
  try {
    const { endpoint, windowSizeMs, maxRequests } = req.body;

    if (!endpoint) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: endpoint',
      });
      return;
    }

    if (windowSizeMs && typeof windowSizeMs !== 'number') {
      res.status(400).json({
        success: false,
        error: 'windowSizeMs must be a number',
      });
      return;
    }

    if (maxRequests && typeof maxRequests !== 'number') {
      res.status(400).json({
        success: false,
        error: 'maxRequests must be a number',
      });
      return;
    }

    // Update the config (in a real app, this would persist to a database)
    endpointConfigs[endpoint] = {
      windowSizeMs: windowSizeMs || endpointConfigs[endpoint]?.windowSizeMs || config.defaultWindowMs,
      maxRequests: maxRequests || endpointConfigs[endpoint]?.maxRequests || config.defaultMaxRequests,
    };

    res.json({
      success: true,
      data: {
        endpoint,
        config: endpointConfigs[endpoint],
        message: 'Endpoint configuration updated successfully',
      },
    });
  } catch (error) {
    console.error('Error updating endpoint config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update endpoint configuration',
    });
  }
});

/**
 * GET /api/limits/config
 * Get all current configurations
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        global: {
          defaultWindowMs: config.defaultWindowMs,
          defaultMaxRequests: config.defaultMaxRequests,
          defaultBurstLimit: config.defaultBurstLimit,
          defaultBurstWindowMs: config.defaultBurstWindowMs,
        },
        defaultLimits: {
          user: {
            windowSizeMs: config.defaultBurstWindowMs ? 60000 : 60000,
            maxRequests: 100,
            burstLimit: config.defaultBurstLimit,
            burstWindowMs: config.defaultBurstWindowMs,
          },
          ip: {
            windowSizeMs: 60000,
            maxRequests: 200,
            burstLimit: config.defaultBurstLimit,
            burstWindowMs: config.defaultBurstWindowMs,
          },
          endpoint: {
            windowSizeMs: 60000,
            maxRequests: 1000,
            burstLimit: config.defaultBurstLimit,
            burstWindowMs: config.defaultBurstWindowMs,
          },
        },
        endpoints: endpointConfigs,
      },
    });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get configuration',
    });
  }
});

/**
 * GET /api/limits/stats
 * Get detailed rate limiting statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await rateLimitService.getStats();

    // Parse memory info from Redis
    const memoryInfo: Record<string, string> = {};
    if (stats.memoryUsage) {
      stats.memoryUsage.split('\r\n').forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          memoryInfo[key] = value;
        }
      });
    }

    res.json({
      success: true,
      data: {
        redis: {
          connected: true,
          keys: stats.totalKeys,
          memory: {
            used: memoryInfo.used_memory_human || 'unknown',
            peak: memoryInfo.used_memory_peak_human || 'unknown',
          },
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
    });
  }
});

/**
 * POST /api/limits/test
 * Test rate limiting for a specific key (for debugging)
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { type, identifier, endpoint } = req.body;

    if (!type || !identifier) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: type and identifier',
      });
      return;
    }

    const key: RateLimitKey = {
      type,
      identifier,
      endpoint,
    };

    const windowSizeMs = 60000;
    const usage = await rateLimitService.getCurrentUsage(key, windowSizeMs);

    // Get the appropriate config
    let limit = 100;
    if (type === 'user') {
      limit = 100;
    } else if (type === 'ip') {
      limit = 200;
    } else if (type === 'endpoint') {
      limit = endpointConfigs[endpoint || '']?.maxRequests || 1000;
    }

    const remaining = Math.max(0, limit - usage);
    const resetAt = Date.now() + windowSizeMs;

    res.json({
      success: true,
      data: {
        key,
        usage,
        limit,
        remaining,
        windowSizeMs,
        resetAt,
        percentage: Math.round((usage / limit) * 100),
      },
    });
  } catch (error) {
    console.error('Error testing limit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test rate limit',
    });
  }
});

export default router;
