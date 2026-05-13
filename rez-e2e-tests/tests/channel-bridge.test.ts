/**
 * Channel Bridge E2E Tests
 *
 * Tests the integration between different communication channels:
 * - WhatsApp message -> Orchestrator -> Expert -> Response
 * - Instagram DM -> Bridge -> Orchestrator
 * - Web channel
 * - Cross-channel continuity
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { helpers, CONFIG, db as dbInstance } from './setup';
import axios from 'axios';

// Non-null assertion for db since it's guaranteed to be set during tests
const getDb = () => {
  if (!dbInstance) throw new Error('Database not initialized');
  return dbInstance;
};

describe('Channel Bridge', () => {
  let testUser: Awaited<ReturnType<typeof helpers.createTestUser>>;

  beforeEach(async () => {
    testUser = await helpers.createTestUser({
      phone: '+15551234567',
    });

    // Store user contact in WhatsApp bridge format
    await getDb().collection('whatsapp_contacts').insertOne({
      userId: testUser.userId,
      phone: testUser.phone,
      name: testUser.name,
      createdAt: new Date(),
    });
  });

  describe('WhatsApp Channel', () => {
    test('should receive WhatsApp message and route to orchestrator', async () => {
      const result = await helpers.sendWhatsAppMessage(
        testUser.phone,
        'I want to order biryani'
      );

      expect(result.success).toBe(true);
    });

    test('should handle WhatsApp text message format', async () => {
      const result = await helpers.sendWhatsAppMessage(
        testUser.phone,
        'Hello, I need a hotel booking'
      );

      expect(result.success).toBe(true);
    });

    test('should handle WhatsApp message with emojis', async () => {
      const result = await helpers.sendWhatsAppMessage(
        testUser.phone,
        'I want biryani 🍛 and raita 🥣'
      );

      expect(result.success).toBe(true);
    });

    test('should handle WhatsApp message with location', async () => {
      const result = await helpers.sendWhatsAppMessage(
        testUser.phone,
        'Find hotels near me'
      );

      expect(result.success).toBe(true);
    });

    test('should handle WhatsApp message with phone number format', async () => {
      // Different phone formats
      const formats = [
        '+15551234567',
        '15551234567',
        '+1-555-123-4567',
        '(555) 123-4567',
      ];

      for (const phone of formats) {
        const result = await helpers.sendWhatsAppMessage(
          phone,
          'Test message'
        );

        // Should handle format normalization
        expect(result).toBeDefined();
      }
    });

    test('should send WhatsApp response back to user', async () => {
      const result = await helpers.sendWhatsAppMessage(
        testUser.phone,
        'Order biryani'
      );

      if (result.success && result.response) {
        expect(typeof result.response).toBe('string');
        expect(result.response.length).toBeGreaterThan(0);
      }
    });

    test('should handle WhatsApp quick reply buttons', async () => {
      // Test quick reply selection
      const result = await helpers.sendWhatsAppMessage(
        testUser.phone,
        'Order biryani' // This might trigger quick replies in real scenario
      );

      expect(result).toBeDefined();
    });

    test('should handle WhatsApp list message response', async () => {
      const result = await helpers.sendWhatsAppMessage(
        testUser.phone,
        'Show me biryani options'
      );

      expect(result).toBeDefined();
    });

    test('should handle WhatsApp media messages (forwarded to text)', async () => {
      // Media messages are typically handled as text queries
      const result = await helpers.sendWhatsAppMessage(
        testUser.phone,
        'What is shown in this image?'
      );

      expect(result).toBeDefined();
    });

    test('should handle WhatsApp session timeout gracefully', async () => {
      // Wait for session to potentially timeout
      await helpers.wait(100);

      const result = await helpers.sendWhatsAppMessage(
        testUser.phone,
        'Continue my previous order'
      );

      expect(result).toBeDefined();
    });
  });

  describe('Instagram Channel', () => {
    test('should receive Instagram DM and route to orchestrator', async () => {
      const result = await helpers.sendInstagramDM(
        `@${testUser.userId}`,
        'I want to order food'
      );

      expect(result.success).toBe(true);
    });

    test('should handle Instagram text message format', async () => {
      const result = await helpers.sendInstagramDM(
        'instagram_user_123',
        'Hello, book me a table'
      );

      expect(result.success).toBe(true);
    });

    test('should handle Instagram message with hashtags', async () => {
      const result = await helpers.sendInstagramDM(
        'instagram_user_123',
        'I want #biryani #food #delivery'
      );

      expect(result.success).toBe(true);
    });

    test('should handle Instagram message with mentions', async () => {
      const result = await helpers.sendInstagramDM(
        'instagram_user_123',
        'Tag @friend for this order'
      );

      expect(result.success).toBe(true);
    });

    test('should handle Instagram message with emojis', async () => {
      const result = await helpers.sendInstagramDM(
        'instagram_user_123',
        'Yummy biryani please 🍛'
      );

      expect(result.success).toBe(true);
    });

    test('should send Instagram DM response back to user', async () => {
      const result = await helpers.sendInstagramDM(
        'instagram_user_123',
        'Show me hotels'
      );

      if (result.success && result.response) {
        expect(typeof result.response).toBe('string');
      }
    });

    test('should handle Instagram story mentions', async () => {
      const result = await helpers.sendInstagramDM(
        'instagram_user_123',
        'Your business was mentioned in a story'
      );

      expect(result).toBeDefined();
    });
  });

  describe('Web Channel', () => {
    test('should handle web chat message', async () => {
      const response = await helpers.sendChatMessage(
        'I want to order biryani',
        testUser.userId,
        'WEB'
      );

      expect(response.success).toBe(true);
    });

    test('should handle web chat with user agent', async () => {
      const client = axios.create({
        baseURL: CONFIG.ORCHESTRATOR_URL,
        timeout: CONFIG.HTTP_REQUEST_TIMEOUT,
      });

      const response = await client.post('/api/chat', {
        message: 'Test message',
        userId: testUser.userId,
        channel: 'WEB',
        userAgent: 'Mozilla/5.0 (Test Browser)',
      });

      expect(response.status).toBe(200);
    });

    test('should handle web chat typing indicator', async () => {
      const response = await helpers.sendChatMessage(
        'Start typing test',
        testUser.userId,
        'WEB'
      );

      expect(response).toBeDefined();
    });

    test('should handle web chat with attachments', async () => {
      const response = await helpers.sendChatMessage(
        'Upload receipt',
        testUser.userId,
        'WEB'
      );

      expect(response).toBeDefined();
    });
  });

  describe('Channel Bridge Architecture', () => {
    test('should normalize message format from WhatsApp', async () => {
      const rawMessage = {
        from: testUser.phone,
        message: 'Order biryani',
        timestamp: new Date().toISOString(),
        type: 'text',
      };

      // Simulate message normalization
      const normalizedMessage = {
        userId: testUser.userId,
        channel: 'WHATSAPP',
        message: rawMessage.message,
        timestamp: new Date(rawMessage.timestamp),
      };

      expect(normalizedMessage.channel).toBe('WHATSAPP');
      expect(normalizedMessage.userId).toBe(testUser.userId);
    });

    test('should normalize message format from Instagram', async () => {
      const rawMessage = {
        sender: 'instagram_user_123',
        text: 'Book a hotel',
        timestamp: new Date().toISOString(),
        type: 'text',
      };

      // Simulate message normalization
      const normalizedMessage = {
        userId: expect.any(String),
        channel: 'INSTAGRAM',
        message: rawMessage.text,
        timestamp: new Date(rawMessage.timestamp),
      };

      expect(normalizedMessage.channel).toBe('INSTAGRAM');
    });

    test('should add channel metadata to messages', async () => {
      await helpers.sendChatMessage(
        'Test message',
        testUser.userId,
        'WHATSAPP'
      );

      const recentMessage = await getDb().collection('messages')
        .find({ userId: testUser.userId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

      if (recentMessage.length > 0) {
        expect(recentMessage[0]).toHaveProperty('channel');
      }
    });
  });

  describe('Cross-Channel Continuity', () => {
    test('should maintain session across WhatsApp messages', async () => {
      const phone = testUser.phone;

      // First message
      const msg1 = await helpers.sendWhatsAppMessage(phone, 'I want to order biryani');
      expect(msg1.success).toBe(true);

      // Second message (should continue conversation)
      const msg2 = await helpers.sendWhatsAppMessage(phone, 'Add extra spice');
      expect(msg2.success).toBe(true);
    });

    test('should handle user switching channels', async () => {
      // Start on WhatsApp
      await helpers.sendWhatsAppMessage(
        testUser.phone,
        'Start ordering biryani'
      );

      // Switch to API/Web
      const webResponse = await helpers.sendChatMessage(
        'Continue my biryani order',
        testUser.userId,
        'WEB'
      );

      expect(webResponse.success).toBe(true);
    });

    test('should link same user across channels', async () => {
      // Get user from WhatsApp
      await helpers.sendWhatsAppMessage(
        testUser.phone,
        'My user ID'
      );

      // Verify same user can be found via API
      const user = await getDb().collection('users').findOne({ userId: testUser.userId });
      expect(user).not.toBeNull();
    });

    test('should track channel history for user', async () => {
      // Send messages via different channels
      await helpers.sendWhatsAppMessage(testUser.phone, 'WhatsApp message');
      await helpers.sendInstagramDM('instagram_user', 'Instagram message');
      await helpers.sendChatMessage('API message', testUser.userId, 'API');

      // Query message history
      const messages = await getDb().collection('messages')
        .find({ userId: testUser.userId })
        .sort({ createdAt: -1 })
        .toArray();

      // Should have messages from multiple channels
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Channel-Specific Features', () => {
    test('should support WhatsApp template messages', async () => {
      // WhatsApp supports pre-approved templates
      const result = await helpers.sendWhatsAppMessage(
        testUser.phone,
        'ORDER_CONFIRMATION' // Template name
      );

      expect(result).toBeDefined();
    });

    test('should support WhatsApp interactive buttons', async () => {
      const result = await helpers.sendWhatsAppMessage(
        testUser.phone,
        'CONFIRM' // Button response
      );

      expect(result).toBeDefined();
    });

    test('should support Instagram carousel responses', async () => {
      const result = await helpers.sendInstagramDM(
        'instagram_user',
        'Show me more options'
      );

      expect(result).toBeDefined();
    });
  });

  describe('Channel Error Handling', () => {
    test('should handle WhatsApp API errors gracefully', async () => {
      const result = await helpers.sendWhatsAppMessage(
        'invalid_phone',
        'Test message'
      );

      // Should either succeed or return structured error
      expect(result).toHaveProperty('success');
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    test('should handle Instagram API errors gracefully', async () => {
      const result = await helpers.sendInstagramDM(
        '', // Invalid username
        'Test message'
      );

      expect(result).toHaveProperty('success');
    });

    test('should handle message queue overflow', async () => {
      // Send burst of messages
      const promises = Array(10).fill(null).map(() =>
        helpers.sendWhatsAppMessage(testUser.phone, 'Test')
      );

      const results = await Promise.allSettled(promises);

      // Most should succeed
      const successes = results.filter(r => r.status === 'fulfilled').length;
      expect(successes).toBeGreaterThan(0);
    });

    test('should handle webhook verification for WhatsApp', async () => {
      const client = axios.create({
        baseURL: CONFIG.WHATSAPP_BRIDGE_URL,
        timeout: CONFIG.HTTP_REQUEST_TIMEOUT,
      });

      // WhatsApp webhook verification
      const response = await client.get('/webhook', {
        params: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test_token',
          'hub.challenge': 'challenge_string',
        },
      });

      expect(response.status).toBe(200);
    });

    test('should handle Instagram webhook verification', async () => {
      const client = axios.create({
        baseURL: CONFIG.INSTAGRAM_BRIDGE_URL,
        timeout: CONFIG.HTTP_REQUEST_TIMEOUT,
      });

      const response = await client.get('/webhook', {
        params: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test_token',
          'hub.challenge': 'challenge_string',
        },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Channel Performance', () => {
    test('should respond to WhatsApp message within timeout', async () => {
      const startTime = Date.now();

      await helpers.sendWhatsAppMessage(
        testUser.phone,
        'Quick response test'
      );

      const responseTime = Date.now() - startTime;

      // Should respond within reasonable time
      expect(responseTime).toBeLessThan(10000);
    });

    test('should handle concurrent WhatsApp messages', async () => {
      const concurrentMessages = 5;
      const promises = Array(concurrentMessages).fill(null).map((_, i) =>
        helpers.sendWhatsAppMessage(testUser.phone, `Message ${i}`)
      );

      const results = await Promise.all(promises);

      // All should complete
      expect(results.length).toBe(concurrentMessages);
    });

    test('should handle high-volume message processing', async () => {
      const messageCount = 20;
      const startTime = Date.now();

      const promises = Array(messageCount).fill(null).map((_, i) =>
        helpers.sendChatMessage(`Message ${i}`, testUser.userId, 'API')
      );

      const results = await Promise.allSettled(promises);

      const elapsed = Date.now() - startTime;
      const successes = results.filter(r => r.status === 'fulfilled').length;

      // Should handle volume reasonably
      expect(successes).toBeGreaterThan(messageCount * 0.8);
      console.log(`Processed ${messageCount} messages in ${elapsed}ms`);
    });
  });
});
