import logger from './utils/logger';

#!/usr/bin/env node
/**
 * REZ Intelligence - Integration Test
 * Tests the complete data flow from app to intelligence
 */

const http = require('http');
const { spawn } = require('child_process');

const INTEGRATION_SDK_URL = process.env.REZ_API_URL || 'http://localhost:4091';
const TIMEOUT = 5000;

function httpPost(path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, INTEGRATION_SDK_URL);
    const dataStr = JSON.stringify(data);

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr),
        'X-REZ-API-Key': 'test-api-key',
        'X-Request-Id': `test_${Date.now()}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(TIMEOUT, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.write(dataStr);
    req.end();
  });
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, INTEGRATION_SDK_URL);

    http.get({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'X-REZ-API-Key': 'test-api-key'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    }).on('error', reject);
  });
}

async function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    await fn();
    logger.info('✓');
    return true;
  } catch (err) {
    logger.info(`✗ (${err.message})`);
    return false;
  }
}

async function runTests() {
  logger.info('\n═══════════════════════════════════════════════════════════');
  logger.info('REZ Intelligence - Integration Test');
  logger.info('═══════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Health Check
  logger.info('Health Checks:');
  if (await test('Integration SDK Health', async () => {
    const res = await httpGet('/health');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  })) passed++; else failed++;

  // Test 2: Identity Resolution
  logger.info('\nIdentity:');
  if (await test('Resolve New User', async () => {
    const res = await httpPost('/resolve', {
      phone: '+919876543210',
      sourceApp: 'test-app',
      sourceUserId: 'test_user_1'
    });
    if (!res.data.unifiedId) throw new Error('No unified ID returned');
    logger.info(`    Unified ID: ${res.data.unifiedId}`);
  })) passed++; else failed++;

  if (await test('Get User Profile', async () => {
    const res = await httpPost('/resolve', {
      phone: '+919876543210'
    });
    if (!res.data.unifiedId) throw new Error('Identity not found');
  })) passed++; else failed++;

  // Test 3: Event Tracking
  logger.info('\nEvent Tracking:');
  if (await test('Track QR Scan', async () => {
    const res = await httpPost('/api/events/track', {
      eventType: 'qr_scan',
      userId: 'test_user_1',
      appId: 'consumer',
      properties: { merchantId: 'merchant_1' }
    });
  })) passed++; else failed++;

  if (await test('Track Order', async () => {
    const res = await httpPost('/api/events/track', {
      eventType: 'order_completed',
      userId: 'test_user_1',
      appId: 'consumer',
      properties: {
        orderId: 'ord_test_1',
        merchantId: 'merchant_1',
        amount: 500
      }
    });
  })) passed++; else failed++;

  // Test 4: Recommendations
  logger.info('\nRecommendations:');
  if (await test('Get Recommendations', async () => {
    const res = await httpGet('/api/recommendations/test_user_1?types=reorder&limit=5');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  })) passed++; else failed++;

  // Test 5: Feedback
  logger.info('\nFeedback:');
  if (await test('Track Conversion', async () => {
    const res = await httpPost('/api/feedback/conversion', {
      nudgeId: 'nudge_test_1',
      userId: 'test_user_1',
      appId: 'consumer',
      converted: true,
      orderId: 'ord_test_1',
      amount: 500
    });
  })) passed++; else failed++;

  // Summary
  logger.info('\n═══════════════════════════════════════════════════════════');
  logger.info(`Results: ${passed} passed, ${failed} failed`);
  logger.info('═══════════════════════════════════════════════════════════\n');

  return failed === 0;
}

runTests()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('Test error:', err.message);
    process.exit(1);
  });
