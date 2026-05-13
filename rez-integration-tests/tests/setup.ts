/**
 * Jest setup file for REZ Integration Tests
 */

// Load environment variables
import 'dotenv/config';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console.log in tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error for debugging
    error: console.error,
  };
}

// Service URLs for testing
export const SERVICE_URLS = {
  orchestrator: process.env.ORCHESTRATOR_URL || 'http://localhost:4070',
  contextEngine: process.env.CONTEXT_ENGINE_URL || 'http://localhost:4071',
  coreBrain: process.env.CORE_BRAIN_URL || 'http://localhost:4072',
  agentRegistry: process.env.AGENT_REGISTRY_URL || 'http://localhost:4073',
  hospitalityExpert: process.env.HOSPITALITY_EXPERT_URL || 'http://localhost:3000',
  culinaryExpert: process.env.CULINARY_EXPERT_URL || 'http://localhost:3001',
};

// Helper to wait for a service to be healthy
export async function waitForService(
  url: string,
  maxAttempts = 30,
  intervalMs = 1000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // Service not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

// Helper to create a test user context
export function createTestUserContext(userId: string = 'test-user-123') {
  return {
    userId,
    sessionId: `session-${Date.now()}`,
    preferences: {
      tone: 'friendly' as const,
      language: 'en',
    },
    loyalty: {
      points: 500,
      tier: 'gold',
      benefits: ['early_checkin', 'late_checkout', 'room_upgrade'],
    },
  };
}

// Helper to create a test merchant context
export function createTestMerchantContext(merchantId: string = 'hotel-123') {
  return {
    merchantId,
    name: 'Test Hotel',
    type: 'hotel',
    amenities: ['wifi', 'pool', 'gym', 'restaurant'],
    services: ['checkin', 'checkout', 'roomservice'],
  };
}

// Clean up function to run after tests
export async function cleanup(): Promise<void> {
  // Add any global cleanup here
}
