import { signalCaptureService } from './signalCapture';
import { dormantIntentService } from './dormancy';
import { profileService } from './profiles';
import { AdaptiveScoringService } from './scoring';

interface EnrichedContext {
  userId: string;
  activeIntents: any[];
  dormantIntents: any[];
  profile: any;
  scores: any;
  recommendations: any[];
}

// ============================================
// UNIFIED INTENT SERVICE
// Combines all intelligence services into one API
// ============================================

export class UnifiedIntentService {
  /**
   * Get active intents for user
   */
  async getActiveIntents(userId: string) {
    return signalCaptureService.getActiveIntents(userId);
  }

  /**
   * Get dormant intents for user
   */
  async getDormantIntents(userId: string) {
    return dormantIntentService.getUserDormantIntents(userId);
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    return profileService.getProfile(userId);
  }

  /**
   * Get enriched context (cached 5min)
   * Combines: Intent Graph + Intelligence Hub + User Intelligence
   */
  async getEnrichedContext(userId: string): Promise<EnrichedContext> {
    const [activeIntents, dormantIntents, profile] = await Promise.all([
      signalCaptureService.getActiveIntents(userId),
      dormantIntentService.getUserDormantIntents(userId),
      profileService.getProfile(userId)
    ]);

    const scores = profile
      ? await AdaptiveScoringService.calculateScores(userId)
      : null;

    const recommendations = profile
      ? await profileService.getRecommendations(userId, 10)
      : [];

    return {
      userId,
      activeIntents,
      dormantIntents,
      profile,
      scores,
      recommendations
    };
  }

  /**
   * Trigger revival for dormant intent
   */
  async triggerRevival(intentId: string, triggerType: string) {
    return dormantIntentService.triggerRevival(intentId, triggerType);
  }

  /**
   * Mark intent as revived
   */
  async markRevived(intentId: string) {
    return dormantIntentService.markRevived(intentId);
  }

  /**
   * Get system stats
   */
  async getStats() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      features: [
        'signal-capture',
        'dormancy-detection',
        'user-profiles',
        'adaptive-scoring',
        'nudge-delivery',
        'attribution'
      ]
    };
  }
}

export const intentService = new UnifiedIntentService();
