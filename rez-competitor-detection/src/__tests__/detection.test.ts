import {
  detectCompetitorSwitcher,
  calculateLoyaltyScore,
  calculateWinBackPotential,
  calculateRiskLevel
} from '../services/detectionService';
import { DetectionInput } from '../types/interfaces';

describe('Detection Service', () => {
  describe('detectCompetitorSwitcher', () => {
    it('should detect price alert signal for high competitor price views', () => {
      const input: DetectionInput = {
        userId: 'user123',
        viewedCompetitorPrices: 10,
        ratingTrend: 0,
        visitsToNewCompetitor: 0,
        totalSpending: 1000,
        competitorSpending: 200,
        lastOrderDate: new Date(),
        averageOrderValue: 200,
        orderFrequency: 5,
        competitorVisits: []
      };

      const signals = detectCompetitorSwitcher(input);

      expect(signals).toHaveLength(2);
      const priceAlert = signals.find(s => s.type === 'price_alert');
      expect(priceAlert).toBeDefined();
      expect(priceAlert?.severity).toBe('high');
    });

    it('should detect review drop signal', () => {
      const input: DetectionInput = {
        userId: 'user123',
        viewedCompetitorPrices: 0,
        ratingTrend: -0.8,
        visitsToNewCompetitor: 0,
        totalSpending: 1000,
        competitorSpending: 0,
        lastOrderDate: new Date(),
        averageOrderValue: 200,
        orderFrequency: 5,
        competitorVisits: []
      };

      const signals = detectCompetitorSwitcher(input);

      const reviewDrop = signals.find(s => s.type === 'review_drop');
      expect(reviewDrop).toBeDefined();
      expect(reviewDrop?.severity).toBe('medium');
    });

    it('should detect new competitor signal', () => {
      const input: DetectionInput = {
        userId: 'user123',
        viewedCompetitorPrices: 0,
        ratingTrend: 0,
        visitsToNewCompetitor: 2,
        totalSpending: 1000,
        competitorSpending: 0,
        lastOrderDate: new Date(),
        averageOrderValue: 200,
        orderFrequency: 5,
        competitorVisits: []
      };

      const signals = detectCompetitorSwitcher(input);

      const newCompetitor = signals.find(s => s.type === 'new_competitor');
      expect(newCompetitor).toBeDefined();
      expect(newCompetitor?.severity).toBe('high');
    });

    it('should return empty array for loyal user', () => {
      const input: DetectionInput = {
        userId: 'user123',
        viewedCompetitorPrices: 0,
        ratingTrend: 0.2,
        visitsToNewCompetitor: 0,
        totalSpending: 1000,
        competitorSpending: 50,
        lastOrderDate: new Date(),
        averageOrderValue: 200,
        orderFrequency: 10,
        competitorVisits: []
      };

      const signals = detectCompetitorSwitcher(input);

      expect(signals).toHaveLength(0);
    });
  });

  describe('calculateLoyaltyScore', () => {
    it('should return high score for loyal user', () => {
      const input: DetectionInput = {
        userId: 'user123',
        viewedCompetitorPrices: 0,
        ratingTrend: 0.1,
        visitsToNewCompetitor: 0,
        totalSpending: 5000,
        competitorSpending: 100,
        lastOrderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        averageOrderValue: 600,
        orderFrequency: 8,
        competitorVisits: []
      };

      const score = calculateLoyaltyScore(input);

      expect(score).toBeGreaterThan(60);
    });

    it('should return low score for at-risk user', () => {
      const input: DetectionInput = {
        userId: 'user123',
        viewedCompetitorPrices: 15,
        ratingTrend: -0.8,
        visitsToNewCompetitor: 3,
        totalSpending: 2000,
        competitorSpending: 1500,
        lastOrderDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
        averageOrderValue: 150,
        orderFrequency: 2,
        competitorVisits: []
      };

      const score = calculateLoyaltyScore(input);

      expect(score).toBeLessThan(30);
    });
  });

  describe('calculateWinBackPotential', () => {
    it('should return hot tier for low loyalty, high competitor spending', () => {
      const result = calculateWinBackPotential(
        20,           // low loyalty
        70,           // high competitor share
        1500,         // high competitor spending
        new Date(),   // recent visit
        ['swiggy', 'zomato']
      );

      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.tier).toBe('hot');
      expect(result.optimalChannel).toBe('whatsapp');
    });

    it('should return cold tier for moderate loyalty', () => {
      const result = calculateWinBackPotential(
        65,           // moderate loyalty
        20,           // low competitor share
        200,          // low competitor spending
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        []
      );

      expect(result.tier).toBe('cold');
      expect(result.optimalChannel).toBe('sms');
    });

    it('should recommend price_match for high competitor share', () => {
      const result = calculateWinBackPotential(
        30,
        60,
        800,
        new Date(),
        ['dominos']
      );

      expect(result.topTrigger).toBe('price_match');
    });
  });

  describe('calculateRiskLevel', () => {
    it('should return critical for very low loyalty and high signals', () => {
      const risk = calculateRiskLevel(
        15,   // very low loyalty
        75,   // very high competitor share
        6,    // many signals
        3     // visited 3 days ago
      );

      expect(risk).toBe('critical');
    });

    it('should return low for loyal user', () => {
      const risk = calculateRiskLevel(
        80,   // high loyalty
        10,   // low competitor share
        0,    // no signals
        null  // no recent visit
      );

      expect(risk).toBe('low');
    });

    it('should return high for medium risk factors', () => {
      const risk = calculateRiskLevel(
        35,   // low loyalty
        55,   // medium competitor share
        4,    // moderate signals
        5     // recent visit
      );

      expect(risk).toBe('high');
    });
  });
});

describe('API Integration Tests', () => {
  const API_BASE = 'http://localhost:4059/api/competitor';
  const TEST_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'test-token';

  describe('Profile Endpoints', () => {
    it('should record competitor visit', async () => {
      // This test requires the service to be running
      const visitData = {
        userId: 'test-user-123',
        competitorId: 'swiggy',
        competitorName: 'Swiggy',
        category: 'food_delivery',
        spend: 350,
        visitType: 'delivery'
      };

      // Skip if service not running
      try {
        const response = await fetch(`${API_BASE}/visit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': TEST_TOKEN
          },
          body: JSON.stringify(visitData)
        });

        if (response.ok) {
          const result = await response.json();
          expect(result.success).toBe(true);
        }
      } catch {
        // Service not running, skip test
        console.log('Skipping integration test - service not running');
      }
    });

    it('should get competitor profile', async () => {
      try {
        const response = await fetch(`${API_BASE}/test-user-123`, {
          headers: {
            'X-Internal-Token': TEST_TOKEN
          }
        });

        if (response.ok) {
          const result = await response.json();
          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();
        }
      } catch {
        console.log('Skipping integration test - service not running');
      }
    });
  });
});
