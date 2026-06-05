/**
 * Integration Tests for REZ Growth Playbook
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4291';

describe('REZ Growth Playbook', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('growth-playbook');
    });
  });

  describe('Playbook Discovery', () => {
    it('should get all playbooks', async () => {
      const response = await fetch(`${BASE_URL}/api/playbooks`);
      const playbooks = await response.json();

      expect(Array.isArray(playbooks)).toBe(true);
      expect(playbooks.length).toBeGreaterThan(0);
    });

    it('should filter playbooks by industry', async () => {
      const response = await fetch(`${BASE_URL}/api/playbooks?industry=restaurant`);
      const playbooks = await response.json();

      expect(Array.isArray(playbooks)).toBe(true);
      playbooks.forEach((p: any) => {
        expect(p.industry).toContain('restaurant');
      });
    });

    it('should get playbook by ID', async () => {
      const response = await fetch(`${BASE_URL}/api/playbooks/lunch-rush-boost`);
      const playbook = await response.json();

      expect(playbook.id).toBe('lunch-rush-boost');
      expect(playbook.name).toBeDefined();
      expect(playbook.steps).toBeDefined();
    });

    it('should get playbooks by industry', async () => {
      const response = await fetch(`${BASE_URL}/api/playbooks/industry/restaurant`);
      const playbooks = await response.json();

      expect(Array.isArray(playbooks)).toBe(true);
    });
  });

  describe('Categories and Industries', () => {
    it('should get all categories', async () => {
      const response = await fetch(`${BASE_URL}/api/categories`);
      const categories = await response.json();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    it('should get all industries', async () => {
      const response = await fetch(`${BASE_URL}/api/industries`);
      const industries = await response.json();

      expect(Array.isArray(industries)).toBe(true);
      expect(industries).toContain('restaurant');
      expect(industries).toContain('retail');
    });
  });

  describe('Recommendations', () => {
    it('should recommend playbooks based on goals', async () => {
      const response = await fetch(`${BASE_URL}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: 'restaurant',
          goals: ['increase_lunch_visits', 'increase_slow_hour_traffic'],
          budget: 15000
        })
      });

      expect(response.status).toBe(200);
      const recommendations = await response.json();

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(5);
    });
  });
});
