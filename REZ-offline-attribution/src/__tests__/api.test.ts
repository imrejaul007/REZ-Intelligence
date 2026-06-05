/**
 * Integration Tests for REZ Offline Attribution
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4294';

describe('REZ Offline Attribution', () => {
  const testMerchantId = 'test_merchant_offline_123';
  const testCustomerId = 'test_customer_456';

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
    });
  });

  describe('Touchpoint Recording', () => {
    it('should record QR scan touchpoint', async () => {
      const response = await fetch(`${BASE_URL}/api/touchpoints/qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: testMerchantId,
          customerId: testCustomerId,
          qrCodeId: 'qr_table_5'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.channel).toBe('qr_scan');
      expect(data.type).toBe('walk_in');
      expect(data.customerId).toBe(testCustomerId);
    });

    it('should record phone call touchpoint', async () => {
      const response = await fetch(`${BASE_URL}/api/touchpoints/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: testMerchantId,
          customerId: testCustomerId,
          phoneNumber: '+919876543210',
          callDuration: 180
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.type).toBe('phone_call');
      expect(data.metadata.callDuration).toBe(180);
    });

    it('should record in-store visit', async () => {
      const response = await fetch(`${BASE_URL}/api/touchpoints/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: testMerchantId,
          customerId: testCustomerId,
          checkInTime: new Date().toISOString()
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.type).toBe('dine_in');
    });
  });

  describe('Conversion Recording', () => {
    it('should record offline conversion', async () => {
      const response = await fetch(`${BASE_URL}/api/conversions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: testMerchantId,
          customerId: testCustomerId,
          type: 'purchase',
          revenue: 2500,
          attributionData: {
            model: 'position_based'
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.type).toBe('purchase');
      expect(data.revenue).toBe(2500);
      expect(data.attributedTouchpoints).toBeDefined();
    });
  });

  describe('Attribution Reporting', () => {
    it('should get channel attribution report', async () => {
      const response = await fetch(`${BASE_URL}/api/reports/${testMerchantId}/channel`);
      const report = await response.json();

      expect(Array.isArray(report)).toBe(true);
    });

    it('should get customer journey', async () => {
      const response = await fetch(`${BASE_URL}/api/journey/${testMerchantId}/${testCustomerId}`);
      const journey = await response.json();

      expect(journey.customerId).toBe(testCustomerId);
      expect(journey.summary).toBeDefined();
      expect(journey.journey).toBeDefined();
    });
  });
});
