import { IUserProfile } from '../src/models/userProfile';

// Mock the UserProfile model
jest.mock('../src/models/userProfile', () => ({
  UserProfile: {
    findOne: jest.fn()
  }
}));

// Import after mocking
import { predictChurn, predictChurnFromProfile } from '../src/services/churnPredictor';
import { UserProfile } from '../src/models/userProfile';

describe('Churn Predictor', () => {
  // Sample user profiles for testing
  const activeUser: Partial<IUserProfile> = {
    userId: 'user-active-001',
    totalOrders: 15,
    avgOrderValue: 2500,
    ordersPerMonth: 3,
    engagementScore: 75,
    lastOrderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    accountAge: 365,
    isEmailVerified: true,
    isPhoneVerified: true,
    emailOpenRate: 0.6,
    loginFrequency: 7
  };

  const atRiskUser: Partial<IUserProfile> = {
    userId: 'user-atrisk-001',
    totalOrders: 2,
    avgOrderValue: 400,
    ordersPerMonth: 0.5,
    engagementScore: 25,
    lastOrderDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
    accountAge: 60,
    isEmailVerified: true,
    isPhoneVerified: false,
    emailOpenRate: 0.1,
    loginFrequency: 1,
    cartAbandonmentRate: 0.8
  };

  const newUser: Partial<IUserProfile> = {
    userId: 'user-new-001',
    totalOrders: 1,
    avgOrderValue: 800,
    ordersPerMonth: 1,
    engagementScore: 50,
    lastOrderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    accountAge: 10,
    isEmailVerified: false,
    isPhoneVerified: false,
    loginFrequency: 3
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('predictChurnFromProfile', () => {
    it('should predict LOW risk for active user', async () => {
      const prediction = predictChurnFromProfile(activeUser as IUserProfile);

      expect(prediction.userId).toBe('user-active-001');
      expect(prediction.type).toBe('churn');
      expect(prediction.score).toBeLessThan(50); // Should be relatively low risk
      expect(prediction.result.risk).toBe('LOW');
      expect(prediction.confidence).toBeGreaterThan(0.5);
    });

    it('should predict HIGH or CRITICAL risk for at-risk user', async () => {
      const prediction = predictChurnFromProfile(atRiskUser as IUserProfile);

      expect(prediction.userId).toBe('user-atrisk-001');
      expect(prediction.type).toBe('churn');
      expect(prediction.score).toBeGreaterThan(50); // Should be high risk
      expect(['HIGH', 'CRITICAL']).toContain(prediction.result.risk);
    });

    it('should return high confidence for active users', async () => {
      const prediction = predictChurnFromProfile(activeUser as IUserProfile);

      expect(prediction.confidence).toBeGreaterThan(0.7);
    });

    it('should identify top factors for at-risk users', async () => {
      const prediction = predictChurnFromProfile(atRiskUser as IUserProfile);

      expect(prediction.result.topFactors.length).toBeGreaterThan(0);
      expect(prediction.result.topFactors[0]).toContain('No order');
    });

    it('should suggest retention offers based on risk level', async () => {
      // At-risk user
      const atRiskPrediction = predictChurnFromProfile(atRiskUser as IUserProfile);
      expect(atRiskPrediction.result.retentionOffers.length).toBeGreaterThanOrEqual(2);

      // Active user - low risk
      const activePrediction = predictChurnFromProfile(activeUser as IUserProfile);
      expect(activePrediction.result.retentionOffers.length).toBeGreaterThanOrEqual(2);
    });

    it('should include factors array with expected structure', async () => {
      const prediction = predictChurnFromProfile(activeUser as IUserProfile);

      expect(Array.isArray(prediction.factors)).toBe(true);
      prediction.factors.forEach(factor => {
        expect(factor).toHaveProperty('name');
        expect(factor).toHaveProperty('impact');
        expect(factor).toHaveProperty('value');
      });
    });

    it('should have valid timestamp', async () => {
      const prediction = predictChurnFromProfile(activeUser as IUserProfile);

      expect(prediction.timestamp).toBeInstanceOf(Date);
      expect(prediction.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should calculate days until churn for at-risk users', async () => {
      const prediction = predictChurnFromProfile(atRiskUser as IUserProfile);

      expect(prediction.result.daysUntilChurn).toBeDefined();
      expect(typeof prediction.result.daysUntilChurn).toBe('number');
    });
  });

  describe('predictChurn', () => {
    it('should fetch user from database and predict', async () => {
      (UserProfile.findOne as jest.Mock).mockResolvedValue(activeUser);

      const prediction = await predictChurn('user-active-001');

      expect(UserProfile.findOne).toHaveBeenCalledWith({ userId: 'user-active-001' });
      expect(prediction.userId).toBe('user-active-001');
      expect(prediction.type).toBe('churn');
    });

    it('should return default prediction for unknown users', async () => {
      (UserProfile.findOne as jest.Mock).mockResolvedValue(null);

      const prediction = await predictChurn('unknown-user');

      expect(prediction.userId).toBe('unknown-user');
      expect(prediction.score).toBe(50); // Neutral score
      expect(prediction.confidence).toBe(0.3); // Low confidence
      expect(prediction.result.risk).toBe('MEDIUM');
    });

    it('should handle database errors gracefully', async () => {
      (UserProfile.findOne as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await expect(predictChurn('user-001')).rejects.toThrow('DB Error');
    });
  });

  describe('Edge cases', () => {
    it('should handle user with no last order date', async () => {
      const userNoOrder: Partial<IUserProfile> = {
        userId: 'user-noorder-001',
        totalOrders: 0,
        avgOrderValue: 0,
        ordersPerMonth: 0,
        engagementScore: 20,
        lastOrderDate: undefined,
        accountAge: 5
      };

      const prediction = predictChurnFromProfile(userNoOrder as IUserProfile);

      expect(prediction.result.risk).toBeDefined();
      expect(prediction.result.topFactors).toBeDefined();
    });

    it('should handle user with missing engagement data', async () => {
      const userMinimal: Partial<IUserProfile> = {
        userId: 'user-minimal-001',
        totalOrders: 5,
        avgOrderValue: 1000,
        ordersPerMonth: 1,
        engagementScore: 50,
        accountAge: 30
      };

      const prediction = predictChurnFromProfile(userMinimal as IUserProfile);

      expect(prediction.confidence).toBeLessThan(0.9);
      expect(prediction.result.risk).toBeDefined();
    });

    it('should produce higher churn scores for inactive users', () => {
      const active = predictChurnFromProfile(activeUser as IUserProfile);
      const inactive = predictChurnFromProfile(atRiskUser as IUserProfile);

      expect(inactive.score).toBeGreaterThan(active.score);
    });
  });
});
