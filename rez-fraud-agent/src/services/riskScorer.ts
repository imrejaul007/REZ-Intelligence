import { RiskLevel, IRiskProfile } from '../models/RiskProfile';
import { TransactionContext } from './fraudDetector';
import { VelocityCheckResult } from './velocityCheck';
import { TransactionMonitorResult } from './transactionMonitor';

export interface RiskScoreInput {
  baseScore: number;
  patterns: Array<{
    type: string;
    score: number;
  }>;
  velocityResult: VelocityCheckResult;
  transactionMonitorResult: TransactionMonitorResult;
  context: TransactionContext;
  riskProfile: IRiskProfile | null;
}

export interface RiskScoreBreakdown {
  totalScore: number;
  components: {
    patternScore: number;
    velocityScore: number;
    behavioralScore: number;
    historicalScore: number;
    contextualScore: number;
  };
  factors: string[];
  recommendations: string[];
}

export class RiskScorer {
  // Weights for different score components
  private readonly WEIGHTS = {
    patternScore: 0.35,
    velocityScore: 0.25,
    behavioralScore: 0.15,
    historicalScore: 0.15,
    contextualScore: 0.10,
  };

  async calculateScore(input: RiskScoreInput): Promise<number> {
    const breakdown = await this.calculateBreakdown(input);

    // Final score is weighted sum, capped at 100
    const totalScore = Math.min(100, Math.round(
      breakdown.components.patternScore * this.WEIGHTS.patternScore +
      breakdown.components.velocityScore * this.WEIGHTS.velocityScore +
      breakdown.components.behavioralScore * this.WEIGHTS.behavioralScore +
      breakdown.components.historicalScore * this.WEIGHTS.historicalScore +
      breakdown.components.contextualScore * this.WEIGHTS.contextualScore
    ));

    return totalScore;
  }

  async calculateBreakdown(input: RiskScoreInput): Promise<RiskScoreBreakdown> {
    const factors: string[] = [];
    const recommendations: string[] = [];

    // 1. Pattern Score - based on matched fraud patterns
    let patternScore = input.baseScore;
    if (input.patterns.length > 0) {
      const maxPatternScore = Math.max(...input.patterns.map(p => p.score));
      const avgPatternScore = input.patterns.reduce((sum, p) => sum + p.score, 0) / input.patterns.length;

      // Use weighted combination: 70% max, 30% average
      patternScore = maxPatternScore * 0.7 + avgPatternScore * 0.3;

      for (const pattern of input.patterns) {
        factors.push(`${pattern.type}: +${pattern.score}`);
      }

      if (patternScore >= 80) {
        recommendations.push('Block transaction immediately');
      } else if (patternScore >= 60) {
        recommendations.push('Require additional verification');
      }
    }

    // 2. Velocity Score - based on transaction velocity
    let velocityScore = 0;
    if (input.velocityResult.isViolation) {
      velocityScore = input.velocityResult.score;
      factors.push(`Velocity violation: ${input.velocityResult.violationType}`);
      recommendations.push('Rate limit or temporarily block user');
    } else if (input.velocityResult.score > 30) {
      velocityScore = input.velocityResult.score * 0.5;
      factors.push(`Elevated velocity: ${input.velocityResult.score}`);
    }

    // 3. Behavioral Score - based on session and behavioral data
    let behavioralScore = 0;
    const behavioralFactors = this.analyzeBehavioralFactors(input.context);
    behavioralScore = behavioralFactors.score;
    factors.push(...behavioralFactors.factors);

    if (behavioralFactors.factors.length > 0 && behavioralScore > 50) {
      recommendations.push('Review session behavior patterns');
    }

    // 4. Historical Score - based on user history
    let historicalScore = 0;
    if (input.riskProfile) {
      const historicalFactors = this.analyzeHistoricalFactors(input.riskProfile, input.context);
      historicalScore = historicalFactors.score;
      factors.push(...historicalFactors.factors);

      if (input.riskProfile.isKnownFraudster) {
        historicalScore = 100;
        recommendations.push('User is a known fraudster - immediate block');
      }

      if (input.riskProfile.fraudCaseCount > 0) {
        historicalScore = Math.max(historicalScore, 60 + input.riskProfile.fraudCaseCount * 10);
        recommendations.push('User has prior fraud cases - enhanced review');
      }
    }

    // 5. Contextual Score - based on transaction context
    let contextualScore = 0;
    const contextualFactors = this.analyzeContextualFactors(input.context);
    contextualScore = contextualFactors.score;
    factors.push(...contextualFactors.factors);

    if (contextualFactors.factors.length > 0 && contextualScore > 40) {
      recommendations.push('Verify transaction details');
    }

    return {
      totalScore: 0, // Will be calculated after
      components: {
        patternScore: Math.round(patternScore),
        velocityScore: Math.round(velocityScore),
        behavioralScore: Math.round(behavioralScore),
        historicalScore: Math.round(historicalScore),
        contextualScore: Math.round(contextualScore),
      },
      factors: [...new Set(factors)],
      recommendations: [...new Set(recommendations)],
    };
  }

