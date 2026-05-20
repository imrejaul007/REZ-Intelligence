#!/usr/bin/env node
/**
 * Script to create .env.example files for all REZ-Intelligence services
 *
 * Usage: node scripts/add-env-files.js
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname + '/..';

// Get all service directories
function getServices() {
  const services = [];
  const entries = fs.readdirSync(ROOT_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && (entry.name.startsWith('REZ-') || entry.name.startsWith('rez-'))) {
      const srcDir = path.join(ROOT_DIR, entry.name, 'src');
      if (fs.existsSync(srcDir)) {
        services.push(entry.name);
      }
    }
  }

  return services;
}

// .env.example template
const ENV_TEMPLATE = `# Service Configuration
SERVICE_NAME=REPLACE_WITH_SERVICE_NAME
PORT=3000
NODE_ENV=development

# RABTUL Platform Services (Required for all services)
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service-36vo.onrender.com
NOTIFICATION_SERVICE_URL=https://rez-notifications-service.onrender.com
ORDER_SERVICE_URL=http://localhost:4006
CATALOG_SERVICE_URL=http://localhost:4007
PROFILE_SERVICE_URL=http://localhost:4013
ANALYTICS_SERVICE_URL=http://localhost:4016

# REZ Intelligence Services
INTENT_SERVICE_URL=https://rez-intent-predictor.onrender.com
PREDICTIVE_ENGINE_URL=http://localhost:4141
SIGNAL_AGGREGATOR_URL=http://localhost:4121
RECOMMENDATION_ENGINE_URL=https://REZ-recommendation-engine.onrender.com
EVENT_BUS_URL=http://localhost:4025
FEATURE_STORE_URL=http://localhost:4127
DECISION_ENGINE_URL=http://localhost:4128
GRAPH_SERVICE_URL=http://localhost:4129
ML_OBSERVABILITY_URL=http://localhost:4130

# Security (Required)
# Generate a secure token: openssl rand -hex 32
INTERNAL_SERVICE_TOKEN=your-secure-internal-token-here

# Database
MONGODB_URI=mongodb://localhost:27017/REPLACE_WITH_SERVICE_NAME

# Cache (Optional)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
`;

// Main function to create .env.example
function createEnvExample(serviceName) {
  const serviceDir = path.join(ROOT_DIR, serviceName);
  const envPath = path.join(serviceDir, '.env.example');

  // Replace placeholder with actual service name
  const envContent = ENV_TEMPLATE.replace(/REPLACE_WITH_SERVICE_NAME/g, serviceName.toLowerCase().replace(/-/g, '_'));

  fs.writeFileSync(envPath, envContent);
  console.log('Created: ' + envPath);

  return true;
}

// Run for all services
console.log('Creating .env.example files for all REZ-Intelligence services...\n');

const services = getServices();
let successCount = 0;

for (const service of services) {
  try {
    createEnvExample(service);
    successCount++;
  } catch (error) {
    console.log('ERROR: ' + service + ' - ' + error.message);
  }
}

console.log('\n=== Summary ===');
console.log('Created: ' + successCount + ' .env.example files');
console.log('Total services: ' + services.length);
