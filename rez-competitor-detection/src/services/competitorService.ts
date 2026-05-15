import {
  UserCompetitorProfile,
  IUserCompetitorProfile
} from '../models/schemas';
import {
  CompetitorVisit,
  SwitchSignal,
  WinBackPotential,
  DetectionInput,
  CompetitorActivity,
  KNOWN_COMPETITORS
} from '../types/interfaces';
import {
  detectCompetitorSwitcher,
  calculateLoyaltyScore,
  calculateWinBackPotential,
  calculateRiskLevel,
  getDaysSinceCompetitorVisit
} from './detectionService';

export class CompetitorService {
  /**
   * Get or create user competitor profile
   */
  async getProfile(userId: string): Promise<IUserCompetitorProfile | null> {
    let profile = await UserCompetitorProfile.findOne({ userId });

    if (!profile) {
      profile = await this.createProfile(userId);
    }

    return profile;
  }

  /**
   * Create a new user competitor profile
   */
  async createProfile(userId: string): Promise<IUserCompetitorProfile> {
    const profile = new UserCompetitorProfile({
      userId,
      competitorActivity: {
        visitsToCompetitors: [],
        competitorSpending: 0,
        competitorShare: 0,
        preferredCompetitors: [],
        switchFrequency: 0,
        lastCompetitorVisit: null
      },
      switchSignals: [],
      loyaltyScore: 50,
      riskLevel: 'low',
      lastUpdated: new Date()
    });

    await profile.save();
    return profile;
  }

  /**
   * Record a competitor visit
   */
  async recordCompetitorVisit(
    userId: string,
    visit: CompetitorVisit
  ): Promise<IUserCompetitorProfile> {
    let profile = await UserCompetitorProfile.findOne({ userId });

    if (!profile) {
      profile = await this.createProfile(userId);
    }

    // Add visit to array
    profile.competitorActivity.visitsToCompetitors.push(visit);

    // Update last competitor visit
    if (!profile.competitorActivity.lastCompetitorVisit ||
        new Date(visit.visitDate) > new Date(profile.competitorActivity.lastCompetitorVisit)) {
      profile.competitorActivity.lastCompetitorVisit = visit.visitDate;
    }

    // Update competitor spending
    profile.competitorActivity.competitorSpending += visit.spend;

    // Update preferred competitors
    const competitorName = visit.competitorName.toLowerCase();
    if (!profile.competitorActivity.preferredCompetitors.includes(competitorName)) {
      profile.competitorActivity.preferredCompetitors.push(competitorName);
    }

    // Update switch frequency
    profile.competitorActivity.switchFrequency =
      this.calculateSwitchFrequency(profile.competitorActivity.visitsToCompetitors);

    // Update competitor share (assuming we can get total spending)
    profile.competitorActivity.competitorShare =
      this.calculateCompetitorShare(
        profile.competitorActivity.competitorSpending,
        0 // Will be updated when total spending is available
      );

    // Detect new signals
    const newSignals = this.detectSignalsFromVisit(profile);
    profile.switchSignals = this.mergeSignals(profile.switchSignals, newSignals);

    // Recalculate loyalty score and risk
    profile.loyaltyScore = this.estimateLoyaltyFromActivity(profile.competitorActivity);
    profile.riskLevel = calculateRiskLevel(
      profile.loyaltyScore,
      profile.competitorActivity.competitorShare,
      profile.switchSignals.length,
      profile.competitorActivity.lastCompetitorVisit
    );

    // Update win-back potential
    profile.winBackPotential = calculateWinBackPotential(
      profile.loyaltyScore,
      profile.competitorActivity.competitorShare,
      profile.competitorActivity.competitorSpending,
      profile.competitorActivity.lastCompetitorVisit,
      profile.competitorActivity.preferredCompetitors
    );

    profile.lastUpdated = new Date();
    await profile.save();

    return profile;
  }

