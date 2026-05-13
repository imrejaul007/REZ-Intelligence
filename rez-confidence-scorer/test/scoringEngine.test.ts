import { ScoringRequestSchema, CONFIDENCE_WEIGHTS } from '../src/types';

describe('Confidence Scoring Types', () => {
  describe('CONFidence Weights', () => {
    it('should have correct weight values', () => {
      expect(CONFIDENCE_WEIGHTS.intentMatch).toBe(0.35);
      expect(CONFIDENCE_WEIGHTS.contextRelevance).toBe(0.30);
      expect(CONFIDENCE_WEIGHTS.historyAccuracy).toBe(0.25);
      expect(CONFIDENCE_WEIGHTS.loadFactor).toBe(0.10);
    });

    it('should sum to 1.0', () => {
      const sum = Object.values(CONFIDENCE_WEIGHTS).reduce((acc, val) => acc + val, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    });
  });

  describe('ScoringRequestSchema', () => {
    it('should validate a valid request', () => {
      const validRequest = {
        agentId: 'agent-001',
        intent: 'process_payment',
        context: {
          domain: 'payment',
          urgency: 'high' as const,
        },
        taskComplexity: 0.5,
        requiredCapabilities: ['payment_processing'],
      };

      const result = ScoringRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should accept minimal request (only required fields)', () => {
      const minimalRequest = {
        agentId: 'agent-001',
        intent: 'process_payment',
      };

      const result = ScoringRequestSchema.safeParse(minimalRequest);
      expect(result.success).toBe(true);
    });

    it('should reject request without agentId', () => {
      const invalidRequest = {
        intent: 'process_payment',
      };

      const result = ScoringRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject request without intent', () => {
      const invalidRequest = {
        agentId: 'agent-001',
      };

      const result = ScoringRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject invalid urgency value', () => {
      const invalidRequest = {
        agentId: 'agent-001',
        intent: 'process_payment',
        context: {
          urgency: 'urgent' as any, // Invalid value
        },
      };

      const result = ScoringRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject taskComplexity out of range', () => {
      const invalidRequest = {
        agentId: 'agent-001',
        intent: 'process_payment',
        taskComplexity: 1.5, // Should be 0-1
      };

      const result = ScoringRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should default taskComplexity to 0.5', () => {
      const request = {
        agentId: 'agent-001',
        intent: 'process_payment',
      };

      const result = ScoringRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.taskComplexity).toBe(0.5);
      }
    });
  });
});

describe('Score Calculation', () => {
  it('should calculate weighted score correctly', () => {
    const intentMatch = 0.9;
    const contextRelevance = 0.8;
    const historyAccuracy = 0.7;
    const loadFactor = 0.6;

    const overallScore =
      intentMatch * CONFIDENCE_WEIGHTS.intentMatch +
      contextRelevance * CONFIDENCE_WEIGHTS.contextRelevance +
      historyAccuracy * CONFIDENCE_WEIGHTS.historyAccuracy +
      loadFactor * CONFIDENCE_WEIGHTS.loadFactor;

    // 0.9 * 0.35 + 0.8 * 0.30 + 0.7 * 0.25 + 0.6 * 0.10
    // = 0.315 + 0.24 + 0.175 + 0.06
    // = 0.79
    expect(overallScore).toBeCloseTo(0.79, 2);
  });

  it('should return 0 when all scores are 0', () => {
    const overallScore =
      0 * CONFIDENCE_WEIGHTS.intentMatch +
      0 * CONFIDENCE_WEIGHTS.contextRelevance +
      0 * CONFIDENCE_WEIGHTS.historyAccuracy +
      0 * CONFIDENCE_WEIGHTS.loadFactor;

    expect(overallScore).toBe(0);
  });

  it('should return 1 when all scores are 1', () => {
    const overallScore =
      1 * CONFIDENCE_WEIGHTS.intentMatch +
      1 * CONFIDENCE_WEIGHTS.contextRelevance +
      1 * CONFIDENCE_WEIGHTS.historyAccuracy +
      1 * CONFIDENCE_WEIGHTS.loadFactor;

    expect(overallScore).toBe(1);
  });
});

describe('Score Component Structure', () => {
  it('should have correct structure for score component', () => {
    const component = {
      score: 0.85,
      weight: 0.35,
      weightedScore: 0.85 * 0.35,
      details: {
        rawScore: 0.85,
        factors: {
          capabilityMatch: 0.85,
        },
        explanation: 'Intent matching high',
      },
    };

    expect(component).toHaveProperty('score');
    expect(component).toHaveProperty('weight');
    expect(component).toHaveProperty('weightedScore');
    expect(component).toHaveProperty('details');
    expect(component.details).toHaveProperty('rawScore');
    expect(component.details).toHaveProperty('factors');
    expect(component.details).toHaveProperty('explanation');

    expect(component.weightedScore).toBeCloseTo(0.2975, 4);
  });
});
