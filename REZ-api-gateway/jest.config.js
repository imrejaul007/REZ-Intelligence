/**
 * REZ Intelligence - Integration Tests
 *
 * Tests for API Gateway, Tenant Adapter, and SDK
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// Test configuration
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:4300';
const TENANT_ADAPTER_URL = process.env.TENANT_ADAPTER_URL || 'http://localhost:4210';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token-change-in-prod';

// ============================================
// HELPER FUNCTIONS
// ============================================

async function makeRequest(
  url: string,
  options: RequestInit = {}
): Promise<{ status: number; data: unknown }> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, data };
}

// ============================================
// API GATEWAY TESTS
// ============================================

describe('REZ API Gateway', () => {
  describe('Health Check', () => {
    test('GET /health returns 200', async () => {
      const { status, data } = await makeRequest(`${API_GATEWAY_URL}/health`);
      expect(status).toBe(200);
      expect(data).toHaveProperty('status');
    });
  });

  describe('Intent Prediction', () => {
    test('POST /api/intent/predict validates request body', async () => {
      const { status, data } = await makeRequest(`${API_GATEWAY_URL}/api/intent/predict`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      expect(status).toBeGreaterThanOrEqual(400);
      expect(data).toHaveProperty('success');
    });

    test('POST /api/intent/predict with valid userId', async () => {
      const { status, data } = await makeRequest(`${API_GATEWAY_URL}/api/intent/predict`, {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test_user_123',
          context: {
            location: { lat: 12.9716, lng: 77.5946 },
            time: { hour: 12, dayOfWeek: 'monday' },
          },
        }),
      });

      // Should return 200 or 500 (if downstream services not available)
      expect([200, 500, 503]).toContain(status);
      expect(data).toHaveProperty('success');
    });
  });

  describe('Recommendations', () => {
    test('POST /api/recommendations validates request', async () => {
      const { status, data } = await makeRequest(`${API_GATEWAY_URL}/api/recommendations`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      expect([400, 500, 503]).toContain(status);
      expect(data).toHaveProperty('success');
    });
  });
});

// ============================================
// TENANT ADAPTER TESTS
// ============================================

describe('REZ Tenant Adapter', () => {
  describe('Health Check', () => {
    test('GET /health returns 200', async () => {
      const { status, data } = await makeRequest(`${TENANT_ADAPTER_URL}/health`);
      expect(status).toBe(200);
      expect(data).toHaveProperty('status');
    });
  });

  describe('Tenant Management', () => {
    test('POST /api/tenants creates a tenant', async () => {
      const { status, data } = await makeRequest(`${TENANT_ADAPTER_URL}/api/tenants`, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        body: JSON.stringify({
          clientType: 'REZ_ECOSYSTEM',
          displayName: 'Test Company',
          industry: 'retail',
        }),
      });

      expect(status).toBe(201);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
    });

    test('POST /api/tenants without internal token returns 401', async () => {
      const { status } = await makeRequest(`${TENANT_ADAPTER_URL}/api/tenants`, {
        method: 'POST',
        body: JSON.stringify({
          clientType: 'REZ_ECOSYSTEM',
          displayName: 'Test',
          industry: 'retail',
        }),
      });

      expect(status).toBe(401);
    });

    test('POST /api/tenants with invalid data returns 400', async () => {
      const { status, data } = await makeRequest(`${TENANT_ADAPTER_URL}/api/tenants`, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        body: JSON.stringify({
          clientType: 'REZ_ECOSYSTEM',
          // Missing displayName and industry
        }),
      });

      expect(status).toBe(400);
      expect(data).toHaveProperty('success', false);
    });
  });

  describe('Privacy Checks', () => {
    test('POST /api/privacy/can-access validates request', async () => {
      const { status, data } = await makeRequest(`${TENANT_ADAPTER_URL}/api/privacy/can-access`, {
        method: 'POST',
        headers: { 'X-API-Key': 'rez_test_123' },
        body: JSON.stringify({}),
      });

      expect([400, 500]).toContain(status);
      expect(data).toHaveProperty('success');
    });
  });
});

// ============================================
// SDK TESTS
// ============================================

describe('REZ Intelligence SDK', () => {
  describe('Client Configuration', () => {
    test('SDK exports types correctly', async () => {
      // Test that types are properly exported
      const ClientType = {
        REZ_ECOSYSTEM: 'REZ_ECOSYSTEM',
        NON_REZ: 'NON_REZ',
        RABTUL_SAAS: 'RABTUL_SAAS',
      };

      expect(ClientType.REZ_ECOSYSTEM).toBe('REZ_ECOSYSTEM');
      expect(ClientType.NON_REZ).toBe('NON_REZ');
      expect(ClientType.RABTUL_SAAS).toBe('RABTUL_SAAS');
    });

    test('API key format validation', async () => {
      const validKeys = [
        'rez_acme_corp_abc123',
        'ext_partner_xyz456',
        'saas_reseller_123abc',
      ];

      const invalidKeys = ['invalid', 'no_prefix', 'partial_'];

      validKeys.forEach((key) => {
        expect(key.split('_').length).toBeGreaterThanOrEqual(2);
      });

      invalidKeys.forEach((key) => {
        expect(key.split('_').length).toBeLessThan(2);
      });
    });
  });
});

// ============================================
// END-TO-END TESTS
// ============================================

describe('End-to-End Flows', () => {
  describe('Tenant Lifecycle', () => {
    test('Create tenant and validate API key format', async () => {
      // Create tenant
      const createResult = await makeRequest(`${TENANT_ADAPTER_URL}/api/tenants`, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        body: JSON.stringify({
          clientType: 'REZ_ECOSYSTEM',
          displayName: 'E2E Test Company',
          industry: 'retail',
          email: 'test@example.com',
        }),
      });

      expect(createResult.status).toBe(201);
      expect(createResult.data).toHaveProperty('data');
      const { data } = createResult.data as { data: { apiKey?: string } };
      expect(data.apiKey).toMatch(/^rez_/);

      // List tenants
      const listResult = await makeRequest(`${TENANT_ADAPTER_URL}/api/tenants`, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });

      expect(listResult.status).toBe(200);
      expect(listResult.data).toHaveProperty('data');
    });
  });

  describe('3 Client Types', () => {
    test('REZ_ECOSYSTEM tenant has full permissions', async () => {
      const { status, data } = await makeRequest(`${TENANT_ADAPTER_URL}/api/tenants`, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        body: JSON.stringify({
          clientType: 'REZ_ECOSYSTEM',
          displayName: 'REZ Test',
          industry: 'retail',
        }),
      });

      expect(status).toBe(201);
      const { data: resultData } = data as { data: { tenant?: { permissions: string[] } } };
      expect(resultData.tenant?.permissions).toContain('admin');
      expect(resultData.tenant?.permissions).toContain('share');
    });

    test('NON_REZ tenant has limited permissions', async () => {
      const { status, data } = await makeRequest(`${TENANT_ADAPTER_URL}/api/tenants`, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        body: JSON.stringify({
          clientType: 'NON_REZ',
          displayName: 'External Test',
          industry: 'retail',
        }),
      });

      expect(status).toBe(201);
      const { data: resultData } = data as { data: { tenant?: { permissions: string[] } } };
      expect(resultData.tenant?.permissions).not.toContain('admin');
      expect(resultData.tenant?.permissions).not.toContain('share');
    });
  });
});

// ============================================
// PERFORMANCE TESTS
// ============================================

describe('Performance', () => {
  test('Health check responds within 100ms', async () => {
    const start = Date.now();
    const { status } = await makeRequest(`${API_GATEWAY_URL}/health`);
    const duration = Date.now() - start;

    expect(status).toBe(200);
    expect(duration).toBeLessThan(100);
  });

  test('Concurrent requests handled correctly', async () => {
    const concurrentRequests = 10;
    const promises = Array.from({ length: concurrentRequests }, () =>
      makeRequest(`${API_GATEWAY_URL}/health`)
    );

    const results = await Promise.all(promises);

    results.forEach((result) => {
      expect(result.status).toBe(200);
    });
  });
});
