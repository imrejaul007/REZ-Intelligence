#!/usr/bin/env node
/**
 * Add .env.example to Services Missing It
 */

const fs = require('fs');
const path = require('path');

const TEMPLATE = `# SERVICE_NAME
NODE_ENV=development
PORT=4000

# Event Bus
EVENT_BUS_URL=http://localhost:4025

# Internal Token
INTERNAL_SERVICE_TOKEN=your-token

# Database
MONGODB_URI=mongodb://localhost:27017/service-db

# Redis
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
`;

// Find services missing .env.example
const services = fs.readdirSync('.')
  .filter(f => fs.statSync(f).isDirectory())
  .filter(f => !f.startsWith('.') && !f.startsWith('Archive'));

const missing = [];

for (const service of services) {
  const envPath = path.join(service, '.env.example');
  const packagePath = path.join(service, 'package.json');

  if (fs.existsSync(packagePath) && !fs.existsSync(envPath)) {
    missing.push(service);
  }
}

console.log('==========================================');
console.log('Adding .env.example to missing services');
console.log('==========================================');
console.log('');
console.log(`Found ${missing.length} services missing .env.example:`);

missing.forEach(service => {
  const content = TEMPLATE.replace(/SERVICE_NAME/g, service);
  const envPath = path.join(service, '.env.example');
  fs.writeFileSync(envPath, content);
  console.log(`  ✓ ${service}`);
});

console.log('');
console.log(`✓ Added .env.example to ${missing.length} services`);
