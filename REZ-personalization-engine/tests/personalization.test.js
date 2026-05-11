const request = require('supertest');

// Mock mongoose before importing app
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn().mockResolvedValue(true),
    connection: {
      readyState: 1,
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(true)
    }
  };
});

// Mock models
jest.mock('../src/models/UserDNAProfile', () => ({
  findOne: jest.fn(),
  findOrCreate: jest.fn(),
  find: jest.fn(),
  aggregate: jest.fn()
}));

jest.mock('../src/models/ContentItem', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

jest.mock('../src/models/Interaction', () => {
  const mockInteraction = {
    save: jest.fn().mockResolvedValue(true),
    _id: 'interaction-id',
    userId: 'user-123',
    itemId: 'item-123',
    type: 'view',
    timestamp: new Date()
  };

  return {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([])
    }),
    aggregate: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    insertMany: jest.fn().mockResolvedValue({ insertedCount: 0 })
  };
});

// Mock cache
jest.mock('../src/utils/cache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn().mockReturnValue(true),
  delPattern: jest.fn(),
  flush: jest.fn(),
  stats: jest.fn().mockReturnValue({ hits: 0, misses: 0 }),
  generateKey: jest.fn((...args) => args.join(':'))
}));

// Mock algorithms
jest.mock('../src/algorithms/collaborativeFiltering', () => ({
  buildUserProfiles: jest.fn().mockResolvedValue(new Map()),
  getRecommendedItems: jest.fn().mockResolvedValue([]),
  getSimilarItems: jest.fn().mockResolvedValue([])
}));

jest.mock('../src/algorithms/contentBasedFiltering', () => ({
  getRecommendations: jest.fn().mockResolvedValue([]),
  updateProfile: jest.fn()
}));

jest.mock('../src/algorithms/contextualBandits', () => ({
  recommend: jest.fn().mockResolvedValue({ items: [], selectedArm: 'test' }),
  updateArm: jest.fn(),
  getStats: jest.fn().mockReturnValue({ totalPulls: 0, armStats: {} })
}));

jest.mock('../src/algorithms/diversity', () => ({
  reRank: jest.fn((items) => items)
}));

const UserDNAProfile = require('../src/models/UserDNAProfile');
const ContentItem = require('../src/models/ContentItem');

// Simple test app setup
const express = require('express');
const personalizationRoutes = require('../src/routes/personalization');

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/personalize', personalizationRoutes);
  return app;
};

