// Mock logger to prevent console output during tests
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock mongoose
jest.mock('mongoose', () => {
  return {
    connect: jest.fn(),
    connection: {
      readyState: 1,
      on: jest.fn(),
      close: jest.fn()
    },
    Schema: jest.requireActual('mongoose').Schema,
    model: jest.fn().mockReturnValue({
      find: jest.fn(),
      findOne: jest.fn(),
      aggregate: jest.fn()
    })
  };
});

describe('ContentBasedFiltering', () => {
  let contentBasedFiltering;

  beforeEach(() => {
    jest.resetModules();
    contentBasedFiltering = require('../src/algorithms/contentBasedFiltering');
  });

  describe('extractFeatureVector', () => {
    it('should extract feature vector from item', () => {
      const item = {
        category: 'electronics',
        brandId: 'brand-1',
        features: {
          price_tier: 2,
          quality_tier: 3,
          popularity: 500,
          engagement_rate: 0.7
        },
        createdAt: new Date()
      };

      const vector = contentBasedFiltering.extractFeatureVector(item);

      expect(vector).toHaveLength(8);
      expect(vector[2]).toBe(0.5); // price_tier normalized
      expect(vector[3]).toBe(0.75); // quality_tier normalized
    });

    it('should handle missing features', () => {
      const item = {
        category: 'test',
        createdAt: new Date()
      };

      const vector = contentBasedFiltering.extractFeatureVector(item);

      expect(vector).toHaveLength(8);
      expect(vector[2]).toBe(0.5); // default price_tier
      expect(vector[3]).toBe(0.5); // default quality_tier
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const a = [1, 0, 1];
      const b = [1, 0, 1];

      const similarity = contentBasedFiltering.cosineSimilarity(a, b);

      expect(similarity).toBe(1);
    });

    it('should return 0 for empty vectors', () => {
      const similarity = contentBasedFiltering.cosineSimilarity([], []);

      expect(similarity).toBe(0);
    });

    it('should handle orthogonal vectors', () => {
      const a = [1, 0];
      const b = [0, 1];

      const similarity = contentBasedFiltering.cosineSimilarity(a, b);

      expect(similarity).toBe(0);
    });
  });

  describe('hashString', () => {
    it('should return consistent hash for same string', () => {
      const hash1 = contentBasedFiltering.hashString('test');
      const hash2 = contentBasedFiltering.hashString('test');

      expect(hash1).toBe(hash2);
    });

    it('should return 0 for empty string', () => {
      const hash = contentBasedFiltering.hashString('');

      expect(hash).toBe(0);
    });
  });

  describe('calculateTagSimilarity', () => {
    it('should return 0.5 for no tag preferences', () => {
      const userProfile = { preferredTags: {} };

      const score = contentBasedFiltering.calculateTagSimilarity(['tag1', 'tag2'], userProfile);

      expect(score).toBe(0.5);
    });

    it('should calculate tag similarity', () => {
      const userProfile = {
        preferredTags: {
          tag1: 0.8,
          tag2: 0.6
        }
      };

      const score = contentBasedFiltering.calculateTagSimilarity(['tag1', 'tag3'], userProfile);

      expect(score).toBe(0.7); // (0.8 + 0) / 2
    });
  });
});

describe('ContextualBandits', () => {
  let bandits;

  beforeEach(() => {
    jest.resetModules();
    bandits = require('../src/algorithms/contextualBandits');
  });

  describe('initArm', () => {
    it('should initialize arm statistics', () => {
      const stats = bandits.initArm('test-arm');

      expect(stats.count).toBe(0);
      expect(stats.totalReward).toBe(0);
      expect(stats.avgReward).toBe(0);
      expect(stats.rewards).toEqual([]);
    });

    it('should return existing arm statistics', () => {
      bandits.initArm('existing-arm');
      bandits.armStats.get('existing-arm').count = 5;

      const stats = bandits.initArm('existing-arm');

      expect(stats.count).toBe(5);
    });
  });

  describe('updateArm', () => {
    it('should update arm statistics with reward', () => {
      bandits.initArm('arm-1');
      bandits.updateArm('arm-1', 0.8);

      const stats = bandits.armStats.get('arm-1');

      expect(stats.count).toBe(1);
      expect(stats.totalReward).toBe(0.8);
      expect(stats.avgReward).toBe(0.8);
      expect(stats.rewards).toContain(0.8);
    });

    it('should update multiple rewards correctly', () => {
      bandits.initArm('arm-2');
      bandits.updateArm('arm-2', 0.6);
      bandits.updateArm('arm-2', 0.9);

      const stats = bandits.armStats.get('arm-2');

      expect(stats.count).toBe(2);
      expect(stats.avgReward).toBe(0.75);
    });
  });

  describe('calculateUCB', () => {
    it('should return Infinity for unseen arm', () => {
      bandits.initArm('unseen-arm');

      const ucb = bandits.calculateUCB(bandits.armStats.get('unseen-arm'), {});

      expect(ucb).toBe(Infinity);
    });

    it('should calculate UCB for observed arm', () => {
      bandits.initArm('observed-arm');
      bandits.updateArm('observed-arm', 0.7);
      bandits.updateArm('observed-arm', 0.8);

      const stats = bandits.armStats.get('observed-arm');
      const ucb = bandits.calculateUCB(stats, {});

      expect(ucb).toBeGreaterThan(0.75);
    });
  });

  describe('selectArmEpsilonGreedy', () => {
    it('should return an arm from available arms', () => {
      bandits.initArm('arm-a');
      bandits.initArm('arm-b');
      bandits.initArm('arm-c');

      const result = bandits.selectArmEpsilonGreedy({}, ['arm-a', 'arm-b', 'arm-c']);

      expect(['arm-a', 'arm-b', 'arm-c']).toContain(result.armId);
      expect(result).toHaveProperty('explore');
    });
  });

  describe('getTotalPulls', () => {
    it('should return 0 for no arms', () => {
      bandits.armStats.clear();

      expect(bandits.getTotalPulls()).toBe(0);
    });

    it('should return sum of all arm pulls', () => {
      bandits.armStats.clear();
      bandits.initArm('arm-1');
      bandits.initArm('arm-2');
      bandits.updateArm('arm-1', 0.5);
      bandits.updateArm('arm-1', 0.6);
      bandits.updateArm('arm-2', 0.7);

      expect(bandits.getTotalPulls()).toBe(3);
    });
  });

  describe('buildContext', () => {
    it('should build context with default values', () => {
      const context = bandits.buildContext({});

      expect(context).toHaveProperty('time_of_day');
      expect(context).toHaveProperty('day_of_week');
      expect(context).toHaveProperty('device_type');
      expect(context).toHaveProperty('location');
      expect(context).toHaveProperty('engagement_level');
    });

    it('should include provided context values', () => {
      const context = bandits.buildContext({
        deviceType: 'mobile',
        location: 'US',
        engagementLevel: 0.8
      });

      expect(context.device_type).toBe('mobile');
      expect(context.location).toBe('US');
      expect(context.engagement_level).toBe(0.8);
    });
  });

  describe('toJSON and fromJSON', () => {
    it('should serialize and deserialize state', () => {
      bandits.initArm('arm-1');
      bandits.updateArm('arm-1', 0.7);
      bandits.updateArm('arm-1', 0.9);

      const json = bandits.toJSON();

      expect(json.armStats['arm-1']).toBeDefined();
      expect(json.options).toBeDefined();

      // Reset and restore
      bandits.armStats.clear();
      bandits.fromJSON(json);

      const restored = bandits.armStats.get('arm-1');
      expect(restored.count).toBe(2);
      expect(restored.totalReward).toBe(1.6);
    });
  });
});

