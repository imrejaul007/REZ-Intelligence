import { CustomerFeatures, ChurnPrediction, RiskFactor, EarlyWarningSignal, PreventionRecommendation } from '../types';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export class ChurnPredictionService {
  private modelVersion = '1.0.0';

  calculateChurnProbability(features: CustomerFeatures): ChurnPrediction {
    logger.info(`Calculating churn probability for customer: ${features.customerId}`);

    const riskFactors = this.analyzeRiskFactors(features);
    const totalRisk = riskFactors.reduce((sum, factor) => sum + factor.impact, 0);
    const baseProbability = Math.min(Math.max(totalRisk / 100, 0), 1);

    const earlyWarningSignals = this.detectEarlyWarningSignals(features);
    const warningPenalty = earlyWarningSignals.reduce((sum, signal) => {
      if (signal.severity === 'severe') return sum + 0.15;
      if (signal.severity === 'moderate') return sum + 0.08;
      return sum + 0.03;
    }, 0);

    const churnProbability = Math.min(Math.max(baseProbability + warningPenalty, 0), 1);
    const riskLevel = this.determineRiskLevel(churnProbability);
    const recommendations = this.generatePreventionRecommendations(features, riskLevel, earlyWarningSignals);

    return {
      customerId: features.customerId,
      churnProbability: Math.round(churnProbability * 1000) / 1000,
      riskLevel,
      riskFactors,
      earlyWarningSignals,
      preventionRecommendations: recommendations,
      modelVersion: this.modelVersion,
      predictedAt: new Date().toISOString(),
    };
  }

  private analyzeRiskFactors(features: CustomerFeatures): RiskFactor[] {
    const factors: RiskFactor[] = [];

    if (features.contractType === 'month-to-month') {
      factors.push({
        factor: 'contract_type',
        impact: 0.25,
        description: 'Month-to-month contracts have higher churn rates',
      });
    }

    if (features.numSupportTickets > 5) {
      factors.push({
        factor: 'support_tickets',
        impact: 0.20,
        description: 'High number of support tickets indicates dissatisfaction',
      });
    }

    if (features.daysSinceLastActivity > 30) {
      factors.push({
        factor: 'inactivity',
        impact: 0.30,
        description: 'Customer has been inactive for extended period',
      });
    }

    if (features.paymentMethod === 'electronic check') {
      factors.push({
        factor: 'payment_method',
        impact: 0.10,
        description: 'Electronic check users have higher churn tendency',
      });
    }

    if (!features.hasMultipleServices) {
      factors.push({
        factor: 'single_service',
        impact: 0.15,
        description: 'Single-service customers have lower switching costs',
      });
    }

    if (features.averageReviewScore !== undefined && features.averageReviewScore < 3) {
      factors.push({
        factor: 'low_review_score',
        impact: 0.20,
        description: 'Low average review score indicates satisfaction issues',
      });
    }

    if (features.tenure < 6) {
      factors.push({
        factor: 'new_customer',
        impact: 0.15,
        description: 'New customers are in critical onboarding phase',
      });
    }

    return factors.sort((a, b) => b.impact - a.impact);
  }

  private detectEarlyWarningSignals(features: CustomerFeatures): EarlyWarningSignal[] {
    const signals: EarlyWarningSignal[] = [];

    if (features.daysSinceLastActivity > 14) {
      signals.push({
        signal: 'Declining engagement',
        severity: features.daysSinceLastActivity > 30 ? 'severe' : 'moderate',
        detectedAt: new Date().toISOString(),
        trend: 'decreasing',
      });
    }

    if (features.numSupportTickets > 3) {
      signals.push({
        signal: 'Increasing support burden',
        severity: features.numSupportTickets > 7 ? 'severe' : 'moderate',
        detectedAt: new Date().toISOString(),
        trend: 'increasing',
      });
    }

    if (features.averageReviewScore !== undefined && features.averageReviewScore < 4) {
      signals.push({
        signal: 'Declining satisfaction scores',
        severity: features.averageReviewScore < 2 ? 'severe' : 'moderate',
        detectedAt: new Date().toISOString(),
        trend: 'decreasing',
      });
    }

    if (features.engagementScore !== undefined && features.engagementScore < 40) {
      signals.push({
        signal: 'Low engagement score',
        severity: 'moderate',
        detectedAt: new Date().toISOString(),
        trend: 'stable',
      });
    }

    if (features.contractType === 'month-to-month' && features.tenure > 12) {
      signals.push({
        signal: 'Contract renewal risk',
        severity: 'mild',
        detectedAt: new Date().toISOString(),
        trend: 'stable',
      });
    }

    return signals;
  }

  private generatePreventionRecommendations(
    features: CustomerFeatures,
    riskLevel: string,
    signals: EarlyWarningSignal[]
  ): PreventionRecommendation[] {
    const recommendations: PreventionRecommendation[] = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push({
        action: 'Immediate personalized outreach',
        priority: 'high',
        expectedImpact: 'High retention probability increase',
        channel: 'Phone + Email',
        timeframe: 'Within 24 hours',
      });
    }

    if (features.numSupportTickets > 3) {
      recommendations.push({
        action: 'Proactive support engagement',
        priority: 'high',
        expectedImpact: 'Reduce churn by 15-20%',
        channel: 'Live chat + Email',
        timeframe: 'Within 48 hours',
      });
    }

    if (features.contractType === 'month-to-month') {
      recommendations.push({
        action: 'Offer annual contract with discount',
        priority: 'medium',
        expectedImpact: 'Lock in customer for 12+ months',
        channel: 'Email + In-app',
        timeframe: 'Within 7 days',
      });
    }

    if (!features.hasMultipleServices) {
      recommendations.push({
        action: 'Cross-sell additional services',
        priority: 'medium',
        expectedImpact: 'Increase switching costs',
        channel: 'Email + In-app',
        timeframe: 'Within 14 days',
      });
    }

    if (features.daysSinceLastActivity > 14) {
      recommendations.push({
        action: 'Re-engagement campaign',
        priority: 'high',
        expectedImpact: 'Restore active engagement',
        channel: 'Push + Email + SMS',
        timeframe: 'Within 48 hours',
      });
    }

    recommendations.push({
      action: 'Loyalty program enrollment',
      priority: 'low',
      expectedImpact: 'Increase emotional attachment',
      channel: 'Email',
      timeframe: 'Within 30 days',
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private determineRiskLevel(probability: number): 'low' | 'medium' | 'high' | 'critical' {
    if (probability >= 0.7) return 'critical';
    if (probability >= 0.5) return 'high';
    if (probability >= 0.3) return 'medium';
    return 'low';
  }

  getModelVersion(): string {
    return this.modelVersion;
  }
}

export const churnPredictionService = new ChurnPredictionService();
