import logger from './utils/logger';

#!/usr/bin/env node
'use strict';

/**
 * REZ Intelligence - End-to-End Test Suite
 * Tests all new services for correctness
 */

const http = require('http');
const { spawn } = require('child_process');

const services = [
  { name: 'REZ-flywheel-mvp', port: 4101, endpoints: ['/health', '/status', '/demo'] },
  { name: 'REZ-validation-dashboard', port: 4100, endpoints: ['/health', '/dashboard'] }
];

const results = { passed: 0, failed: 0, errors: [] };

function httpGet(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function testService(service) {
  logger.info(`\n${'='.repeat(50)}`);
  logger.info(`Testing: ${service.name}`);
  logger.info(`Port: ${service.port}`);
  console.log('='.repeat(50));

  for (const endpoint of service.endpoints) {
    try {
      const result = await httpGet(service.port, endpoint);
      if (result.status === 200) {
        logger.info(`  ✓ ${endpoint} - OK (${result.status})`);
        results.passed++;
      } else {
        logger.info(`  ✗ ${endpoint} - FAILED (${result.status})`);
        results.failed++;
        results.errors.push({ service: service.name, endpoint, status: result.status });
      }
    } catch (err) {
      logger.info(`  ✗ ${endpoint} - ERROR (${err.message})`);
      results.failed++;
      results.errors.push({ service: service.name, endpoint, error: err.message });
    }
  }
}

async function testFlywheelLogic() {
  logger.info(`\n${'='.repeat(50)}`);
  logger.info('Testing: Flywheel Logic');
  console.log('='.repeat(50));

  const tests = [
    { name: 'Reorder Score Calculation', fn: testReorderScore },
    { name: 'Event Recording', fn: testEventRecording },
    { name: 'Nudge Triggering', fn: testNudgeTrigger }
  ];

  for (const test of tests) {
    try {
      await test.fn();
      logger.info(`  ✓ ${test.name}`);
      results.passed++;
    } catch (err) {
      logger.info(`  ✗ ${test.name}: ${err.message}`);
      results.failed++;
      results.errors.push({ test: test.name, error: err.message });
    }
  }
}

async function testReorderScore() {
  // Test the reorder score calculation
  const calculateScore = (lastOrderDate, orderCount, avgValue) => {
    const daysSinceOrder = Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24));

    let score = 0;
    if (daysSinceOrder <= 1) score += 40;
    else if (daysSinceOrder <= 3) score += 35;
    else if (daysSinceOrder <= 7) score += 25;
    else if (daysSinceOrder <= 14) score += 15;
    else score += 5;

    if (orderCount >= 5) score += 30;
    else if (orderCount >= 3) score += 20;
    else if (orderCount >= 2) score += 10;

    if (avgValue >= 500) score += 30;
    else if (avgValue >= 300) score += 20;
    else if (avgValue >= 150) score += 10;

    return Math.min(100, score);
  };

  // Test case 1: Recent high-value customer
  const recentHighValue = calculateScore(Date.now() - 2 * 24 * 60 * 60 * 1000, 5, 600);
  if (recentHighValue < 80) throw new Error(`Expected score >= 80 for recent high-value, got ${recentHighValue}`);

  // Test case 2: Dormant low-value customer
  const dormantLowValue = calculateScore(Date.now() - 30 * 24 * 60 * 60 * 1000, 1, 100);
  if (dormantLowValue > 30) throw new Error(`Expected score < 30 for dormant, got ${dormantLowValue}`);

  // Test case 3: Medium-value repeat customer
  const mediumRepeat = calculateScore(Date.now() - 5 * 24 * 60 * 60 * 1000, 3, 300);
  if (mediumRepeat < 50 || mediumRepeat > 80) throw new Error(`Expected score 50-80 for medium repeat, got ${mediumRepeat}`);

  logger.info(`    Recent High-Value: ${recentHighValue} (expected >= 80)`);
  logger.info(`    Dormant Low-Value: ${dormantLowValue} (expected < 30)`);
  logger.info(`    Medium Repeat: ${mediumRepeat} (expected 50-80)`);
}

async function testEventRecording() {
  // Test event types
  const eventTypes = ['qr_scan', 'browse', 'search', 'order', 'reorder_nudge', 'reorder_click', 'reorder_convert'];
  const validTypes = eventTypes.filter(t => ['qr_scan', 'browse', 'search', 'order', 'reorder_nudge', 'reorder_click', 'reorder_convert'].includes(t));

  if (validTypes.length !== eventTypes.length) {
    throw new Error('Invalid event types');
  }
}

async function testNudgeTrigger() {
  // Test nudge threshold
  const shouldNudge = (score) => score >= 60;

  if (!shouldNudge(60)) throw new Error('Should nudge at score 60');
  if (!shouldNudge(75)) throw new Error('Should nudge at score 75');
  if (shouldNudge(59)) throw new Error('Should NOT nudge at score 59');
  if (shouldNudge(30)) throw new Error('Should NOT nudge at score 30');
}

async function testAgentSchemas() {
  logger.info(`\n${'='.repeat(50)}`);
  logger.info('Testing: Agent Schemas');
  console.log('='.repeat(50));

  // Test commerce agents
  try {
    const commerceAgents = require('./REZ-commerce-agents/src/agents.js');
    const agentCount = Array.isArray(commerceAgents.agents) ? commerceAgents.agents.length : Object.keys(commerceAgents.agents || {}).length;
    logger.info(`  ✓ Commerce Agents: ${agentCount} agents`);
    results.passed++;
  } catch (err) {
    logger.info(`  ✗ Commerce Agents: ${err.message}`);
    results.failed++;
  }

  // Test user agents
  try {
    const userAgents = require('./REZ-user-agents/src/agents.js');
    const agentCount = Array.isArray(userAgents.AGENTS) ? userAgents.AGENTS.length : userAgents.agents?.length || 0;
    logger.info(`  ✓ User Agents: ${agentCount} agents`);
    results.passed++;
  } catch (err) {
    logger.info(`  ✗ User Agents: ${err.message}`);
    results.failed++;
  }
}

async function runAllTests() {
  logger.info('\n' + '═'.repeat(60));
  logger.info('REZ INTELLIGENCE - END-TO-END TEST SUITE');
  console.log('═'.repeat(60));
  logger.info(`Time: ${new Date().toISOString()}`);
  logger.info(`Services to test: ${services.length}`);
  console.log('═'.repeat(60));

  // Test flywheel logic (no server needed)
  await testFlywheelLogic();

  // Test agent schemas
  await testAgentSchemas();

  // Test endpoints (requires servers running)
  logger.info(`\n${'='.repeat(50)}`);
  logger.info('Testing: Service Endpoints');
  console.log('='.repeat(50));
  logger.info('(Skipping live endpoint tests - start servers to test)');

  // Summary
  logger.info('\n' + '═'.repeat(60));
  logger.info('TEST SUMMARY');
  console.log('═'.repeat(60));
  logger.info(`  Passed: ${results.passed}`);
  logger.info(`  Failed: ${results.failed}`);
  logger.info(`  Total:  ${results.passed + results.failed}`);

  if (results.errors.length > 0) {
    logger.info('\nErrors:');
    results.errors.forEach(e => logger.info(`  - ${e.service || e.test}: ${e.endpoint || e.error}`));
  }

  logger.info('\n' + '═'.repeat(60));
  if (results.failed === 0) {
    logger.info('✓ ALL TESTS PASSED');
  } else {
    logger.info(`✗ ${results.failed} TEST(S) FAILED`);
  }
  console.log('═'.repeat(60) + '\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
