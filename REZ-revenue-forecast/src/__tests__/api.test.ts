/**
 * Integration Tests for REZ Revenue Forecast
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4213';

describe('REZ Revenue Forecast', () => {
  const testMerchantId = 'test_merchant_forecast_123';

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('revenue-forecast');
    });
  });

  describe('Revenue Recording', () => {
    it('should record revenue snapshot', async () => {
      const today = new Date().toISOString().split('T')[0];

      const response = await fetch(`${BASE_URL}/api/revenue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: testMerchantId,
          date: today,
          revenue: 45000,
          orders: 120,
          customers: 100,
          newCustomers: 20
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.merchantId).toBe(testMerchantId);
      expect(data.revenue).toBe(45000);
      expect(data.orders).toBe(120);
    });
  });

  describe('Revenue Forecasting', () => {
    it('should get today prediction', async () => {
      // First record some historical data
      for (let i = 1; i <= 10; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        await fetch(`${BASE_URL}/api/revenue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantId: testMerchantId,
            date: dateStr,
            revenue: 40000 + Math.random() * 10000,
            orders: 100 + Math.floor(Math.random() * 30),
            customers: 90 + Math.floor(Math.random() * 20),
            newCustomers: 15 + Math.floor(Math.random() * 10)
          })
        });
      }

      const response = await fetch(`${BASE_URL}/api/forecast/${testMerchantId}/today`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.merchantId).toBe(testMerchantId);
      expect(data.predicted).toBeGreaterThan(0);
      expect(data.confidence).toBeGreaterThan(0);
      expect(data.lower).toBeLessThan(data.predicted);
      expect(data.upper).toBeGreaterThan(data.predicted);
    });

    it('should get weekly forecast', async () => {
      const response = await fetch(`${BASE_URL}/api/forecast/${testMerchantId}/week`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.merchantId).toBe(testMerchantId);
      expect(data.predictions).toBeDefined();
      expect(data.predictions.length).toBe(7);
      expect(data.totalPredicted).toBeGreaterThan(0);
    });

    it('should get monthly forecast', async () => {
      const response = await fetch(`${BASE_URL}/api/forecast/${testMerchantId}/month`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.merchantId).toBe(testMerchantId);
      expect(data.monthlyPredicted).toBeGreaterThan(0);
      expect(data.weeklyBreakdown).toBeDefined();
    });
  });

  describe('Campaign Impact Prediction', () => {
    it('should predict campaign impact', async () => {
      const response = await fetch(`${BASE_URL}/api/forecast/campaign-impact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: testMerchantId,
          campaignType: 'cashback',
          budget: 10000,
          duration: 7
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.expectedRevenue).toBeGreaterThan(0);
      expect(data.expectedConversions).toBeGreaterThan(0);
      expect(data.confidence).toBeGreaterThan(0);
    });
  });

  describe('Revenue Analytics', () => {
    it('should get revenue history', async () => {
      const response = await fetch(`${BASE_URL}/api/revenue/${testMerchantId}`);
      const data = await response.json();

      expect(Array.isArray(data)).toBe(true);
    });

    it('should get revenue stats', async () => {
      const response = await fetch(`${BASE_URL}/api/revenue/${testMerchantId}/stats?days=30`);
      const stats = await response.json();

      expect(stats.totalRevenue).toBeGreaterThanOrEqual(0);
    });
  });
});
