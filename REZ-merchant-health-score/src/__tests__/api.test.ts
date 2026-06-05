/**
 * Integration Tests for REZ Merchant Health Score
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4293';

describe('REZ Merchant Health Score', () => {
  const testMerchantId = 'test_merchant_health_123';

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('merchant-health-score');
    });
  });

  describe('Health Score Calculation', () => {
    it('should calculate health score', async () => {
      const response = await fetch(`${BASE_URL}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: testMerchantId,
          industry: 'restaurant',
          revenue: {
            current: 500000,
            previous: 450000,
            target: 600000
          },
          customers: {
            total: 1000,
            new: 100,
            active: 700,
            churned: 50,
            returning: 600
          },
          engagement: {
            loyaltyMembers: 300,
            referrals: 50,
            reviews: 200,
            avgRating: 4.5,
            positiveReviews: 180
          },
          operational: {
            avgOrderValue: 500,
            ordersPerDay: 100,
            fulfillmentRate: 95,
            avgDeliveryTime: 35,
            complaints: 3
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.merchantId).toBe(testMerchantId);
      expect(data.score).toBeGreaterThanOrEqual(0);
      expect(data.score).toBeLessThanOrEqual(100);
      expect(data.tier).toMatch(/platinum|gold|silver|bronze|at_risk/);
      expect(data.components).toBeDefined();
    });

    it('should detect risks', async () => {
      const response = await fetch(`${BASE_URL}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: 'test_risky_merchant',
          industry: 'restaurant',
          revenue: {
            current: 100000,
            previous: 200000,
            target: 300000
          },
          customers: {
            total: 100,
            new: 5,
            active: 30,
            churned: 30,
            returning: 20
          },
          engagement: {
            loyaltyMembers: 5,
            referrals: 1,
            reviews: 10,
            avgRating: 2.5,
            positiveReviews: 3
          },
          operational: {
            avgOrderValue: 300,
            ordersPerDay: 10,
            fulfillmentRate: 70,
            avgDeliveryTime: 60,
            complaints: 10
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.risks.length).toBeGreaterThan(0);
      expect(data.score).toBeLessThan(60); // Should be lower tier
    });
  });

  describe('Score Retrieval', () => {
    it('should get existing score', async () => {
      const response = await fetch(`${BASE_URL}/api/score/${testMerchantId}`);
      const data = await response.json();

      expect(data.merchantId).toBe(testMerchantId);
      expect(data.score).toBeDefined();
    });

    it('should get scores with filters', async () => {
      const response = await fetch(`${BASE_URL}/api/scores?tier=gold`);
      const scores = await response.json();

      expect(Array.isArray(scores)).toBe(true);
    });
  });

  describe('Industry Benchmarks', () => {
    it('should get industry benchmarks', async () => {
      const response = await fetch(`${BASE_URL}/api/benchmarks/restaurant`);
      const benchmarks = await response.json();

      expect(benchmarks.industry).toBe('restaurant');
      expect(benchmarks.merchantCount).toBeGreaterThanOrEqual(0);
    });
  });
});
