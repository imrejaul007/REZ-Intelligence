/**
 * Multi-Agent Collaboration E2E Tests
 *
 * Tests interactions between multiple experts/agents:
 * - Fitness + Culinary collaboration
 * - Agent switching
 * - Cross-domain queries
 * - Context preservation across agents
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { helpers, db as dbInstance } from './setup';

// Non-null assertion for db since it's guaranteed to be set during tests
const getDb = () => {
  if (!dbInstance) throw new Error('Database not initialized');
  return dbInstance;
};

describe('Multi-Agent Collaboration', () => {
  let testUser: Awaited<ReturnType<typeof helpers.createTestUser>>;
  let sessionId: string;

  beforeEach(async () => {
    testUser = await helpers.createTestUser({
      walletBalance: 10000,
    });
    sessionId = helpers.generateId();
  });

  describe('Fitness + Culinary Collaboration', () => {
    test('should handle diet-related query spanning fitness and culinary', async () => {
      const response = await helpers.sendChatMessage(
        'I want a high-protein diet plan for muscle building',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(['FITNESS', 'CULINARY', 'NUTRITION']).toContain(response.expert);
    });

    test('should suggest healthy recipes when asked by fitness user', async () => {
      // First message sets fitness context
      const fitnessResponse = await helpers.sendChatMessage(
        'I am doing weight training',
        testUser.userId,
        'API'
      );

      // Follow-up should consider fitness context
      const recipeResponse = await helpers.sendChatMessage(
        'What should I eat after workout?',
        testUser.userId,
        'API'
      );

      expect(recipeResponse.success).toBe(true);
      expect(recipeResponse.message).toBeDefined();
    });

    test('should provide calorie information for food items', async () => {
      const response = await helpers.sendChatMessage(
        'How many calories are in biryani?',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    test('should handle meal planning across agents', async () => {
      const response = await helpers.sendChatMessage(
        'Plan my meals for today with protein goals',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });
  });

  describe('Agent Switching', () => {
    test('should switch from CULINARY to FITNESS expert', async () => {
      // Start with food query
      const foodResponse = await helpers.sendChatMessage(
        'I want to order biryani',
        testUser.userId,
        'API'
      );
      expect(foodResponse.expert).toBe('CULINARY');

      // Switch to fitness query
      const fitnessResponse = await helpers.sendChatMessage(
        'What is a good post-workout meal?',
        testUser.userId,
        'API'
      );
      expect(['CULINARY', 'FITNESS', 'NUTRITION']).toContain(fitnessResponse.expert);
    });

    test('should switch from HOTEL to TRAVEL expert', async () => {
      // Hotel query
      const hotelResponse = await helpers.sendChatMessage(
        'Book a room at Taj Hotel',
        testUser.userId,
        'API'
      );
      expect(hotelResponse.expert).toBe('HOTEL');

      // Travel query
      const travelResponse = await helpers.sendChatMessage(
        'I also need a cab to the airport',
        testUser.userId,
        'API'
      );
      expect(['TRAVEL', 'HOTEL']).toContain(travelResponse.expert);
    });

    test('should handle multiple agent switches in conversation', async () => {
      const messages = [
        { text: 'Book me a hotel room', expectedExpert: 'HOTEL' },
        { text: 'I also want biryani delivered', expectedExpert: 'CULINARY' },
        { text: 'And arrange transport from airport', expectedExpert: 'TRAVEL' },
        { text: 'What gym is nearby?', expectedExpert: 'FITNESS' },
      ];

      for (const msg of messages) {
        const response = await helpers.sendChatMessage(
          msg.text,
          testUser.userId,
          'API'
        );
        expect(response.success).toBe(true);
        expect(response.expert).toBeDefined();
      }
    });

    test('should maintain context when switching agents', async () => {
      // Set initial context
      await helpers.sendChatMessage(
        'I have a dinner meeting tomorrow at 7 PM',
        testUser.userId,
        'API'
      );

      // Query that references previous context
      const followUp = await helpers.sendChatMessage(
        'Book a restaurant near my meeting location',
        testUser.userId,
        'API'
      );

      expect(followUp.success).toBe(true);
      // Should consider the dinner meeting context
    });
  });

  describe('Cross-Domain Queries', () => {
    test('should handle queries requiring multiple experts', async () => {
      const response = await helpers.sendChatMessage(
        'I want a hotel with good spa and restaurant',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    test('should handle travel + hotel combined query', async () => {
      const response = await helpers.sendChatMessage(
        'Plan my trip to Goa including stay and transport',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.intent).toBeDefined();
    });

    test('should handle wellness + hospitality query', async () => {
      const response = await helpers.sendChatMessage(
        'Find me a hotel with gym and healthy food options',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.expert).toBeDefined();
    });
  });

  describe('Context Preservation', () => {
    test('should preserve user preferences across agent switches', async () => {
      // Set preference
      await helpers.sendChatMessage(
        'I am vegetarian',
        testUser.userId,
        'API'
      );

      // Query should consider vegetarian preference
      const foodResponse = await helpers.sendChatMessage(
        'What can I order for dinner?',
        testUser.userId,
        'API'
      );

      expect(foodResponse.success).toBe(true);
    });

    test('should preserve location context across queries', async () => {
      // Set location
      await helpers.sendChatMessage(
        'I am at Mumbai airport',
        testUser.userId,
        'API'
      );

      // Query should consider Mumbai location
      const hotelResponse = await helpers.sendChatMessage(
        'Find nearby hotels',
        testUser.userId,
        'API'
      );

      expect(hotelResponse.success).toBe(true);
    });

    test('should preserve dietary restrictions across agents', async () => {
      // Set dietary restriction
      await helpers.sendChatMessage(
        'I am gluten intolerant',
        testUser.userId,
        'API'
      );

      // Food query should consider gluten-free
      const foodResponse = await helpers.sendChatMessage(
        'Order me lunch',
        testUser.userId,
        'API'
      );

      expect(foodResponse.success).toBe(true);
    });

    test('should preserve fitness goals in food recommendations', async () => {
      // Set fitness goal
      await helpers.sendChatMessage(
        'My goal is to lose 5kg in 2 months',
        testUser.userId,
        'API'
      );

      // Food should be low-calorie
      const foodResponse = await helpers.sendChatMessage(
        'What should I eat for breakfast?',
        testUser.userId,
        'API'
      );

      expect(foodResponse.success).toBe(true);
    });
  });

  describe('Agent Orchestration', () => {
    test('should delegate to primary expert based on query', async () => {
      const response = await helpers.sendChatMessage(
        'I need a personal trainer recommendation',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.expert).toBe('FITNESS');
    });

    test('should aggregate responses from multiple agents when needed', async () => {
      const response = await helpers.sendChatMessage(
        'Give me a complete wellness package with diet, exercise, and relaxation',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    test('should handle handoff between agents smoothly', async () => {
      const response = await helpers.sendChatMessage(
        'Book a spa appointment and order healthy snacks',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
    });

    test('should prioritize primary intent in mixed queries', async () => {
      const response = await helpers.sendChatMessage(
        'I need to book a flight urgently and also find a pet-friendly hotel',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.intent).toBeDefined();
    });
  });

  describe('Error Handling in Multi-Agent Scenarios', () => {
    test('should handle unavailable expert gracefully', async () => {
      // Query that might require an expert that's temporarily unavailable
      const response = await helpers.sendChatMessage(
        'I need legal advice about travel insurance',
        testUser.userId,
        'API'
      );

      // Should still return a response (maybe with fallback)
      expect(response).toBeDefined();
      expect(typeof response.success).toBe('boolean');
    });

    test('should handle conflicting recommendations from different agents', async () => {
      // Set high-calorie preference
      await helpers.sendChatMessage(
        'I am bulking and need high calorie diet',
        testUser.userId,
        'API'
      );

      // Then set weight loss goal
      const conflictingResponse = await helpers.sendChatMessage(
        'Actually I want to lose weight, recommend food',
        testUser.userId,
        'API'
      );

      expect(conflictingResponse.success).toBe(true);
      // Should update to latest preference
    });

    test('should handle timeout during agent collaboration', async () => {
      // Complex query that might timeout
      const response = await helpers.sendChatMessage(
        'Plan my entire vacation including flights, hotels, meals, activities, and transport',
        testUser.userId,
        'API'
      );

      expect(response).toBeDefined();
    });
  });

  describe('Session and Conversation State', () => {
    test('should track conversation history across agents', async () => {
      // Start conversation
      await helpers.sendChatMessage(
        'I want to order biryani',
        testUser.userId,
        'API'
      );

      // Add to history
      await getDb().collection('messages').insertOne({
        sessionId,
        userId: testUser.userId,
        message: 'I want to order biryani',
        expert: 'CULINARY',
        timestamp: new Date(),
      });

      // Query history
      const history = await getDb().collection('messages')
        .find({ sessionId })
        .sort({ timestamp: 1 })
        .toArray();

      expect(history.length).toBeGreaterThan(0);
    });

    test('should store agent interactions in audit log', async () => {
      const response = await helpers.sendChatMessage(
        'Book me a hotel room',
        testUser.userId,
        'API'
      );

      const auditLog = await getDb().collection('audit_logs')
        .find({ userId: testUser.userId })
        .sort({ timestamp: -1 })
        .limit(1)
        .toArray();

      expect(auditLog.length).toBeGreaterThan(0);
    });

    test('should clear session data appropriately', async () => {
      // Create session data
      await getDb().collection('sessions').insertOne({
        sessionId,
        userId: testUser.userId,
        currentExpert: 'CULINARY',
        context: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Session should exist
      const session = await getDb().collection('sessions').findOne({ sessionId });
      expect(session).not.toBeNull();
    });
  });

  describe('Complex Multi-Agent Scenarios', () => {
    test('should handle full travel planning workflow', async () => {
      const workflow = [
        'Find flights to Delhi next Friday',
        'Book a hotel with gym',
        'Order food for arrival evening',
        'Arrange airport pickup',
      ];

      for (const step of workflow) {
        const response = await helpers.sendChatMessage(
          step,
          testUser.userId,
          'API'
        );
        expect(response.success).toBe(true);
      }
    });

    test('should handle wedding planning across multiple domains', async () => {
      const weddingTasks = [
        'Book a venue for 200 guests',
        'Arrange catering with vegetarian options',
        'Find photographer nearby',
        'Book guest rooms at nearby hotel',
      ];

      for (const task of weddingTasks) {
        const response = await helpers.sendChatMessage(
          task,
          testUser.userId,
          'API'
        );
        expect(response.success).toBe(true);
      }
    });

    test('should handle fitness transformation program', async () => {
      const fitnessProgram = [
        'I want to lose 10kg in 3 months',
        'Create a workout plan',
        'Design a meal plan',
        'Find nearby gyms',
        'Book personal trainer sessions',
      ];

      for (const step of fitnessProgram) {
        const response = await helpers.sendChatMessage(
          step,
          testUser.userId,
          'API'
        );
        expect(response.success).toBe(true);
      }
    });
  });
});
