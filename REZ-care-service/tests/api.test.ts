/**
 * REZ Care Service - API Tests
 *
 * Run: npm test
 */

import { describe, it, expect } from 'node:test';
import assert from 'node:assert';

// Test helper
async function apiRequest(method: string, path: string, body?: object) {
  const baseUrl = process.env.TEST_URL || 'http://localhost:4058';
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}

describe('REZ Care Service API Tests', () => {

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const { status, data } = await apiRequest('GET', '/health');
      expect(status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('REZ Care Service');
    });
  });

  describe('Support Tickets', () => {
    it('should create a valid ticket', async () => {
      const { status, data } = await apiRequest('POST', '/api/support/tickets', {
        subject: 'Payment issue',
        category: 'payment',
        message: 'My payment failed with error code 500',
      });
      expect(status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.ticketNumber).toBeDefined();
    });

    it('should reject invalid ticket (missing fields)', async () => {
      const { status, data } = await apiRequest('POST', '/api/support/tickets', {
        subject: 'Hi',
      });
      expect(status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errors).toBeDefined();
    });

    it('should reject invalid category', async () => {
      const { status, data } = await apiRequest('POST', '/api/support/tickets', {
        subject: 'Test ticket',
        category: 'invalid_category',
        message: 'This is a test message for the ticket',
      });
      expect(status).toBe(400);
      expect(data.errors.category).toBeDefined();
    });

    it('should list tickets', async () => {
      const { status, data } = await apiRequest('GET', '/api/support/tickets');
      expect(status).toBe(200);
      expect(Array.isArray(data.tickets)).toBe(true);
    });
  });

  describe('AI Chat', () => {
    it('should respond to chat message', async () => {
      const { status, data } = await apiRequest('POST', '/api/support/chat', {
        message: 'I want to cancel my order',
      });
      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject empty message', async () => {
      const { status, data } = await apiRequest('POST', '/api/support/chat', {
        message: '',
      });
      expect(status).toBe(400);
    });
  });

  describe('Merchant Support', () => {
    it('should get merchant tickets', async () => {
      const { status, data } = await apiRequest('GET', '/api/merchant/testmerchant/tickets');
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.tickets)).toBe(true);
    });

    it('should create merchant FAQ', async () => {
      const { status, data } = await apiRequest('POST', '/api/merchant/testmerchant/kb', {
        question: 'How long for delivery?',
        answer: '30-45 minutes depending on location',
        category: 'delivery',
      });
      expect(status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.id).toBeDefined();
    });

    it('should get merchant KB', async () => {
      const { status, data } = await apiRequest('GET', '/api/merchant/testmerchant/kb');
      expect(status).toBe(200);
      expect(Array.isArray(data.faqs)).toBe(true);
    });

    it('should get merchant stats', async () => {
      const { status, data } = await apiRequest('GET', '/api/merchant/testmerchant/stats');
      expect(status).toBe(200);
      expect(data.stats).toBeDefined();
    });
  });

  describe('Email Integration', () => {
    it('should get email templates', async () => {
      const { status, data } = await apiRequest('GET', '/api/email/templates');
      expect(status).toBe(200);
      expect(Array.isArray(data.templates)).toBe(true);
    });

    it('should preview email parsing', async () => {
      const { status, data } = await apiRequest('POST', '/api/email/preview', {
        from: 'customer@example.com',
        to: 'support@company.com',
        subject: 'Order not delivered',
        body: 'My order has not arrived. Very frustrated!',
      });
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.parsed).toBeDefined();
    });
  });

  describe('Client Management', () => {
    it('should register a client', async () => {
      const { status, data } = await apiRequest('POST', '/api/clients', {
        clientId: 'test_client',
        clientName: 'Test Company',
        email: 'support@test.com',
        domain: 'test.com',
      });
      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should list clients', async () => {
      const { status, data } = await apiRequest('GET', '/api/clients');
      expect(status).toBe(200);
      expect(Array.isArray(data.clients)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const { status, data } = await apiRequest('GET', '/api/unknown-route');
      expect(status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('should return validation errors', async () => {
      const { status, data } = await apiRequest('POST', '/api/support/tickets', {
        subject: 'Short',
        category: 'payment',
        message: 'Hi',
      });
      expect(status).toBe(400);
      expect(data.errors).toBeDefined();
    });
  });

});

// Quick smoke test
describe('Smoke Tests', () => {
  it('all routes should respond', async () => {
    const routes = [
      '/health',
      '/api/support/config',
      '/api/support/faq',
      '/api/email/templates',
    ];

    for (const route of routes) {
      const { status } = await apiRequest('GET', route);
      expect([200, 404]).toContain(status);
    }
  });
});