describe('DiversityManager', () => {
  let diversity;

  beforeEach(() => {
    jest.resetModules();
    diversity = require('../src/algorithms/diversity');
  });

  describe('groupByCategory', () => {
    it('should group items by category', () => {
      const items = [
        { itemId: '1', category: 'electronics' },
        { itemId: '2', category: 'clothing' },
        { itemId: '3', category: 'electronics' }
      ];

      const groups = diversity.groupByCategory(items);

      expect(groups.get('electronics')).toHaveLength(2);
      expect(groups.get('clothing')).toHaveLength(1);
    });

    it('should handle uncategorized items', () => {
      const items = [
        { itemId: '1' },
        { itemId: '2', category: 'electronics' }
      ];

      const groups = diversity.groupByCategory(items);

      expect(groups.get('uncategorized')).toHaveLength(1);
    });
  });

  describe('calculateCategoryProportions', () => {
    it('should calculate proportions correctly', () => {
      const items = [
        { itemId: '1', category: 'A' },
        { itemId: '2', category: 'A' },
        { itemId: '3', category: 'B' },
        { itemId: '4', category: 'C' }
      ];
      const groups = diversity.groupByCategory(items);

      const proportions = diversity.calculateCategoryProportions(items, groups);

      expect(proportions.A.proportion).toBe(0.5);
      expect(proportions.B.proportion).toBe(0.25);
      expect(proportions.C.proportion).toBe(0.25);
    });
  });

  describe('identifyViolations', () => {
    it('should identify categories exceeding max ratio', () => {
      const proportions = {
        A: { count: 7, proportion: 0.7 },
        B: { count: 3, proportion: 0.3 }
      };

      const violations = diversity.identifyViolations(proportions);

      expect(violations).toHaveLength(1);
      expect(violations[0].category).toBe('A');
      expect(violations[0].excess).toBe(0.1);
    });

    it('should return empty array when no violations', () => {
      const proportions = {
        A: { count: 3, proportion: 0.3 },
        B: { count: 3, proportion: 0.3 },
        C: { count: 4, proportion: 0.4 }
      };

      const violations = diversity.identifyViolations(proportions);

      expect(violations).toHaveLength(0);
    });
  });

  describe('applyNoveltyFilter', () => {
    it('should return full novelty for no interaction history', () => {
      const items = [
        { itemId: '1', category: 'A' },
        { itemId: '2', category: 'B' }
      ];

      const result = diversity.applyNoveltyFilter(items, 'user-123', []);

      expect(result[0].noveltyScore).toBe(1);
      expect(result[1].noveltyScore).toBe(1);
    });

    it('should penalize seen items', () => {
      const items = [
        { itemId: '1', category: 'A' },
        { itemId: '2', category: 'B' }
      ];
      const history = [
        { itemId: '1', category: 'A' }
      ];

      const result = diversity.applyNoveltyFilter(items, 'user-123', history);

      expect(result[0].noveltyScore).toBeLessThan(1);
      expect(result[1].noveltyScore).toBe(1);
    });
  });

  describe('ensureCategorySpread', () => {
    it('should not modify items with sufficient spread', () => {
      const items = [
        { itemId: '1', category: 'A' },
        { itemId: '2', category: 'B' },
        { itemId: '3', category: 'C' }
      ];

      const result = diversity.ensureCategorySpread(items, 3);

      expect(result).toHaveLength(3);
    });
  });
});
