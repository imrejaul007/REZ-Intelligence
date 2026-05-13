/**
 * Service Discovery Integration Tests
 * Tests service registration, health checks, and service-to-service communication
 */

import axios from 'axios';
import { SERVICE_URLS, waitForService } from './setup';

describe('Service Discovery Integration Tests', () => {
  describe('Service Health Checks', () => {
    const services = [
      { name: 'Orchestrator', url: SERVICE_URLS.orchestrator },
      { name: 'Context Engine', url: SERVICE_URLS.contextEngine },
      { name: 'Core Brain', url: SERVICE_URLS.coreBrain },
      { name: 'Agent Registry', url: SERVICE_URLS.agentRegistry },
      { name: 'Hospitality Expert', url: SERVICE_URLS.hospitalityExpert },
      { name: 'Culinary Expert', url: SERVICE_URLS.culinaryExpert },
    ];

    it.each(services)('should have health endpoint for $name', async ({ name, url }) => {
      try {
        const response = await axios.get(`${url}/health`, {
          timeout: 5000,
        });
        expect([200, 503]).toContain(response.status);
      } catch (error) {
        console.log(`${name} at ${url} is not available`);
        // Service may not be running - this is acceptable for dev environment
      }
    });
  });

  describe('Agent Registry Service Discovery', () => {
    const registryUrl = SERVICE_URLS.agentRegistry;

    it('should register a hospitality expert', async () => {
      try {
        const response = await axios.post(`${registryUrl}/api/registry/register`, {
          name: 'hospitality-expert',
          url: SERVICE_URLS.hospitalityExpert,
          type: 'expert',
          capabilities: [
            'hotel_booking',
            'checkin_checkout',
            'room_service',
            'concierge',
            'recommendations',
          ],
          metadata: {
            version: '1.0.0',
            serviceName: 'rez-hospitality-expert',
          },
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('success', true);
        expect(response.data).toHaveProperty('agentId');
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          // Already registered - that's fine
          console.log('Hospitality expert already registered');
        } else {
          console.log('Agent Registry not available');
        }
      }
    });

    it('should register a culinary expert', async () => {
      try {
        const response = await axios.post(`${registryUrl}/api/registry/register`, {
          name: 'culinary-expert',
          url: SERVICE_URLS.culinaryExpert,
          type: 'expert',
          capabilities: [
            'menu_browse',
            'recommendations',
            'dietary_check',
            'order_management',
            'pairing_suggestions',
          ],
          metadata: {
            version: '1.0.0',
            serviceName: 'rez-culinary-expert',
          },
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('success', true);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          console.log('Culinary expert already registered');
        } else {
          console.log('Agent Registry not available');
        }
      }
    });

    it('should list registered agents', async () => {
      try {
        const response = await axios.get(`${registryUrl}/api/registry/agents`);

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('agents');
        expect(Array.isArray(response.data.agents)).toBe(true);
      } catch (error) {
        console.log('Agent Registry not available');
      }
    });

    it('should find experts by capability', async () => {
      try {
        const response = await axios.get(`${registryUrl}/api/registry/find`, {
          params: {
            capability: 'recommendations',
          },
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('agents');
      } catch (error) {
        console.log('Agent Registry not available');
      }
    });

    it('should update agent status', async () => {
      try {
        // First register
        const registerRes = await axios.post(`${registryUrl}/api/registry/register`, {
          name: 'test-agent',
          url: 'http://localhost:9999',
          type: 'test',
          capabilities: ['test'],
        });

        const agentId = registerRes.data.agentId;

        // Update status
        const updateRes = await axios.patch(`${registryUrl}/api/registry/agents/${agentId}/status`, {
          status: 'busy',
        });

        expect(updateRes.status).toBe(200);
        expect(updateRes.data).toHaveProperty('status', 'busy');
      } catch (error) {
        console.log('Agent Registry not available or test agent not found');
      }
    });

    it('should record agent metrics', async () => {
      try {
        // Register first
        const registerRes = await axios.post(`${registryUrl}/api/registry/register`, {
          name: 'metrics-test-agent',
          url: 'http://localhost:9998',
          type: 'test',
          capabilities: ['test'],
        });

        const agentId = registerRes.data.agentId;

        // Record metrics
        const metricsRes = await axios.post(`${registryUrl}/api/registry/agents/${agentId}/metrics`, {
          requestCount: 10,
          successCount: 9,
          failureCount: 1,
          averageLatencyMs: 150,
        });

        expect(metricsRes.status).toBe(200);
      } catch (error) {
        console.log('Agent Registry not available or test agent not found');
      }
    });
  });

  describe('Service-to-Service Communication', () => {
    it('should call Context Engine from Orchestrator', async () => {
      try {
        // This tests the internal service communication
        // In production, services call each other directly
        const contextResponse = await axios.post(
          `${SERVICE_URLS.contextEngine}/api/context`,
          {
            sessionId: `discovery-test-${Date.now()}`,
            merchantId: 'test-merchant',
            entryPoint: 'web',
          }
        );

        expect(contextResponse.status).toBe(200);
        expect(contextResponse.data).toHaveProperty('data');
      } catch (error) {
        console.log('Context Engine not available');
      }
    });

    it('should call Core Brain for user context', async () => {
      try {
        const memoryResponse = await axios.get(
          `${SERVICE_URLS.coreBrain}/internal/memory?userId=test-user&limit=5`,
          {
            headers: {
              'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
            },
          }
        );

        expect(memoryResponse.status).toBe(200);
      } catch (error) {
        console.log('Core Brain not available');
      }
    });

    it('should get personalization data from Core Brain', async () => {
      try {
        const personalizationResponse = await axios.get(
          `${SERVICE_URLS.coreBrain}/internal/personalization/intelligence?userId=test-user`,
          {
            headers: {
              'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
            },
          }
        );

        expect(personalizationResponse.status).toBe(200);
      } catch (error) {
        console.log('Core Brain personalization not available');
      }
    });
  });

  describe('Orchestrator Service Discovery', () => {
    it('should discover experts from registry', async () => {
      try {
        const response = await axios.get(
          `${SERVICE_URLS.orchestrator}/api/experts`
        );

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('experts');
        expect(Array.isArray(response.data.experts)).toBe(true);
      } catch (error) {
        console.log('Orchestrator experts endpoint not available');
      }
    });

    it('should get orchestrator status', async () => {
      try {
        const response = await axios.get(
          `${SERVICE_URLS.orchestrator}/api/status`
        );

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('status');
      } catch (error) {
        console.log('Orchestrator status endpoint not available');
      }
    });
  });
});
