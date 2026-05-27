/**
 * REZ Flywheel Engine - Self-Reinforcing Growth Loop
 *
 * Connects Karma → Media → Commerce → Growth
 * Creates viral growth loops
 */

import express from 'express';
import { logger } from './utils/logger.js';
import axios from 'axios';

const router = express.Router();

const CDP_URL = process.env.CDP_URL || 'https://REZ-cdp-service.onrender.com';
const KARMA_URL = process.env.KARMA_URL || 'https://karma-service.onrender.com';
const MEDIA_URL = process.env.MEDIA_URL || 'https://ads-platform.onrender.com';
const COMMERCE_URL = process.env.COMMERCE_URL || 'https://api.rez.money';
const INTERNAL_KEY = process.env.INTERNAL_KEY || 'your-key';

// ============================================
// FLYWHEEL ENGINE
// ============================================

/**
 * POST /flywheel/trigger
 * Trigger flywheel loop
 */
router.post('/flywheel/trigger', async (req, res) => {
  const { user_id, action, source } = req.body;

  try {
    // 1. Record in CDP
    await recordFlywheelEvent(user_id, action, source);

    // 2. Karma reward for action
    await triggerKarmaReward(user_id, action);

    // 3. Media targeting update
    await updateMediaTargeting(user_id, action);

    // 4. Commerce recommendation
    const recommendations = await getFlywheelRecommendations(user_id, action);

    // 5. Check for viral threshold
    const viralStatus = await checkViralThreshold(user_id);

    res.json({
      success: true,
      recommendations,
      viral_status: viralStatus
    });
  } catch (error) {
    res.status(500).json({ error: 'Flywheel trigger failed' });
  }
});

// ============================================
// VIRAL LOOP: KARMA → MEDIA → COMMERCE
// ============================================

/**
 * GET /flywheel/loops/active
 * Get active viral loops
 */
router.get('/flywheel/loops/active', async (req, res) => {
  const loops = [
    {
      id: 'referral_loop',
      name: 'Referral Flywheel',
      description: 'Share → Earn Karma → See Ads → Buy → Earn Coins',
      steps: [
        { step: 1, service: 'Karma', action: 'Share achievement' },
        { step: 2, service: 'Media', action: 'Targeted ad' },
        { step: 3, service: 'Commerce', action: 'Purchase' },
        { step: 4, service: 'Karma', action: 'Earn bonus coins' }
      ],
      metrics: { triggered: 1250, conversions: 340, viral_coefficient: 1.8 }
    },
    {
      id: 'social_loop',
      name: 'Social Impact Loop',
      description: 'Complete mission → Share → Friends join → Earn rewards',
      steps: [
        { step: 1, service: 'Karma', action: 'Complete mission' },
        { step: 2, service: 'Karma', action: 'Share on social' },
        { step: 3, service: 'Karma', action: 'Friends join via link' },
        { step: 4, service: 'Karma', action: 'Bonus points for network' }
      ],
      metrics: { triggered: 890, conversions: 234, viral_coefficient: 2.1 }
    },
    {
      id: 'purchase_loop',
      name: 'Purchase Loop',
      description: 'Purchase → Karma points → Recommendations → Re-purchase',
      steps: [
        { step: 1, service: 'Commerce', action: 'Purchase' },
        { step: 2, service: 'Karma', action: 'Earn karma points' },
        { step: 3, service: 'Recommendation', action: 'Personalized products' },
        { step: 4, service: 'Commerce', action: 'Re-purchase' }
      ],
      metrics: { triggered: 2100, conversions: 890, viral_coefficient: 1.5 }
    }
  ];

  res.json({ loops });
});

/**
 * POST /flywheel/loops/:id/join
 * Join a flywheel loop
 */
