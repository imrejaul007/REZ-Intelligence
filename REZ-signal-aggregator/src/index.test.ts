import { describe, it, expect, beforeEach } from 'vitest';
import { computeOverall, evaluateSegments, SIGNAL_WEIGHTS, type SignalScores } from './index.js';

describe('Signal Aggregation', () => {
  describe('computeOverall', () => {
    it('should compute weighted average correctly', () => {
      const signals: SignalScores = {
        location: 100,
        behavioral: 100,
        social: 100,
        competitor: 100,
        engagement: 100,
      };

      const result = computeOverall(signals);
      expect(result).toBe(100);
    });

    it('should handle mixed scores', () => {
      const signals: SignalScores = {
        location: 50,
        behavioral: 75,
        social: 80,
        competitor: 60,
        engagement: 90,
      };

      // Expected: 50*0.15 + 75*0.25 + 80*0.15 + 60*0.20 + 90*0.25
      // = 7.5 + 18.75 + 12 + 12 + 22.5 = 72.75 ≈ 73
      const result = computeOverall(signals);
      expect(result).toBe(73);
    });

    it('should handle minimum scores', () => {
      const signals: SignalScores = {
        location: 0,
        behavioral: 0,
        social: 0,
        competitor: 0,
        engagement: 0,
      };

      const result = computeOverall(signals);
      expect(result).toBe(0);
    });

    it('should round to nearest integer', () => {
      const signals: SignalScores = {
        location: 33,
        behavioral: 33,
        social: 33,
        competitor: 33,
        engagement: 33,
      };

      // 33 * (0.15 + 0.25 + 0.15 + 0.20 + 0.25) = 33 * 1.0 = 33
      const result = computeOverall(signals);
      expect(result).toBe(33);
    });
  });

  describe('evaluateSegments', () => {
    it('should assign high-value segment for score >= 75', () => {
      const signals: SignalScores = {
        location: 80,
        behavioral: 80,
        social: 80,
        competitor: 80,
        engagement: 80,
      };

      const segments = evaluateSegments(signals, 80);
      expect(segments).toContain('high-value');
      expect(segments).toContain('engaged');
    });

    it('should assign at-risk segment for score <= 40', () => {
      const signals: SignalScores = {
        location: 20,
        behavioral: 20,
        social: 20,
        competitor: 20,
        engagement: 20,
      };

      const segments = evaluateSegments(signals, 30);
      expect(segments).toContain('at-risk');
      expect(segments).toContain('casual');
    });

    it('should assign power-user for engagement >= 80', () => {
      const signals: SignalScores = {
        location: 50,
        behavioral: 50,
        social: 50,
        competitor: 50,
        engagement: 85,
      };

      const overall = computeOverall(signals);
      const segments = evaluateSegments(signals, overall);
      expect(segments).toContain('power-user');
    });

    it('should assign influencer for high social AND engagement', () => {
      const signals: SignalScores = {
        location: 60,
        behavioral: 60,
        social: 80,
        competitor: 60,
        engagement: 80,
      };

      const overall = computeOverall(signals);
      const segments = evaluateSegments(signals, overall);
      expect(segments).toContain('influencer');
    });

    it('should assign competitor-conscious for competitor score >= 70', () => {
      const signals: SignalScores = {
        location: 50,
        behavioral: 50,
        social: 50,
        competitor: 75,
        engagement: 50,
      };

      const overall = computeOverall(signals);
      const segments = evaluateSegments(signals, overall);
      expect(segments).toContain('competitor-conscious');
    });

    it('should assign multiple segments correctly', () => {
      const signals: SignalScores = {
        location: 70,
        behavioral: 85,
        social: 75,
        competitor: 60,
        engagement: 85,
      };

      const overall = computeOverall(signals);
      const segments = evaluateSegments(signals, overall);

      expect(segments).toContain('high-value');
      expect(segments).toContain('engaged');
      expect(segments).toContain('power-user');
      expect(segments).toContain('location-sensitive');
      expect(segments).toContain('social-butterfly');
      expect(segments).toContain('influencer');
    });
  });

  describe('SIGNAL_WEIGHTS', () => {
    it('should have weights that sum to 1', () => {
      const total = Object.values(SIGNAL_WEIGHTS).reduce((sum, w) => sum + w, 0);
      expect(total).toBe(1);
    });

    it('should have all required signal types', () => {
      const expectedTypes = ['location', 'behavioral', 'social', 'competitor', 'engagement'];
      const actualTypes = Object.keys(SIGNAL_WEIGHTS);

      expect(actualTypes.sort()).toEqual(expectedTypes.sort());
    });
  });
});
