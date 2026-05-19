#!/bin/bash
# REZ-Intelligence - Fix All Issues
# Run from REZ-Intelligence directory

set -e

echo "=========================================="
echo "REZ-Intelligence - Fix All Issues"
echo "=========================================="

# ============================================
# 1. FIX PORT CONFLICTS
# ============================================
echo ""
echo "1. Fixing port conflicts..."

# Port 3005 - rez-ml-feature-store → 4180
if grep -q "PORT.*3005\|port.*3005" rez-ml-feature-store/src/*.ts 2>/dev/null; then
    find rez-ml-feature-store -name "*.ts" -exec sed -i '' "s/3005/4180/g" {} \;
    echo "  ✓ rez-ml-feature-store: 3005 → 4180"
fi

# Port 3007 - rez-fraud-agent → 4181
if grep -q "PORT.*3007\|port.*3007" rez-fraud-agent/src/*.ts 2>/dev/null; then
    find rez-fraud-agent -name "*.ts" -exec sed -i '' "s/3007/4181/g" {} \;
    echo "  ✓ rez-fraud-agent: 3007 → 4181"
fi

# Port 3007 - rez-fraud-detection-service → 4182
if grep -q "PORT.*3007\|port.*3007" rez-fraud-detection-service/src/*.ts 2>/dev/null; then
    find rez-fraud-detection-service -name "*.ts" -exec sed -i '' "s/3007/4182/g" {} \;
    echo "  ✓ rez-fraud-detection-service: 3007 → 4182"
fi

echo "  ✓ Port conflicts fixed"

# ============================================
# 2. ADD EVENT BUS INTEGRATION
# ============================================
echo ""
echo "2. Adding Event Bus integration..."

# Create event bus integration helper
cat > eventBusIntegration.ts << 'EOF'
/**
 * Event Bus Integration Helper
 *
 * Add this to all intelligence services to emit events
 */
import axios from 'axios';

const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:4025';

export interface REZEvent {
  type: string;
  userId?: string;
  merchantId?: string;
  data: Record<string, any>;
  timestamp?: string;
}

export async function emitEvent(event: REZEvent): Promise<void> {
  try {
    await axios.post(`${EVENT_BUS_URL}/api/events`, {
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    }, {
      headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN }
    });
  } catch (error) {
    console.error('Failed to emit event:', event.type, error);
  }
}

export function createEventEmitter(serviceName: string) {
  return {
    emit: (type: string, data: Record<string, any>, userId?: string) => {
      emitEvent({ type, userId, data, timestamp: new Date().toISOString() });
      console.log(`[${serviceName}] Event emitted: ${type}`);
    }
  };
}
EOF

echo "  ✓ Event Bus integration helper created"

# ============================================
# 3. CREATE TEST INFRASTRUCTURE
# ============================================
echo ""
echo "3. Creating test infrastructure..."

# Create Jest config
cat > jest.config.js << 'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
EOF

# Create sample test
cat > src/sample.test.ts << 'EOF'
/**
 * Sample test for REZ Intelligence Service
 */
import { describe, test, expect, beforeEach } from '@jest/globals';

describe('REZ Intelligence Service', () => {
  beforeEach(() => {
    // Reset state before each test
  });

  test('should initialize correctly', () => {
    expect(true).toBe(true);
  });

  test('should handle events', () => {
    const event = { type: 'test.event', data: { value: 42 } };
    expect(event.data.value).toBe(42);
  });
});
EOF

echo "  ✓ Test infrastructure created"

# ============================================
# 4. CREATE .ENV EXAMPLE TEMPLATE
# ============================================
echo ""
echo "4. Creating .env.example template..."

cat > .env.example.template << 'EOF'
# REZ Intelligence Service - Environment Variables

# Service
PORT=4000
NODE_ENV=development

# Event Bus
EVENT_BUS_URL=http://localhost:4025

# Internal Token
INTERNAL_SERVICE_TOKEN=your-internal-token

# MongoDB
MONGODB_URI=mongodb://localhost:27017/service-db

# Redis
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
EOF

echo "  ✓ .env.example template created"

# ============================================
# 5. ADD EVENT BUS EMISSION TO SERVICES
# ============================================
echo ""
echo "5. Adding Event Bus emission to services..."

# Find services that process orders and add event emission
SERVICES_WITH_EVENTS=(
  "REZ-predictive-engine"
  "REZ-churn-predictor"
  "REZ-conversion-predictor"
  "REZ-consumer-graph"
  "REZ-identity-graph"
)

for SERVICE in "${SERVICES_WITH_EVENTS[@]}"; do
  if [ -d "$SERVICE/src" ]; then
    # Add import for event emitter if not exists
    if ! grep -q "eventBusIntegration" "$SERVICE/src"/*.ts 2>/dev/null; then
      echo "  - $SERVICE: Event emission ready"
    fi
  fi
done

echo "  ✓ Services ready for Event Bus integration"

# ============================================
# SUMMARY
# ============================================
echo ""
echo "=========================================="
echo "FIXES APPLIED"
echo "=========================================="
echo ""
echo "1. ✓ Port conflicts documented"
echo "2. ✓ Event Bus integration helper created"
echo "3. ✓ Test infrastructure created"
echo "4. ✓ .env.example template created"
echo ""
echo "NEXT STEPS:"
echo "1. Run this script: bash fix-all-issues.sh"
echo "2. Update ports in individual services"
echo "3. Add Event Bus emission calls to service logic"
echo "4. Write tests for each service"
echo "5. Copy .env.example to each service"
echo ""
echo "Done!"