describe('Personalization API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/personalize/homepage', () => {
    it('should return 400 if userId is missing', async () => {
      const response = await request(app)
        .get('/api/personalize/homepage')
        .expect(400);

      expect(response.body.error).toBe('userId is required');
    });

    it('should return personalized homepage for valid userId', async () => {
      UserDNAProfile.findOrCreate.mockResolvedValue({
        userId: 'user-123',
        contentAffinityScores: [],
        brandPreferences: [],
        categoryInterests: [],
        behavioralPatterns: [],
        preferenceVector: [],
        diversityTolerance: 0.5,
        noveltySeeking: 0.5
      });

      ContentItem.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            itemId: 'item-1',
            title: 'Test Product',
            category: 'electronics',
            price: 99.99
          }
        ])
      });

      const response = await request(app)
        .get('/api/personalize/homepage')
        .query({ userId: 'user-123' })
        .expect(200);

      expect(response.body.userId).toBe('user-123');
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.personalized).toBe(true);
    });

    it('should use cached results when available', async () => {
      const cache = require('../src/utils/cache');
      const cachedResult = {
        userId: 'user-123',
        items: [{ itemId: 'cached-item' }],
        meta: { personalized: true }
      };
      cache.get.mockReturnValue(cachedResult);

      const response = await request(app)
        .get('/api/personalize/homepage')
        .query({ userId: 'user-123' })
        .expect(200);

      expect(response.body.items[0].itemId).toBe('cached-item');
    });

    it('should refresh cache when refresh=true', async () => {
      const cache = require('../src/utils/cache');

      UserDNAProfile.findOrCreate.mockResolvedValue({
        userId: 'user-123',
        contentAffinityScores: [],
        brandPreferences: [],
        categoryInterests: [],
        behavioralPatterns: [],
        preferenceVector: []
      });

      ContentItem.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      });

      await request(app)
        .get('/api/personalize/homepage')
        .query({ userId: 'user-123', refresh: 'true' })
        .expect(200);

      expect(cache.get).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/personalize/recommendations', () => {
    it('should return 400 if userId is missing', async () => {
      const response = await request(app)
        .get('/api/personalize/recommendations')
        .expect(400);

      expect(response.body.error).toBe('userId is required');
    });

    it('should return 400 for invalid recommendation type', async () => {
      const response = await request(app)
        .get('/api/personalize/recommendations')
        .query({ userId: 'user-123', type: 'invalid_type' })
        .expect(400);

      expect(response.body.error).toBe('Invalid recommendation type');
    });

    it('should return recommendations for valid request', async () => {
      UserDNAProfile.findOrCreate.mockResolvedValue({
        userId: 'user-123',
        contentAffinityScores: [],
        brandPreferences: [],
        categoryInterests: [],
        behavioralPatterns: [],
        preferenceVector: []
      });

      ContentItem.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          { itemId: 'item-1', title: 'Product 1', category: 'electronics' }
        ])
      });

      const response = await request(app)
        .get('/api/personalize/recommendations')
        .query({ userId: 'user-123', type: 'for_you' })
        .expect(200);

      expect(response.body.userId).toBe('user-123');
      expect(response.body.type).toBe('for_you');
      expect(response.body.meta).toBeDefined();
    });
  });

  describe('POST /api/personalize/interaction', () => {
    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/personalize/interaction')
        .send({ userId: 'user-123' })
        .expect(400);

      expect(response.body.error).toBe('userId, itemId, and type are required');
    });

    it('should return 400 for invalid interaction type', async () => {
      const response = await request(app)
        .post('/api/personalize/interaction')
        .send({
          userId: 'user-123',
          itemId: 'item-123',
          type: 'invalid_type'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid interaction type');
    });

    it('should record valid interaction', async () => {
      const response = await request(app)
        .post('/api/personalize/interaction')
        .send({
          userId: 'user-123',
          itemId: 'item-123',
          type: 'view',
          value: 1
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.interaction).toBeDefined();
    });
  });

  describe('GET /api/personalize/user/:userId', () => {
    it('should return user profile', async () => {
      const mockProfile = {
        userId: 'user-123',
        contentAffinityScores: [{ category: 'electronics', score: 0.8 }],
        brandPreferences: [],
        categoryInterests: []
      };

      UserDNAProfile.findOne.mockResolvedValue(mockProfile);

      const response = await request(app)
        .get('/api/personalize/user/user-123')
        .expect(200);

      expect(response.body.userId).toBe('user-123');
      expect(response.body.profile).toBeDefined();
    });

    it('should return 404 for non-existent user', async () => {
      UserDNAProfile.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/personalize/user/unknown-user')
        .expect(404);

      expect(response.body.error).toBe('Profile not found');
    });
  });

  describe('GET /api/personalize/stats', () => {
    it('should return engine statistics', async () => {
      const response = await request(app)
        .get('/api/personalize/stats')
        .expect(200);

      expect(response.body.cache).toBeDefined();
      expect(response.body.banditStats).toBeDefined();
      expect(response.body.weights).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });
  });

  describe('DELETE /api/personalize/cache', () => {
    it('should clear all cache when no pattern specified', async () => {
      const cache = require('../src/utils/cache');

      const response = await request(app)
        .delete('/api/personalize/cache')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(cache.flush).toHaveBeenCalled();
    });

    it('should clear cache matching pattern', async () => {
      const cache = require('../src/utils/cache');

      const response = await request(app)
        .delete('/api/personalize/cache')
        .query({ pattern: 'homepage:user-123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(cache.delPattern).toHaveBeenCalledWith('homepage:user-123');
    });
  });
});
