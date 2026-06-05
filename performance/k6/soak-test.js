import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics for soak test
const soakRequestCount = new Counter('soak_requests');
const soakErrorCount = new Counter('soak_errors');
const soakLatency = new Trend('soak_latency');

// Test configuration - long duration soak test
export const options = {
  // Extended test duration for soak testing
  duration: '30m',

  stages: [
    { duration: '2m', target: 20 },   // Gradual ramp up
    { duration: '25m', target: 50 }, // Sustained load
    { duration: '2m', target: 0 },   // Graceful ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // Sustained performance
    http_req_failed: ['rate<0.01'],      // Low error rate
    soak_requests: ['count>50000'],      // Minimum throughput
    soak_errors: ['count<500'],          // Maximum acceptable errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

// Soak test operations
function soakRequest(method, url, payload = null) {
  soakRequestCount.add(1);
  const start = Date.now();
  const body = payload ? payload : null;
  const res = http.request(method, url, body, { headers });
  const duration = Date.now() - start;

  soakLatency.add(duration);

  if (res.status >= 400) {
    soakErrorCount.add(1);
  }

  return res;
}

// Test: Health check
export function soakHealthCheck() {
  soakRequest('GET', `${BASE_URL}/health`);
}

// Test: Agent operations
export function soakAgentList() {
  soakRequest('GET', `${BASE_URL}/api/agents?skip=0&limit=10`);
}

// Test: Invoice operations
export function soakInvoiceCreate() {
  const payload = JSON.stringify({
    client_name: `Soak Client ${Date.now()}`,
    client_email: `soak-${Date.now()}@test.com`,
    line_items: [
      {
        description: 'Soak test service',
        quantity: 1,
        unit_price: 50,
        total: 50,
      },
    ],
    tax_rate: 0.1,
    due_date: '2024-12-31',
  });
  soakRequest('POST', `${BASE_URL}/api/invoice/create`, payload);
}

// Test: AutoML operations
export function soakModelTrain() {
  const payload = JSON.stringify({
    name: `soak-model-${Date.now()}`,
    task_type: 'classification',
    training_data: {
      features: [{ f1: Math.random(), f2: Math.random() }],
      target: [0],
    },
    features: ['f1', 'f2'],
    target: 'label',
  });
  soakRequest('POST', `${BASE_URL}/api/automl/train`, payload);
}

// Test: Contract operations
export function soakContractGenerate() {
  const payload = JSON.stringify({
    contract_type: 'nda',
    title: `Soak Contract ${Date.now()}`,
    parties: ['Soak A', 'Soak B'],
    terms: { duration: '1 year', jurisdiction: 'Delaware' },
  });
  soakRequest('POST', `${BASE_URL}/api/contracts/generate`, payload);
}

// Test: Twin operations
export function soakTwinCreate() {
  const payload = JSON.stringify({
    name: `soak-twin-${Date.now()}`,
    entity_type: 'factory',
    initial_state: { load: Math.random() * 100, temp: 72 },
  });
  soakRequest('POST', `${BASE_URL}/api/twin/create`, payload);
}

// Test: Ranking operations
export function soakRanking() {
  const payload = JSON.stringify({
    entities: Array.from({ length: 10 }, (_, i) => ({
      id: `soak-${i}`,
      score1: Math.random() * 1000,
      score2: Math.random() * 5,
    })),
    ranking_config: { algorithm: 'weighted' },
  });
  soakRequest('POST', `${BASE_URL}/api/ranking/score`, payload);
}

// Test: GraphQL operations
export function soakGraphQL() {
  const payload = JSON.stringify({
    query: '{ agents(skip: 0, limit: 5) { id name type } }',
  });
  soakRequest('POST', `${BASE_URL}/graphql`, payload);
}

// Main soak test - continuous operations
export default function () {
  // Run a mix of operations
  soakHealthCheck();
  soakAgentList();
  soakInvoiceCreate();
  soakRanking();
  soakGraphQL();

  // Sleep between iterations
  sleep(1);
}

// Progress reporting
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, opts) {
  const indent = opts.indent || '';
  let summary = `${indent}Soak Test Summary\n`;
  summary += `${indent}==================\n\n`;

  if (data.metrics.http_req_duration) {
    const duration = data.metrics.http_req_duration;
    summary += `${indent}Request Duration:\n`;
    summary += `${indent}  - avg: ${duration.values avg?.toFixed(2) || 'N/A'}ms\n`;
    summary += `${indent}  - p95: ${duration.values['p(95)']?.toFixed(2) || 'N/A'}ms\n`;
    summary += `${indent}  - p99: ${duration.values['p(99)']?.toFixed(2) || 'N/A'}ms\n\n`;
  }

  if (data.metrics.soak_requests) {
    summary += `${indent}Total Requests: ${data.metrics.soak_requests.values.count}\n`;
  }

  if (data.metrics.soak_errors) {
    summary += `${indent}Total Errors: ${data.metrics.soak_errors.values.count}\n`;
  }

  summary += `${indent}Duration: ${data.metrics.http_req_duration?.values?.checks || 'N/A'}\n`;

  return summary;
}