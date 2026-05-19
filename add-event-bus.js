#!/usr/bin/env node
/**
 * Add Event Bus Integration to Services
 *
 * This script adds Event Bus integration to existing services.
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Event Bus Import Code
// ============================================================================

const EVENT_BUS_IMPORT = `
// Event Bus Integration
import { getEventEmitter } from '../src/eventBusIntegration';
const emitEvent = getEventEmitter('SERVICE_NAME');
`;

// ============================================================================
// Event Emission Examples
// ============================================================================

const EMISSION_EXAMPLES = `
// Event Emission Examples (add in your service logic):

// On user action:
await emitEvent.emit({
  type: 'engagement.user.action',
  userId: user.id,
  data: { action: 'click', element: 'button' }
});

// On prediction calculated:
await emitEvent.emit({
  type: 'intelligence.prediction.calculated',
  userId: user.id,
  data: { type: 'churn', score: 0.75 }
});

// On segment updated:
await emitEvent.emit({
  type: 'intelligence.segment.updated',
  userId: user.id,
  data: { segments: ['high_value', 'frequent'] }
});
`;

// ============================================================================
// Services to Update
// ============================================================================

const SERVICES_TO_UPDATE = [
  'REZ-predictive-engine',
  'REZ-churn-predictor',
  'REZ-conversion-predictor',
  'REZ-consumer-graph',
  'REZ-identity-graph',
  'REZ-rfm-plus-service',
  'REZ-attribution-system',
  'REZ-recommendation-engine',
  'REZ-personalization-engine',
  'REZ-signal-aggregator'
];

// ============================================================================
// Main Function
// ============================================================================

function addEventBusIntegration(serviceDir) {
  const servicePath = path.join(process.cwd(), serviceDir);
  const srcPath = path.join(servicePath, 'src');

  if (!fs.existsSync(srcPath)) {
    console.log(`  ⚠ ${serviceDir}: src/ not found`);
    return false;
  }

  // Find index.ts
  const indexPath = path.join(srcPath, 'index.ts');
  const indexJsPath = path.join(srcPath, 'index.js');

  if (fs.existsSync(indexPath)) {
    console.log(`  ✓ ${serviceDir}: Adding to index.ts`);

    let content = fs.readFileSync(indexPath, 'utf8');

    // Add import if not exists
    if (!content.includes('eventBusIntegration')) {
      const importStatement = `
import { getEventEmitter } from '../../src/eventBusIntegration';
const emitEvent = getEventEmitter('${serviceDir}');
`;
      content = importStatement + content;
    }

    fs.writeFileSync(indexPath, content);
    return true;
  }

  if (fs.existsSync(indexJsPath)) {
    console.log(`  ⚠ ${serviceDir}: index.js found (needs TypeScript migration)`);
    return false;
  }

  console.log(`  ⚠ ${serviceDir}: No index file found`);
  return false;
}

// ============================================================================
// Run
// ============================================================================

console.log('==========================================');
console.log('Adding Event Bus Integration to Services');
console.log('==========================================');
console.log('');

let successCount = 0;

for (const service of SERVICES_TO_UPDATE) {
  const success = addEventBusIntegration(service);
  if (success) successCount++;
}

console.log('');
console.log(`✓ Added Event Bus integration to ${successCount}/${SERVICES_TO_UPDATE.length} services`);
console.log('');
console.log('NEXT STEPS:');
console.log('1. Add emitEvent.emit() calls in your service logic');
console.log('2. Emit relevant events (predictions, segments, etc.)');
console.log('3. Test the integration');
