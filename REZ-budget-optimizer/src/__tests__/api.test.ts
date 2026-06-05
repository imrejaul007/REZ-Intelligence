/**
 * Integration Tests for REZ Budget Optimizer
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4290';

describe('REZ Budget Optimizer', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('budget-optimizer');
    });
  });

  describe('Campaign Management', () => {
    let campaignId: string;

    it('should create a campaign', async () => {
      const response = await fetch(`${BASE_URL}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: 'test_merchant_123',
          name: 'Test Campaign',
          channel: 'instagram',
          currentBudget: 25000
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe('Test Campaign');
      expect(data.channel).toBe('instagram');
      campaignId = data._id;
    });

    it('should get campaigns', async () => {
      const response = await fetch(`${BASE_URL}/api/campaigns/test_merchant_123`);
      const campaigns = await response.json();

      expect(Array.isArray(campaigns)).toBe(true);
      expect(campaigns.length).toBeGreaterThan(0);
    });

    it('should update campaign spend', async () => {
      const response = await fetch(`${BASE_URL}/api/campaigns/${campaignId}/spend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spent: 5000,
          revenue: 15000,
          conversions: 50
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.spent).toBe(5000);
      expect(data.revenue).toBe(15000);
      expect(data.roas).toBe(3);
    });
  });

  describe('Budget Optimization', () => {
    it('should optimize budget allocation', async () => {
      const response = await fetch(`${BASE_URL}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: 'test_merchant_123',
          totalBudget: 100000,
          strategy: 'roas_based'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.allocations).toBeDefined();
      expect(Array.isArray(data.allocations)).toBe(true);
      expect(data.totalBudget).toBe(100000);
      expect(data.expectedTotalRoas).toBeGreaterThan(0);
    });

    it('should respect minChannelBudget', async () => {
      const response = await fetch(`${BASE_URL}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: 'test_merchant_123',
          totalBudget: 50000,
          strategy: 'balanced',
          minChannelBudget: 10000
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Each allocation should be at least minChannelBudget
      data.allocations.forEach((alloc: any) => {
        expect(alloc.amount).toBeGreaterThanOrEqual(10000);
      });
    });
  });

  describe('Channel Performance', () => {
    it('should return channel performance', async () => {
      const response = await fetch(`${BASE_URL}/api/channels/performance`);
      const data = await response.json();

      expect(Array.isArray(data)).toBe(true);
    });
  });
});