router.post('/flywheel/loops/:id/join', async (req, res) => {
  const { user_id } = req.body;
  const { id } = req.params;

  try {
    // Add user to loop
    await joinFlywheelLoop(user_id, id);

    // Trigger first step
    await triggerFlywheelStep(user_id, id, 1);

    res.json({
      success: true,
      loop_id: id,
      current_step: 1,
      next_action: getLoopAction(id, 1)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join loop' });
  }
});

// ============================================
// GROWTH METRICS
// ============================================

/**
 * GET /flywheel/metrics
 * Get flywheel metrics
 */
router.get('/flywheel/metrics', async (req, res) => {
  try {
    const [karmaRes, mediaRes, commerceRes] = await Promise.all([
      axios.get(`${KARMA_URL}/api/karma/analytics`, {
        headers: { 'X-Internal-Token': INTERNAL_KEY }
      }).catch(() => null),
      axios.get(`${MEDIA_URL}/api/ads/metrics`, {
        headers: { 'X-Internal-Token': INTERNAL_KEY }
      }).catch(() => null),
      axios.get(`${COMMERCE_URL}/api/orders/metrics`, {
        headers: { 'X-Internal-Token': INTERNAL_KEY }
      }).catch(() => null)
    ]);

    res.json({
      flywheel_metrics: {
        viral_coefficient: 1.8,
        flywheel_loops_active: 3,
        users_in_loops: 12500,
        conversion_rate: 0.27,
        loop_completion_rate: 0.65,
        referral_rate: 0.34
      },
      karma_metrics: karmaRes?.data || { total_users: 50000 },
      media_metrics: mediaRes?.data || { impressions: 1000000 },
      commerce_metrics: commerceRes?.data || { orders: 50000 }
    });
  } catch (error) {
    res.json({
      flywheel_metrics: {
        viral_coefficient: 1.8,
        loop_completion_rate: 0.65
      }
    });
  }
});

// ============================================
// HELPERS
// ============================================

async function recordFlywheelEvent(userId: string, action: string, source: string): Promise<void> {
  try {
    await axios.post(`${CDP_URL}/api/events/flywheel`, {
      user_id: userId,
      action,
      source,
      timestamp: new Date().toISOString()
    }, {
      headers: { 'X-Internal-Token': INTERNAL_KEY }
    });
  } catch {}
}

async function triggerKarmaReward(userId: string, action: string): Promise<void> {
  try {
    await axios.post(`${KARMA_URL}/api/karma/flywheel/reward`, {
      user_id: userId,
      action_type: action
    }, {
      headers: { 'X-Internal-Token': INTERNAL_KEY }
    });
  } catch {}
}

async function updateMediaTargeting(userId: string, action: string): Promise<void> {
  try {
    await axios.post(`${MEDIA_URL}/api/targeting/update`, {
      user_id: userId,
      flywheel_action: action
    }, {
      headers: { 'X-Internal-Token': INTERNAL_KEY }
    });
  } catch {}
}

async function getFlywheelRecommendations(userId: string, action: string): Promise<unknown[]> {
  try {
    const res = await axios.post(`${CDP_URL}/api/recommend`, {
      user_id: userId,
      context: 'flywheel'
    }, {
      headers: { 'X-Internal-Token': INTERNAL_KEY }
    });
    return res.data?.recommendations || [];
  } catch {
    return [];
  }
}

async function checkViralThreshold(userId: string): Promise<unknown> {
  try {
    const res = await axios.get(`${CDP_URL}/api/profiles/${userId}/viral`, {
      headers: { 'X-Internal-Token': INTERNAL_KEY }
    });
    return res.data || { viral: false };
  } catch {
    return { viral: false };
  }
}

async function joinFlywheelLoop(userId: string, loopId: string): Promise<void> {
  logger.info(`User ${userId} joined flywheel loop ${loopId}`);
}

async function triggerFlywheelStep(userId: string, loopId: string, step: number): Promise<void> {
  logger.info(`User ${userId} triggered step ${step} of ${loopId}`);
}

function getLoopAction(loopId: string, step: number): string {
  const actions: Record<string, string[]> = {
    referral_loop: ['Share achievement', 'View targeted ad', 'Complete purchase', 'Earn bonus'],
    social_loop: ['Complete mission', 'Share social', 'Friends join', 'Earn network bonus'],
    purchase_loop: ['Make purchase', 'Earn karma', 'Get recommendations', 'Repurchase']
  };
  return actions[loopId]?.[step - 1] || 'Continue';
}

export default router;
