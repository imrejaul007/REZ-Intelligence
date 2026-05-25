/**
 * Finance Intelligence Service
 * Analyzes user intent for financial products and pushes insights to Finance service
 */
import axios from 'axios';

const FINANCE_SERVICE_URL = process.env.FINANCE_SERVICE_URL || 'https://rez-finance-service.onrender.com';

interface UserFinancialProfile {
  userId: string;
  financialSignals: {
    creditScoreChecks: number;
    loanApplications: number;
    approvals: number;
    rejections: number;
    bnplUsage: number;
    avgScore: number;
  };
  intentStrength: number; // 0-1
  recommendedActions: string[];
}

export class FinanceIntelligenceService {
  /**
   * Analyze user's financial intent based on ReZ Mind data
   */
  async analyzeFinancialIntent(userId: string): Promise<UserFinancialProfile> {
    // Get user's intent signals from ReZ Mind
    const intents = await this.getUserIntents(userId);

    // Filter for financial signals
    const financialIntents = intents.filter(i =>
      i.intentKey.includes('loan') ||
      i.intentKey.includes('credit') ||
      i.intentKey.includes('finance') ||
      i.category === 'GENERAL:rez-finance'
    );

    // Calculate metrics
    const profile: UserFinancialProfile = {
      userId,
      financialSignals: {
        creditScoreChecks: financialIntents.filter(i => i.event === 'credit_score_checked').length,
        loanApplications: financialIntents.filter(i => i.event === 'loan_application_submitted').length,
        approvals: financialIntents.filter(i => i.event === 'loan_approved').length,
        rejections: financialIntents.filter(i => i.event === 'loan_rejected').length,
        bnplUsage: financialIntents.filter(i => i.event.includes('bnpl')).length,
        avgScore: 0,
      },
      intentStrength: this.calculateIntentStrength(financialIntents),
      recommendedActions: [],
    };

    // Generate recommendations
    profile.recommendedActions = this.generateRecommendations(profile);

    return profile;
  }

  /**
   * Push credit boost suggestion to Finance service
   */
  async suggestCreditBoost(userId: string, score: number): Promise<void> {
    if (score < 0.7) return; // Only suggest for high engagement

    try {
      await axios.post(`${FINANCE_SERVICE_URL}/api/credit/suggest-boost`, {
        userId,
        boostType: 'engagement_bonus',
        boostAmount: Math.round(score * 50), // Up to 50 point boost
        reason: 'High financial engagement detected via ReZ Mind',
        source: 'intelligence_hub',
      });
    } catch (error) {
      console.error('[FinanceIntelligence] Failed to suggest boost:', error);
    }
  }

  /**
   * Identify users ready for credit products
   */
  async identifyCreditReadyUsers(): Promise<string[]> {
    const users = await this.getActiveUsersWithFinanceIntent();
    const ready: string[] = [];

    for (const user of users) {
      const profile = await this.analyzeFinancialIntent(user.userId);

      // User is ready if:
      // - High intent strength (>0.6)
      // - Has checked score before
      // - Not recently rejected
      if (
        profile.intentStrength > 0.6 &&
        profile.financialSignals.creditScoreChecks > 0 &&
        profile.financialSignals.rejections < 2
      ) {
        ready.push(user.userId);
      }
    }

    return ready;
  }

  /**
   * Predict loan default risk using intent signals
   */
  async predictDefaultRisk(userId: string): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    confidence: number;
    factors: string[];
  }> {
    const intents = await this.getUserIntents(userId);
    const financialIntents = intents.filter(i => i.category === 'GENERAL:rez-finance');

    let riskScore = 0.3; // Base risk
    const factors: string[] = [];

    // Check for warning signs
    if (financialIntents.some(i => i.event === 'payment_overdue')) {
      riskScore += 0.3;
      factors.push('Previous payment overdue');
    }

    if (financialIntents.some(i => i.event === 'loan_rejected')) {
      riskScore += 0.1;
      factors.push('Previous loan rejection');
    }

    // Check for positive signs
    if (financialIntents.some(i => i.event === 'loan_repaid_ontime')) {
      riskScore -= 0.2;
      factors.push('Consistent on-time repayment');
    }

    const riskLevel = riskScore < 0.3 ? 'low' : riskScore < 0.6 ? 'medium' : 'high';

    return {
      riskLevel,
      confidence: Math.min(0.9, 0.5 + financialIntents.length * 0.1),
      factors,
    };
  }

  private async getUserIntents(userId: string): Promise<unknown[]> {
    // In production, fetch from Intent Graph service
    return [];
  }

  private async getActiveUsersWithFinanceIntent(): Promise<{ userId: string }[]> {
    return [];
  }

  private calculateIntentStrength(intents: unknown[]): number {
    if (intents.length === 0) return 0;

    const weights: Record<string, number> = {
      'credit_score_checked': 0.1,
      'loan_application_submitted': 0.4,
      'loan_approved': 0.3,
      'loan_rejected': -0.2,
      'bnpl_eligible': 0.2,
    };

    let score = 0;
    for (const intent of intents) {
      score += weights[intent.event] || 0;
    }

    return Math.max(0, Math.min(1, score));
  }

  private generateRecommendations(profile: UserFinancialProfile): string[] {
    const recs: string[] = [];

    if (profile.financialSignals.creditScoreChecks > 3 && profile.financialSignals.approvals === 0) {
      recs.push('SUGGEST_LOAN_APPLICATION');
    }

    if (profile.financialSignals.bnplUsage > 5) {
      recs.push('OFFER_CREDIT_LIMIT_INCREASE');
    }

    if (profile.intentStrength > 0.8) {
      recs.push('PRE_APPROVE_LOAN');
    }

    return recs;
  }
}

export const financeIntelligence = new FinanceIntelligenceService();
