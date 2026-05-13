/**
 * Message Flow E2E Tests
 *
 * Tests the complete message routing flow:
 * - Message sent via orchestrator
 * - Intent detection
 * - Expert routing
 * - Response generation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { helpers, CONFIG } from './setup';

describe('Message Flow', () => {
  let testUser: ReturnType<typeof helpers.createTestUser> extends Promise<infer T> ? T : never;

  beforeEach(async () => {
    testUser = await helpers.createTestUser();
  });

  describe('Intent Detection', () => {
    test('should detect ORDER_FOOD intent from biryani message', async () => {
      const response = await helpers.sendChatMessage(
        'I want to order biryani',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.intent).toBe('ORDER_FOOD');
      expect(response.expert).toBe('CULINARY');
    });

    test('should detect BOOK_HOTEL intent from hotel message', async () => {
      const response = await helpers.sendChatMessage(
        'I need to book a hotel room',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.intent).toBe('BOOK_HOTEL');
      expect(response.expert).toBe('HOTEL');
    });

    test('should detect SEARCH_FLIGHT intent', async () => {
      const response = await helpers.sendChatMessage(
        'Find flights to Mumbai',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.intent).toBe('SEARCH_FLIGHT');
      expect(response.expert).toBe('TRAVEL');
    });

    test('should detect CHECK_BALANCE intent', async () => {
      const response = await helpers.sendChatMessage(
        'What is my wallet balance?',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.intent).toBe('CHECK_BALANCE');
      expect(response.expert).toBe('WALLET');
    });

    test('should detect MAKE_PAYMENT intent', async () => {
      const response = await helpers.sendChatMessage(
        'I need to pay for my order',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.intent).toBe('MAKE_PAYMENT');
      expect(response.expert).toBe('PAYMENT');
    });

    test('should handle ambiguous messages with fallback intent', async () => {
      const response = await helpers.sendChatMessage(
        'Hello there',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.intent).toBeDefined();
      expect(['GREETING', 'GENERAL_QUERY', 'UNKNOWN']).toContain(response.intent);
    });

    test('should handle misspelled words in message', async () => {
      const response = await helpers.sendChatMessage(
        'I want to oder biryani', // 'oder' instead of 'order'
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.intent).toBe('ORDER_FOOD');
    });

    test('should handle mixed language message', async () => {
      const response = await helpers.sendChatMessage(
        'Mujhe biryani order karna hai',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.intent).toBeDefined();
      expect(response.expert).toBeDefined();
    });
  });

  describe('Expert Routing', () => {
    test('should route food messages to CULINARY expert', async () => {
      const response = await helpers.sendChatMessage(
        'What dishes do you recommend?',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.expert).toBe('CULINARY');
    });

    test('should route hotel messages to HOTEL expert', async () => {
      const response = await helpers.sendChatMessage(
        'I need a room near the beach',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.expert).toBe('HOTEL');
    });

    test('should route fitness messages to FITNESS expert', async () => {
      const response = await helpers.sendChatMessage(
        'Give me a workout plan for weight loss',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.expert).toBe('FITNESS');
    });

    test('should route travel messages to TRAVEL expert', async () => {
      const response = await helpers.sendChatMessage(
        'Book me a cab to the airport',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(true);
      expect(response.expert).toBe('TRAVEL');
    });
  });

  describe('Session Management', () => {
    test('should create new session on first message', async () => {
      const response = await helpers.sendChatMessage(
        'Hello',
        testUser.userId,
        'API'
      );

      expect(response.sessionId).toBeDefined();
      expect(response.sessionId.length).toBeGreaterThan(0);
    });

    test('should maintain session across multiple messages', async () => {
      const response1 = await helpers.sendChatMessage(
        'I want biryani',
        testUser.userId,
        'API'
      );

      const response2 = await helpers.sendChatMessage(
        'Add extra spice please',
        testUser.userId,
        'API'
      );

      expect(response1.sessionId).toBeDefined();
      expect(response2.sessionId).toBeDefined();
    });

    test('should include session ID in response', async () => {
      const response = await helpers.sendChatMessage(
        'Hello',
        testUser.userId,
        'API'
      );

      expect(response).toHaveProperty('sessionId');
    });
  });

  describe('Channel Handling', () => {
    test('should handle WHATSAPP channel', async () => {
      const response = await helpers.sendChatMessage(
        'Order biryani',
        testUser.userId,
        'WHATSAPP'
      );

      expect(response.success).toBe(true);
    });

    test('should handle INSTAGRAM channel', async () => {
      const response = await helpers.sendChatMessage(
        'Order biryani',
        testUser.userId,
        'INSTAGRAM'
      );

      expect(response.success).toBe(true);
    });

    test('should handle WEB channel', async () => {
      const response = await helpers.sendChatMessage(
        'Order biryani',
        testUser.userId,
        'WEB'
      );

      expect(response.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty message gracefully', async () => {
      const response = await helpers.sendChatMessage(
        '',
        testUser.userId,
        'API'
      );

      expect(response.success).toBe(false);
      expect(response.message).toBeDefined();
    });

    test('should handle invalid user ID', async () => {
      await expect(
        helpers.sendChatMessage('Hello', 'invalid_user_123', 'API')
      ).rejects.toThrow();
    });

    test('should handle service timeout gracefully', async () => {
      // Send message that might cause timeout
      const response = await helpers.sendChatMessage(
        'Test timeout handling',
        testUser.userId,
        'API'
      );

      // Even if service is slow, should return a response
      expect(response).toBeDefined();
    });
  });

  describe('Response Format', () => {
    test('should return proper response structure', async () => {
      const response = await helpers.sendChatMessage(
        'I want to order food',
        testUser.userId,
        'API'
      );

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('intent');
      expect(response).toHaveProperty('expert');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('sessionId');
    });

    test('should include data field when applicable', async () => {
      const response = await helpers.sendChatMessage(
        'What is my wallet balance?',
        testUser.userId,
        'API'
      );

      // Balance query should include data
      if (response.intent === 'CHECK_BALANCE') {
        expect(response.data).toBeDefined();
      }
    });
  });

  describe('Multi-turn Conversation', () => {
    test('should handle order flow with multiple turns', async () => {
      // Turn 1: Initial request
      const response1 = await helpers.sendChatMessage(
        'I want to order biryani',
        testUser.userId,
        'API'
      );
      expect(response1.success).toBe(true);

      // Turn 2: Follow-up with quantity
      const response2 = await helpers.sendChatMessage(
        'I want 2 plates',
        testUser.userId,
        'API'
      );
      expect(response2.success).toBe(true);

      // Turn 3: Confirmation
      const response3 = await helpers.sendChatMessage(
        'Yes, please confirm the order',
        testUser.userId,
        'API'
      );
      expect(response3.success).toBe(true);
    });

    test('should handle cancellation mid-flow', async () => {
      // Turn 1: Initial request
      const response1 = await helpers.sendChatMessage(
        'I want to order biryani',
        testUser.userId,
        'API'
      );
      expect(response1.success).toBe(true);

      // Turn 2: Cancellation
      const response2 = await helpers.sendChatMessage(
        'Cancel this order',
        testUser.userId,
        'API'
      );
      expect(response2.success).toBe(true);
      expect(response2.intent).toBe('CANCEL_ORDER');
    });
  });
});
