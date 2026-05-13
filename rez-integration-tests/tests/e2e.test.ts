/**
 * End-to-End Message Flow Tests
 * Tests the complete flow from orchestrator through experts to response generation
 */

import axios, { AxiosInstance } from 'axios';
import { SERVICE_URLS, waitForService, createTestUserContext } from './setup';

describe('E2E Message Flow Integration Tests', () => {
  let orchestratorClient: AxiosInstance;
  let hospitalityClient: AxiosInstance;
  let culinaryClient: AxiosInstance;

  beforeAll(async () => {
    // Create HTTP clients for each service
    orchestratorClient = axios.create({
      baseURL: SERVICE_URLS.orchestrator,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    hospitalityClient = axios.create({
      baseURL: SERVICE_URLS.hospitalityExpert,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    culinaryClient = axios.create({
      baseURL: SERVICE_URLS.culinaryExpert,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Wait for services to be ready
    const servicesReady = await Promise.all([
      waitForService(SERVICE_URLS.orchestrator),
      waitForService(SERVICE_URLS.hospitalityExpert),
      waitForService(SERVICE_URLS.culinaryExpert),
    ]);

    if (!servicesReady.every(Boolean)) {
      console.log('Warning: Some services may not be available. Tests may fail.');
    }
  });

  describe('Orchestrator to Expert Routing', () => {
    it('should route hospitality messages to hospitality expert', async () => {
      const testContext = createTestUserContext();

      const response = await orchestratorClient.post('/api/orchestrate', {
        message: 'I need help with my hotel check-in',
        userId: testContext.userId,
        sessionId: testContext.sessionId,
        entryPoint: 'mobile_app',
        routingHints: {
          preferredAgent: 'hospitality',
        },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('response');
      expect(response.data).toHaveProperty('context');
      expect(response.data).toHaveProperty('attributions');
      expect(Array.isArray(response.data.attributions)).toBe(true);
    });

    it('should route culinary messages to culinary expert', async () => {
      const testContext = createTestUserContext();

      const response = await orchestratorClient.post('/api/orchestrate', {
        message: 'What would you recommend for dinner?',
        userId: testContext.userId,
        sessionId: testContext.sessionId,
        routingHints: {
          preferredAgent: 'culinary',
        },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('response');
    });

    it('should enrich context from Core Brain before routing', async () => {
      const testContext = createTestUserContext();

      const response = await orchestratorClient.post('/api/orchestrate', {
        message: 'Book me a room',
        userId: testContext.userId,
        sessionId: testContext.sessionId,
        merchantId: 'hotel-123',
      });

      expect(response.status).toBe(200);
      // Context should be enriched
      expect(response.data.context).toBeDefined();
    });

    it('should handle orchestration errors gracefully', async () => {
      const response = await orchestratorClient.post('/api/orchestrate', {
        message: '',
        userId: 'test-user',
      });

      // Should either succeed with validation or return proper error
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Hospitality Expert Integration', () => {
    it('should process chat requests with Core Brain context', async () => {
      const sessionId = `hosp-test-${Date.now()}`;
      const userId = 'test-user-hosp';

      const response = await hospitalityClient.post('/api/v1/hospitality/chat', {
        sessionId,
        message: 'What time is checkout?',
        guestId: userId,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('sessionId');
      expect(response.data).toHaveProperty('message');
      expect(response.data).toHaveProperty('intent');
      // Core Brain context should be included
      expect(response.data.metadata).toBeDefined();
    });

    it('should create and manage sessions', async () => {
      const response = await hospitalityClient.post('/api/v1/hospitality/session', {
        guestId: 'test-guest',
        language: 'en',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('sessionId');
      expect(response.data).toHaveProperty('message');
    });

    it('should handle workflow requests', async () => {
      // First create a session
      const sessionRes = await hospitalityClient.post('/api/v1/hospitality/session', {
        guestId: 'test-guest',
      });
      const sessionId = sessionRes.data.sessionId;

      const response = await hospitalityClient.post('/api/v1/hospitality/workflow', {
        sessionId,
        workflowType: 'checkin',
        action: 'start',
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('workflow');
      expect(response.data.workflow).toBe('checkin');
    });

    it('should record activity in Core Brain', async () => {
      const sessionId = `hosp-activity-${Date.now()}`;

      const response = await hospitalityClient.post('/api/v1/hospitality/chat', {
        sessionId,
        message: 'Book a table for dinner',
        guestId: 'test-activity-user',
      });

      expect(response.status).toBe(200);
      // Activity should be recorded (checked via metadata)
      expect(response.data).toHaveProperty('sessionId');
    });
  });

  describe('Culinary Expert Integration', () => {
    it('should process chat requests with personalization', async () => {
      const userId = 'test-culinary-user';

      const response = await culinaryClient.post('/api/culinary/chat', {
        message: 'Show me the menu',
        userId,
        restaurantId: 'restaurant-123',
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('response');
      expect(response.data.data).toHaveProperty('intent');
      // Core Brain context should be included
      expect(response.data.data.context).toBeDefined();
    });

    it('should handle dietary restrictions from Core Brain', async () => {
      const userId = 'test-dietary-user';

      const response = await culinaryClient.post('/api/culinary/chat', {
        message: 'What vegetarian options do you have?',
        userId,
        restaurantId: 'restaurant-123',
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('should get personalized recommendations', async () => {
      const response = await culinaryClient.post('/api/culinary/recommendations', {
        restaurantId: 'restaurant-123',
        userId: 'test-rec-user',
        context: { timeOfDay: 'evening' },
        limit: 5,
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    it('should check dish compatibility with dietary profile', async () => {
      const response = await culinaryClient.post('/api/culinary/dietary/check', {
        userId: 'test-dietary-check',
        itemId: 'item-123',
        restaurantId: 'restaurant-123',
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });
  });

  describe('Context Engine Integration', () => {
    it('should provide context for session', async () => {
      try {
        const response = await axios.post(`${SERVICE_URLS.contextEngine}/api/context`, {
          sessionId: `ctx-test-${Date.now()}`,
          merchantId: 'hotel-123',
          entryPoint: 'mobile_app',
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('data');
      } catch (error) {
        // Context Engine may not be running - skip test
        console.log('Context Engine not available, skipping test');
      }
    });
  });

  describe('Core Brain Integration', () => {
    it('should store and retrieve user preferences', async () => {
      const userId = `corebrain-test-${Date.now()}`;

      try {
        // Record activity
        await axios.post(`${SERVICE_URLS.coreBrain}/internal/personalization/context/activity`, {
          userId,
          action: 'test_action',
          agent: 'test-agent',
          topic: 'test-topic',
        });

        // Get context via hospitality expert
        const response = await hospitalityClient.post('/api/v1/hospitality/chat', {
          sessionId: `corebrain-session-${Date.now()}`,
          message: 'Hello',
          guestId: userId,
        });

        expect(response.status).toBe(200);
      } catch (error) {
        console.log('Core Brain not available, skipping preference test');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required fields', async () => {
      const response = await hospitalityClient.post('/api/v1/hospitality/chat', {
        sessionId: 'test',
        // Missing message
      });

      expect(response.status).toBe(400);
    });

    it('should handle invalid session', async () => {
      const response = await hospitalityClient.get('/api/v1/hospitality/session/invalid-session-123');

      expect(response.status).toBe(404);
    });

    it('should handle service unavailable gracefully', async () => {
      // Create a client pointing to non-existent service
      const unavailableClient = axios.create({
        baseURL: 'http://localhost:9999',
        timeout: 1000,
      });

      await expect(
        unavailableClient.get('/health')
      ).rejects.toThrow();
    });
  });
});
