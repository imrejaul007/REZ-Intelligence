/**
 * REZ Feature Flags - Gradual Rollout Control
 *
 * Features:
 * - Feature flags
 * - Gradual rollout
 * - A/B testing integration
 * - User targeting
 * - Analytics
 */

import express from 'express';
import axios from 'axios';

const router = express.Router();

const CDP_URL = process.env.CDP_URL || 'https://REZ-cdp-service.onrender.com';
const ANALYTICS_URL = process.env.ANALYTICS_URL || 'https://REZ-analytics.onrender.com';
const INTERNAL_KEY = process.env.INTERNAL_KEY || 'your-key';

// ============================================
// TYPES
// ============================================

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout_percentage: number;
  targeting: TargetingRule[];
  created_at: string;
  updated_at: string;
}

interface TargetingRule {
  type: 'user_id' | 'segment' | 'country' | 'platform' | 'version';
  operator: 'equals' | 'in' | 'not_in';
  value: string | string[];
}

// In-memory store
const flags = new Map<string, FeatureFlag>();

// Seed default flags
seedDefaultFlags();

function seedDefaultFlags() {
  const defaults: FeatureFlag[] = [
    {
      id: 'ff_001',
      name: 'new_checkout_flow',
      description: 'Redesigned checkout experience',
      enabled: true,
      rollout_percentage: 25,
      targeting: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'ff_002',
      name: 'ai_recommendations',
      description: 'AI-powered product recommendations',
      enabled: true,
      rollout_percentage: 100,
      targeting: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'ff_003',
      name: 'karma_gamification',
      description: 'Karma points and badges',
      enabled: true,
      rollout_percentage: 100,
      targeting: [{ type: 'platform', operator: 'in', value: ['ios', 'android'] }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  for (const flag of defaults) {
    flags.set(flag.id, flag);
  }
}

// ============================================
// FEATURE FLAG ENDPOINTS
// ============================================

/**
 * GET /flags
 * List all feature flags
 */
router.get('/flags', (req, res) => {
  const { status } = req.query;

  let list = Array.from(flags.values());

  if (status === 'enabled') {
    list = list.filter(f => f.enabled);
  }

  res.json({ flags: list });
});

/**
 * GET /flags/:id
 * Get flag details
 */
router.get('/flags/:id', (req, res) => {
  const flag = flags.get(req.params.id);

  if (!flag) {
    return res.status(404).json({ error: 'Flag not found' });
  }

  res.json({ flag });
});

/**
 * POST /flags
 * Create feature flag
 */
router.post('/flags', (req, res) => {
  const { name, description, rollout_percentage, targeting } = req.body;

  const flag: FeatureFlag = {
    id: `ff_${Date.now()}`,
    name,
    description,
    enabled: false,
    rollout_percentage: rollout_percentage || 0,
    targeting: targeting || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  flags.set(flag.id, flag);

  res.status(201).json({ flag });
});

/**
 * PATCH /flags/:id
 * Update flag
 */
router.patch('/flags/:id', (req, res) => {
  const flag = flags.get(req.params.id);

  if (!flag) {
    return res.status(404).json({ error: 'Flag not found' });
  }

  Object.assign(flag, req.body, { updated_at: new Date().toISOString() });
  flags.set(flag.id, flag);

  res.json({ flag });
});

/**
 * DELETE /flags/:id
 * Delete flag
 */
router.delete('/flags/:id', (req, res) => {
  const deleted = flags.delete(req.params.id);

  if (!deleted) {
    return res.status(404).json({ error: 'Flag not found' });
  }

  res.json({ success: true });
});

// ============================================
// FLAG EVALUATION
// ============================================

/**
 * GET /flags/evaluate/:name
 * Check if flag is enabled for user
 */
router.get('/flags/evaluate/:name', async (req, res) => {
  const { user_id, platform, country, version } = req.query;

  const flag = Array.from(flags.values()).find(f => f.name === req.params.name);

  if (!flag) {
    return res.json({ enabled: false, reason: 'Flag not found' });
  }

  if (!flag.enabled) {
    return res.json({ enabled: false, reason: 'Flag disabled' });
  }

  // Check targeting rules
  if (flag.targeting.length > 0) {
    const userContext = { user_id: user_id as string, platform: platform as string, country: country as string };
    const matches = evaluateTargeting(flag.targeting, userContext);

    if (!matches) {
      return res.json({ enabled: false, reason: 'Targeting rules not matched' });
    }
  }

  // Check rollout percentage
  if (flag.rollout_percentage < 100) {
    const bucket = hashUser(user_id as string) % 100;
    if (bucket >= flag.rollout_percentage) {
      return res.json({ enabled: false, reason: 'Rollout percentage' });
    }
  }

  // Track evaluation
  await trackFlagEvaluation(flag.id, user_id as string);

  res.json({
    enabled: true,
    flag: flag.name
  });
});

// ============================================
// HELPERS
// ============================================

function evaluateTargeting(rules: TargetingRule[], context: Record<string, string>): boolean {
  for (const rule of rules) {
    const value = context[rule.type];

    if (rule.operator === 'equals') {
      if (value !== rule.value) return false;
    } else if (rule.operator === 'in') {
      const values = Array.isArray(rule.value) ? rule.value : [rule.value];
      if (!values.includes(value)) return false;
    } else if (rule.operator === 'not_in') {
      const values = Array.isArray(rule.value) ? rule.value : [rule.value];
      if (values.includes(value)) return false;
    }
  }
  return true;
}

function hashUser(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

async function trackFlagEvaluation(flagId: string, userId: string): Promise<void> {
  try {
    await axios.post(`${ANALYTICS_URL}/api/flags/track`, {
      flag_id: flagId,
      user_id: userId,
      evaluated_at: new Date().toISOString()
    }, {
      headers: { 'X-Internal-Token': INTERNAL_KEY },
      timeout: 1000
    });
  } catch {}
}

// ============================================
// EXPORT FLAGS MIDDLEWARE
// ============================================

/**
 * Express middleware to inject flags for user
 */
export function featureFlagsMiddleware() {
  return async (req: any, res: any, next: any) => {
    const userId = req.user?.id || req.query.user_id;

    if (!userId) {
      return next();
    }

    const userFlags: Record<string, boolean> = {};

    for (const [id, flag] of flags) {
      if (!flag.enabled) continue;

      // Quick hash-based evaluation
      const bucket = hashUser(userId) % 100;
      userFlags[flag.name] = bucket < flag.rollout_percentage;
    }

    req.featureFlags = userFlags;
    next();
  };
}

export default router;