  /**
   * Update competitor profile with detection input
   */
  async updateProfileWithDetection(input: DetectionInput): Promise<IUserCompetitorProfile | null> {
    let profile = await UserCompetitorProfile.findOne({ userId: input.userId });

    if (!profile) {
      profile = await this.createProfile(input.userId);
      if (!profile) return null;
    }

    // Detect switch signals
    const signals = detectCompetitorSwitcher(input);
    profile.switchSignals = signals;

    // Calculate loyalty score
    profile.loyaltyScore = calculateLoyaltyScore(input);

    // Update competitor activity
    profile.competitorActivity.competitorSpending = input.competitorSpending;
    profile.competitorActivity.visitsToCompetitors = input.competitorVisits;
    profile.competitorActivity.competitorShare =
      this.calculateCompetitorShare(input.competitorSpending, input.totalSpending);

    if (input.competitorVisits.length > 0) {
      const lastVisit = input.competitorVisits.reduce((latest, visit) =>
        new Date(visit.visitDate) > new Date(latest.visitDate) ? visit : latest
      );
      profile.competitorActivity.lastCompetitorVisit = lastVisit.visitDate;
    }

    // Calculate risk level
    profile.riskLevel = calculateRiskLevel(
      profile.loyaltyScore,
      profile.competitorActivity.competitorShare,
      signals.length,
      profile.competitorActivity.lastCompetitorVisit
    );

    // Update win-back potential
    profile.winBackPotential = calculateWinBackPotential(
      profile.loyaltyScore,
      profile.competitorActivity.competitorShare,
      input.competitorSpending,
      profile.competitorActivity.lastCompetitorVisit,
      profile.competitorActivity.preferredCompetitors
    );

    profile.lastUpdated = new Date();
    await profile.save();

    return profile;
  }

  /**
   * Get switch signals for a user
   */
  async getSwitchSignals(userId: string): Promise<SwitchSignal[]> {
    const profile = await this.getProfile(userId);
    if (!profile) return [];

    return profile.switchSignals.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get win-back potential for a user
   */
  async getWinBackPotential(userId: string): Promise<WinBackPotential | null> {
    const profile = await this.getProfile(userId);
    if (!profile) return null;

    // Recalculate if not present
    if (!profile.winBackPotential) {
      return calculateWinBackPotential(
        profile.loyaltyScore,
        profile.competitorActivity.competitorShare,
        profile.competitorActivity.competitorSpending,
        profile.competitorActivity.lastCompetitorVisit,
        profile.competitorActivity.preferredCompetitors
      );
    }

    return profile.winBackPotential as WinBackPotential;
  }

  /**
   * Get likely switchers (high risk users)
   */
  async getSwitchers(
    limit: number = 50,
    minCompetitorShare: number = 30
  ): Promise<IUserCompetitorProfile[]> {
    return UserCompetitorProfile.find({
      $or: [
        { 'competitorActivity.competitorShare': { $gte: minCompetitorShare } },
        { riskLevel: { $in: ['high', 'critical'] } },
        { loyaltyScore: { $lt: 40 } }
      ]
    })
      .sort({ 'competitorActivity.competitorShare': -1, loyaltyScore: 1 })
      .limit(limit);
  }

  /**
   * Get win-back candidates
   */
  async getWinBackCandidates(
    limit: number = 50,
    minScore: number = 40
  ): Promise<IUserCompetitorProfile[]> {
    return UserCompetitorProfile.find({
      'winBackPotential.score': { $gte: minScore }
    })
      .sort({ 'winBackPotential.score': -1 })
      .limit(limit);
  }

  /**
   * Calculate switch frequency from visit history
   */
  private calculateSwitchFrequency(visits: CompetitorVisit[]): number {
    if (visits.length < 2) return visits.length;

    // Sort by date
    const sortedVisits = [...visits].sort((a, b) =>
      new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime()
    );

    // Count switches (different competitors in sequence)
    let switches = 0;
    for (let i = 1; i < sortedVisits.length; i++) {
      if (sortedVisits[i].competitorId !== sortedVisits[i - 1].competitorId) {
        switches++;
      }
    }

    // Normalize by time period (switches per month)
    const firstDate = new Date(sortedVisits[0].visitDate);
    const lastDate = new Date(sortedVisits[sortedVisits.length - 1].visitDate);
    const months = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (30 * 24 * 60 * 60 * 1000));

    return Math.round((switches / months) * 10) / 10;
  }

  /**
   * Calculate competitor share percentage
   */
  private calculateCompetitorShare(competitorSpending: number, totalSpending: number): number {
    if (totalSpending <= 0) {
      // Estimate based on known competitor patterns
      return Math.min(100, competitorSpending / 50); // Rough estimate
    }
    return Math.round((competitorSpending / totalSpending) * 100 * 10) / 10;
  }

