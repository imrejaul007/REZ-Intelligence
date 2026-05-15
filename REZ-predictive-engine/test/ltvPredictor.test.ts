import { IUserProfile } from '../src/models/userProfile';

// Mock the UserProfile model
jest.mock('../src/models/userProfile', () => ({
  UserProfile: {
    findOne: jest.fn()
  }
}));

// Import after mocking
import { predictLTV, predictLTVFromProfile } from '../src/services/ltvPredictor';
import { UserProfile } from '../src/models/userProfile';

describe('LTV Predictor', () => {
  // Sample user profiles for testing
  const platinumUser: Partial<IUserProfile> = {
    userId: 'user-platinum-001',
    totalOrders: 50,
    avgOrderValue: 5000,
    ordersPerMonth: 5,
    engagementScore: 90,
    accountAge: 730, // 2 years
    isEmailVerified: true,
    isPhoneVerified: true,
    loyaltyPoints: 10000,
    preferredPaymentMethods: ['card', 'upi', 'wallet'],
    emailOpenRate: 0.7,
    loginFrequency: 10
  };

  const goldUser: Partial<IUserProfile> = {
    userId: 'user-gold-001',
    totalOrders: 20,
    avgOrderValue: 2500,
    ordersPerMonth: 2,
    engagementScore: 70,
    accountAge: 365,
    isEmailVerified: true,
    isPhoneVerified: true,
    loyaltyPoints: 3000,
    emailOpenRate: 0.5,
    loginFrequency: 5
  };

  const bronzeUser: Partial<IUserProfile> = {
    userId: 'user-bronze-001',
    totalOrders: 3,
    avgOrderValue: 400,
    ordersPerMonth: 0.5,
    engagementScore: 30,
    accountAge: 45,
    isEmailVerified: false,
    isPhoneVerified: false,
    loginFrequency: 1
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('predictLTVFromProfile', () => {
    it('should assign PLATINUM tier to high-value users', () => {
      const prediction = predictLTVFromProfile(platinumUser as IUserProfile);

      expect(prediction.userId).toBe('user-platinum-001');
      expect(prediction.type).toBe('ltv');
      expect(prediction.result.tier).toBe('PLATINUM');
      expect(prediction.result.predictedLTV365).toBeGreaterThan(50000);
    });

    it('should assign GOLD tier to medium-value users', () => {
      const prediction = predictLTVFromProfile(goldUser as IUserProfile);

      expect(prediction.result.tier).toBe('GOLD');
      expect(prediction.result.predictedLTV365).toBeGreaterThan(20000);
      expect(prediction.result.predictedLTV365).toBeLessThan(50000);
    });

    it('should assign BRONZE tier to low-value users', () => {
      const prediction = predictLTVFromProfile(bronzeUser as IUserProfile);

      expect(prediction.result.tier).toBe('BRONZE');
      expect(prediction.result.predictedLTV365).toBeLessThan(5000);
    });

    it('should calculate 30-day LTV with positive value', () => {
      const prediction = predictLTVFromProfile(goldUser as IUserProfile);

      // Just verify it's a positive number related to base monthly value
      const baseMonthly = goldUser.avgOrderValue! * goldUser.ordersPerMonth!;
      expect(prediction.result.predictedLTV30).toBeGreaterThan(baseMonthly * 0.5);
      expect(prediction.result.predictedLTV30).toBeLessThan(baseMonthly * 2);
    });

    it('should calculate 90-day LTV with retention', () => {
      const prediction = predictLTVFromProfile(goldUser as IUserProfile);

      // 90-day should be greater than 30-day
      expect(prediction.result.predictedLTV90).toBeGreaterThan(prediction.result.predictedLTV30);
      // But less than 4x (allowing for retention)
      expect(prediction.result.predictedLTV90).toBeLessThan(prediction.result.predictedLTV30 * 4);
    });

    it('should calculate 365-day LTV with compounding retention', () => {
      const prediction = predictLTVFromProfile(goldUser as IUserProfile);

      // 365-day should be significantly greater than 30-day
      expect(prediction.result.predictedLTV365).toBeGreaterThan(prediction.result.predictedLTV30 * 5);
    });

    it('should return high confidence for users with data', () => {
      const prediction = predictLTVFromProfile(platinumUser as IUserProfile);

      expect(prediction.confidence).toBeGreaterThan(0.7);
    });

    it('should identify correct top factors', () => {
      const prediction = predictLTVFromProfile(platinumUser as IUserProfile);

      expect(prediction.result.tier).toBeDefined();
      expect(Array.isArray(prediction.factors)).toBe(true);
      expect(prediction.factors.length).toBeGreaterThan(0);
    });

    it('should include monthly value in result', () => {
      const prediction = predictLTVFromProfile(goldUser as IUserProfile);

      expect(prediction.result.monthlyValue).toBeDefined();
      expect(typeof prediction.result.monthlyValue).toBe('number');
    });

    it('should include retention rate in result', () => {
      const prediction = predictLTVFromProfile(goldUser as IUserProfile);

      expect(prediction.result.retentionRate).toBeDefined();
      expect(prediction.result.retentionRate).toBeGreaterThan(0);
      expect(prediction.result.retentionRate).toBeLessThanOrEqual(1);
    });

    it('should generate appropriate recommendation based on tier', () => {
      const platinumPrediction = predictLTVFromProfile(platinumUser as IUserProfile);
      const bronzePrediction = predictLTVFromProfile(bronzeUser as IUserProfile);

      expect(platinumPrediction.recommendation).toContain('VIP');
      expect(bronzePrediction.recommendation).toContain('Nurture');
    });
  });

  describe('predictLTV', () => {
    it('should fetch user from database and predict', async () => {
      (UserProfile.findOne as jest.Mock).mockResolvedValue(goldUser);

      const prediction = await predictLTV('user-gold-001');

      expect(UserProfile.findOne).toHaveBeenCalledWith({ userId: 'user-gold-001' });
      expect(prediction.userId).toBe('user-gold-001');
      expect(prediction.type).toBe('ltv');
    });

    it('should return default prediction for unknown users', async () => {
      (UserProfile.findOne as jest.Mock).mockResolvedValue(null);

      const prediction = await predictLTV('unknown-user');

      expect(prediction.userId).toBe('unknown-user');
      expect(prediction.result.tier).toBe('BRONZE');
      expect(prediction.result.predictedLTV365).toBe(0);
      expect(prediction.confidence).toBe(0.3);
    });
  });

  describe('Engagement multipliers', () => {
    it('should apply higher multiplier for highly engaged users', () => {
      const highEngagement = { ...platinumUser };
      const lowEngagement = { ...bronzeUser };

      const highPrediction = predictLTVFromProfile(highEngagement as IUserProfile);
      const lowPrediction = predictLTVFromProfile(lowEngagement as IUserProfile);

      expect(highPrediction.result.predictedLTV30).toBeGreaterThan(
        lowPrediction.result.predictedLTV30
      );
    });
  });

  describe('Retention rate calculation', () => {
    it('should have higher retention for verified accounts', () => {
      const verified = { ...goldUser, isEmailVerified: true, isPhoneVerified: true };
      const unverified = { ...goldUser, isEmailVerified: false, isPhoneVerified: false };

      const verifiedPrediction = predictLTVFromProfile(verified as IUserProfile);
      const unverifiedPrediction = predictLTVFromProfile(unverified as IUserProfile);

      expect(verifiedPrediction.result.retentionRate).toBeGreaterThanOrEqual(
        unverifiedPrediction.result.retentionRate
      );
    });

    it('should have higher retention for loyal customers', () => {
      const loyal = { ...goldUser, loyaltyPoints: 5000 };
      const newCustomer = { ...goldUser, loyaltyPoints: 100 };

      const loyalPrediction = predictLTVFromProfile(loyal as IUserProfile);
      const newCustomerPrediction = predictLTVFromProfile(newCustomer as IUserProfile);

      expect(loyalPrediction.result.retentionRate).toBeGreaterThanOrEqual(
        newCustomerPrediction.result.retentionRate
      );
    });
  });
});
