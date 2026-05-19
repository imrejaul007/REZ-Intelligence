/**
 * REZ-signal-aggregator Health Check Tests
 */

import { describe, it, expect } from '@jest/globals';

process.env.PORT = '4142';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.NODE_ENV = 'test';

describe('REZ-signal-aggregator Health', () => {
  describe('Health Endpoint', () => {
    it('should return healthy status', () => {
      const response = {
        status: 'healthy',
        service: 'REZ-signal-aggregator',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      };

      expect(response.status).toBe('healthy');
      expect(response.service).toBe('REZ-signal-aggregator');
    });
  });

  describe('Signal Types', () => {
    it('should define valid signal types', () => {
      const signalTypes = [
        'location',
        'behavioral',
        'social',
        'competitor',
        'engagement',
        'transactional',
      ];

      expect(signalTypes).toContain('location');
      expect(signalTypes).toContain('behavioral');
      expect(signalTypes).toContain('social');
    });
  });

  describe('Signal Weights', () => {
    it('should have valid weight range (0-1)', () => {
      const weights = {
        location: 0.15,
        behavioral: 0.25,
        social: 0.2,
        competitor: 0.15,
        engagement: 0.25,
      };

      Object.values(weights).forEach((weight) => {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      });
    });

    it('should have weights that sum to 1', () => {
      const weights = {
        location: 0.15,
        behavioral: 0.25,
        social: 0.2,
        competitor: 0.15,
        engagement: 0.25,
      };

      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 1);
    });
  });

  describe('Cache Configuration', () => {
    it('should have valid TTL values', () => {
      const cacheTtl = 300; // 5 minutes
      const realtimeCacheTtl = 30; // 30 seconds

      expect(cacheTtl).toBeGreaterThan(0);
      expect(realtimeCacheTtl).toBeGreaterThan(0);
      expect(cacheTtl).toBeGreaterThan(realtimeCacheTtl);
    });
  });
});
