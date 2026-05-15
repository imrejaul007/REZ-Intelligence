import {
  PredictionType,
  ChurnRisk,
  CustomerTier,
  Factor,
  Prediction,
  ChurnPrediction,
  LTVPrediction,
  RevisitPrediction,
  ConversionPrediction
} from '../src/types';

describe('Types', () => {
  describe('PredictionType', () => {
    it('should accept valid prediction types', () => {
      const types: PredictionType[] = ['churn', 'ltv', 'revisit', 'conversion'];

      types.forEach(type => {
        expect(['churn', 'ltv', 'revisit', 'conversion']).toContain(type);
      });
    });
  });

  describe('ChurnRisk', () => {
    it('should have all risk levels', () => {
      const risks: ChurnRisk[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

      expect(risks).toHaveLength(4);
      expect(risks).toContain('LOW');
      expect(risks).toContain('MEDIUM');
      expect(risks).toContain('HIGH');
      expect(risks).toContain('CRITICAL');
    });
  });

  describe('CustomerTier', () => {
    it('should have all customer tiers', () => {
      const tiers: CustomerTier[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

      expect(tiers).toHaveLength(4);
      expect(tiers).toContain('BRONZE');
      expect(tiers).toContain('SILVER');
      expect(tiers).toContain('GOLD');
      expect(tiers).toContain('PLATINUM');
    });
  });

  describe('Factor', () => {
    it('should have correct structure', () => {
      const factor: Factor = {
        name: 'Test Factor',
        impact: 0.5,
        value: 100,
        description: 'Test description'
      };

      expect(factor.name).toBe('Test Factor');
      expect(factor.impact).toBe(0.5);
      expect(factor.value).toBe(100);
      expect(factor.description).toBe('Test description');
    });

    it('should accept string or number values', () => {
      const factor1: Factor = { name: 'Test', impact: 0.5, value: 'string' };
      const factor2: Factor = { name: 'Test', impact: 0.5, value: 123 };

      expect(typeof factor1.value).toBe('string');
      expect(typeof factor2.value).toBe('number');
    });
  });

  describe('Prediction', () => {
    it('should have correct base structure', () => {
      const prediction: Prediction = {
        userId: 'user123',
        type: 'churn',
        score: 75,
        probability: 0.75,
        confidence: 0.85,
        factors: [],
        recommendation: 'Test recommendation',
        timestamp: new Date()
      };

      expect(prediction.userId).toBe('user123');
      expect(prediction.type).toBe('churn');
      expect(prediction.score).toBe(75);
      expect(prediction.probability).toBe(0.75);
      expect(prediction.confidence).toBe(0.85);
      expect(prediction.recommendation).toBe('Test recommendation');
      expect(prediction.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('ChurnPrediction', () => {
    it('should have churn-specific result structure', () => {
      const prediction: ChurnPrediction = {
        userId: 'user123',
        type: 'churn',
        score: 72,
        probability: 0.72,
        confidence: 0.85,
        factors: [],
        recommendation: 'Test',
        timestamp: new Date(),
        result: {
          risk: 'HIGH',
          daysUntilChurn: 14,
          topFactors: ['No order in 28 days'],
          retentionOffers: ['20% off']
        }
      };

      expect(prediction.type).toBe('churn');
      expect(prediction.result.risk).toBe('HIGH');
      expect(prediction.result.daysUntilChurn).toBe(14);
      expect(prediction.result.topFactors).toHaveLength(1);
      expect(prediction.result.retentionOffers).toHaveLength(1);
    });
  });

  describe('LTVPrediction', () => {
    it('should have LTV-specific result structure', () => {
      const prediction: LTVPrediction = {
        userId: 'user123',
        type: 'ltv',
        score: 80,
        probability: 0.8,
        confidence: 0.78,
        factors: [],
        recommendation: 'Test',
        timestamp: new Date(),
        result: {
          predictedLTV30: 2500,
          predictedLTV90: 7200,
          predictedLTV365: 28000,
          tier: 'GOLD',
          confidence: 0.78,
          monthlyValue: 2500,
          retentionRate: 0.85
        }
      };

      expect(prediction.type).toBe('ltv');
      expect(prediction.result.tier).toBe('GOLD');
      expect(prediction.result.predictedLTV365).toBe(28000);
      expect(prediction.result.confidence).toBe(0.78);
    });
  });

  describe('RevisitPrediction', () => {
    it('should have revisit-specific result structure', () => {
      const predictedDate = new Date();
      predictedDate.setDate(predictedDate.getDate() + 7);

      const prediction: RevisitPrediction = {
        userId: 'user123',
        type: 'revisit',
        score: 65,
        probability: 0.65,
        confidence: 0.75,
        factors: [],
        recommendation: 'Test',
        timestamp: new Date(),
        result: {
          daysUntilNextVisit: 7,
          predictedVisitDate: predictedDate,
          visitProbability: 0.65,
          optimalEngagementWindow: {
            start: new Date(),
            end: new Date()
          },
          suggestedActions: ['Send reminder']
        }
      };

      expect(prediction.type).toBe('revisit');
      expect(prediction.result.daysUntilNextVisit).toBe(7);
      expect(prediction.result.visitProbability).toBe(0.65);
      expect(prediction.result.suggestedActions).toHaveLength(1);
    });
  });

  describe('ConversionPrediction', () => {
    it('should have conversion-specific result structure', () => {
      const prediction: ConversionPrediction = {
        userId: 'user123',
        type: 'conversion',
        score: 55,
        probability: 0.55,
        confidence: 0.7,
        factors: [],
        recommendation: 'Test',
        timestamp: new Date(),
        result: {
          conversionProbability: 0.55,
          funnelStage: 'consideration',
          barriers: ['Low engagement'],
          incentives: ['Welcome offer']
        }
      };

      expect(prediction.type).toBe('conversion');
      expect(prediction.result.funnelStage).toBe('consideration');
      expect(prediction.result.barriers).toHaveLength(1);
      expect(prediction.result.incentives).toHaveLength(1);
    });
  });
});