  getRiskLevel(score: number): RiskLevel {
    if (score >= 90) return RiskLevel.CRITICAL;
    if (score >= 75) return RiskLevel.HIGH;
    if (score >= 50) return RiskLevel.ELEVATED;
    if (score >= 25) return RiskLevel.NORMAL;
    return RiskLevel.TRUSTED;
  }

  private analyzeBehavioralFactors(context: TransactionContext): {
    score: number;
    factors: string[];
  } {
    const factors: string[] = [];
    let score = 0;

    // Session duration check
    if (context.sessionDuration !== undefined) {
      if (context.sessionDuration < 5) {
        score += 25;
        factors.push('Very short session (<5s)');
      } else if (context.sessionDuration < 15) {
        score += 10;
        factors.push('Short session (<15s)');
      }
    }

    // Page views check
    if (context.pageViews !== undefined) {
      if (context.pageViews < 2) {
        score += 15;
        factors.push('Minimal page views');
      }
    }

    // Navigation pattern check
    if (context.navigationPattern) {
      const pattern = context.navigationPattern.join(' > ');
      // Suspicious if no product/browse pages
      if (!pattern.includes('product') && !pattern.includes('browse')) {
        score += 20;
        factors.push('Suspicious navigation pattern');
      }
    }

    return { score: Math.min(100, score), factors };
  }

  private analyzeHistoricalFactors(
    profile: IRiskProfile,
    context: TransactionContext
  ): {
    score: number;
    factors: string[];
  } {
    const factors: string[] = [];
    let score = 0;

    // Check if amount is unusual
    if (profile.averageTransactionAmount > 0) {
      const amountRatio = context.amount / profile.averageTransactionAmount;
      if (amountRatio > 5) {
        score += 40;
        factors.push(`Amount ${amountRatio.toFixed(1)}x higher than average`);
      } else if (amountRatio > 3) {
        score += 25;
        factors.push(`Amount ${amountRatio.toFixed(1)}x higher than average`);
      } else if (amountRatio > 2) {
        score += 10;
        factors.push('Elevated transaction amount');
      }
    }

    // Check max transaction
    if (context.amount > profile.maxTransactionAmount * 1.5) {
      score += 30;
      factors.push('Exceeds historical max transaction');
    }

    // Check location
    if (context.billingCountry && profile.usualLocations.length > 0) {
      const isUsualLocation = profile.usualLocations.some(
        loc => loc.country === context.billingCountry
      );
      if (!isUsualLocation) {
        score += 25;
        factors.push('Transaction from new country');
      }
    }

    // Check device
    if (context.deviceFingerprint && profile.usualDevices.length > 0) {
      const isUsualDevice = profile.usualDevices.includes(context.deviceFingerprint);
      if (!isUsualDevice) {
        score += 20;
        factors.push('Transaction from new device');
      }
    }

    // Check account age
    if (profile.accountId && context.accountAge !== undefined) {
      if (context.accountAge < 24) {
        score += 30;
        factors.push('New account (<24h old)');
      } else if (context.accountAge < 168) {
        score += 15;
        factors.push('Young account (<1 week old)');
      }
    }

    // Failed transaction ratio
    if (profile.totalTransactions > 5) {
      const failureRatio = profile.failedTransactionCount / profile.totalTransactions;
      if (failureRatio > 0.3) {
        score += 35;
        factors.push(`High failure ratio: ${(failureRatio * 100).toFixed(0)}%`);
      }
    }

    return { score: Math.min(100, score), factors };
  }

  private analyzeContextualFactors(context: TransactionContext): {
    score: number;
    factors: string[];
  } {
    const factors: string[] = [];
    let score = 0;

    // High-value transaction
    if (context.amount >= 10000) {
      score += 20;
      factors.push('High-value transaction (>=10000)');
    } else if (context.amount >= 5000) {
      score += 10;
      factors.push('Medium-high transaction (>=5000)');
    }

    // Billing/shipping mismatch
    if (context.billingCountry && context.shippingCountry) {
      if (context.billingCountry !== context.shippingCountry) {
        score += 30;
        factors.push('Billing/shipping country mismatch');
      }
      if (context.billingCity && context.shippingCity && context.billingCity !== context.shippingCity) {
        score += 10;
        factors.push('Billing/shipping city mismatch');
      }
    }

    // New payment method
    if (context.isNewPaymentMethod) {
      score += 15;
      factors.push('New payment method');
    }

    // Unverified account
    if (context.isVerified === false) {
      score += 20;
      factors.push('Unverified account');
    }

    // No 2FA
    if (context.twoFactorEnabled === false) {
      score += 5;
      factors.push('No two-factor authentication');
    }

    return { score: Math.min(100, score), factors };
  }
}