  /**
   * Detect signals from a new visit
   */
  private detectSignalsFromVisit(profile: IUserCompetitorProfile): SwitchSignal[] {
    const signals: SwitchSignal[] = [];
    const recentVisits = profile.competitorActivity.visitsToCompetitors.filter(v => {
      const daysSince = getDaysSinceCompetitorVisit(v.visitDate);
      return daysSince <= 7;
    });

    if (recentVisits.length >= 3) {
      signals.push({
        type: 'new_competitor',
        severity: 'high',
        timestamp: new Date(),
        description: `Multiple competitor visits in last week (${recentVisits.length})`
      });
    }

    // Check for high-value switchers
    const recentSpend = recentVisits.reduce((sum, v) => sum + v.spend, 0);
    if (recentSpend > 500) {
      signals.push({
        type: 'price_alert',
        severity: 'medium',
        timestamp: new Date(),
        description: `High competitor spending: Rs. ${recentSpend} in recent visits`
      });
    }

    return signals;
  }

  /**
   * Merge new signals with existing, avoiding duplicates
   */
  private mergeSignals(
    existing: SwitchSignal[],
    newSignals: SwitchSignal[]
  ): SwitchSignal[] {
    const signalMap = new Map<string, SwitchSignal>();

    // Add existing signals
    for (const signal of existing) {
      const key = `${signal.type}_${signal.competitorId || 'global'}`;
      signalMap.set(key, signal);
    }

    // Add or update with new signals (newer signals take precedence)
    for (const signal of newSignals) {
      const key = `${signal.type}_${signal.competitorId || 'global'}`;
      const existingSignal = signalMap.get(key);

      if (!existingSignal ||
          new Date(signal.timestamp) > new Date(existingSignal.timestamp)) {
        signalMap.set(key, signal);
      }
    }

    return Array.from(signalMap.values()).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Estimate loyalty from activity metrics
   */
  private estimateLoyaltyFromActivity(activity: CompetitorActivity): number {
    let score = 50;

    // Deduct for competitor spending
    score -= Math.min(30, activity.competitorShare * 0.4);

    // Deduct for high switch frequency
    score -= Math.min(20, activity.switchFrequency * 5);

    // Deduct for recent competitor activity
    if (activity.lastCompetitorVisit) {
      const daysSince = getDaysSinceCompetitorVisit(activity.lastCompetitorVisit);
      if (daysSince < 7) score -= 15;
      else if (daysSince < 14) score -= 10;
      else if (daysSince < 30) score -= 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get competitor analysis
   */
  async getCompetitorAnalysis(competitorId?: string): Promise<{
    totalVisits: number;
    totalSpend: number;
    averageSpend: number;
    topCompetitors: Array<{ name: string; count: number; spend: number }>;
    threatLevel: 'low' | 'medium' | 'high';
  }> {
    const matchStage = competitorId ? { 'competitorActivity.visitsToCompetitors.competitorId': competitorId } : {};

    const result = await UserCompetitorProfile.aggregate([
      { $match: matchStage },
      { $unwind: '$competitorActivity.visitsToCompetitors' },
      ...(competitorId ? [{ $match: { 'competitorActivity.visitsToCompetitors.competitorId': competitorId } }] : []),
      {
        $group: {
          _id: '$competitorActivity.visitsToCompetitors.competitorId',
          competitorName: { $first: '$competitorActivity.visitsToCompetitors.competitorName' },
          count: { $sum: 1 },
          totalSpend: { $sum: '$competitorActivity.visitsToCompetitors.spend' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalVisits = result.reduce((sum, r) => sum + r.count, 0);
    const totalSpend = result.reduce((sum, r) => sum + r.totalSpend, 0);

    const threatLevel: 'low' | 'medium' | 'high' =
      totalVisits > 1000 ? 'high' :
      totalVisits > 500 ? 'medium' : 'low';

    return {
      totalVisits,
      totalSpend,
      averageSpend: totalVisits > 0 ? totalSpend / totalVisits : 0,
      topCompetitors: result.slice(0, 5).map(r => ({
        name: r.competitorName,
        count: r.count,
        spend: r.totalSpend
      })),
      threatLevel
    };
  }

  /**
   * Clear old signals (cleanup)
   */
  async clearOldSignals(userId: string, olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const profile = await UserCompetitorProfile.findOne({ userId });
    if (!profile) return 0;

    const initialCount = profile.switchSignals.length;
    profile.switchSignals = profile.switchSignals.filter(
      signal => new Date(signal.timestamp) > cutoffDate
    );

    await profile.save();
    return initialCount - profile.switchSignals.length;
  }
}

export const competitorService = new CompetitorService();
