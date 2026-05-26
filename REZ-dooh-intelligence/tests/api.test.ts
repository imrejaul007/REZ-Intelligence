describe('DOOH Intelligence API', () => {
  const BASE_URL = 'http://localhost:4080';

  describe('Health Endpoints', () => {
    it('GET /health should return healthy status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('rez-dooh-intelligence');
    });
  });

  describe('Screen Types', () => {
    it('GET /api/screens/types should list all screen types', async () => {
      const response = await fetch(`${BASE_URL}/api/screens/types`);
      const data = await response.json();

      if (response.status === 200) {
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data.screens)).toBe(true);
      }
    });
  });

  describe('Pricing', () => {
    it('POST /api/pricing/calculate should calculate pricing', async () => {
      const response = await fetch(`${BASE_URL}/api/pricing/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenType: 'billboard_led',
          location: { city: 'Mumbai', tier: 'metro' },
          scheduledTime: { start: new Date(), end: new Date() },
          campaignObjective: 'awareness',
        }),
      });

      const data = await response.json();

      if (response.status === 200) {
        expect(data.success).toBe(true);
        expect(data.data.finalCPM).toBeDefined();
      }
    });

    it('GET /api/pricing/multipliers should return multiplier values', async () => {
      const response = await fetch(`${BASE_URL}/api/pricing/multipliers`);
      const data = await response.json();

      if (response.status === 200) {
        expect(data.success).toBe(true);
        expect(data.data.time).toBeDefined();
        expect(data.data.city).toBeDefined();
      }
    });
  });

  describe('Targeting', () => {
    it('POST /api/targeting/users should find targeted users', async () => {
      const response = await fetch(`${BASE_URL}/api/targeting/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenType: 'cab_screen',
          location: { city: 'Mumbai', tier: 'metro' },
          demographics: { ageRange: ['25-35'], income: ['medium'] },
        }),
      });

      const data = await response.json();

      if (response.status === 200) {
        expect(data.success).toBe(true);
        expect(data.data.count).toBeDefined();
      }
    });
  });
});
