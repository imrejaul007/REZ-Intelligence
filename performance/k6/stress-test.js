import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const stressErrorRate = new Rate('stress_errors');
const stressRequestDuration = new Trend('stress_request_duration');
const stressRequests = new Counter('stress_requests');

// Test configuration - aggressive stress test
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Quick ramp to 50 users
    { duration: '1m', target: 200 },   // Ramp to 200 users
    { duration: '2m', target: 500 },  // Stress to 500 users
    { duration: '3m', target: 500 },  // Sustain at 500
    { duration: '30s', target: 100 },  // Quick ramp down
    { duration: '30s', target: 0 },   // Scale to zero
  ],
  thresholds: {
    http_req_duration: ['p(99)<1000'], // 99% under 1 second
    http_req_failed: ['rate<0.05'],    // Less than 5% failure
    stress_errors: ['rate<0.1'],       // Less than 10% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

// Simple API call tracking
function apiCall(method, url, payload = null) {
  const start = Date.now();
  stressRequests.add(1);

  let res;
  if (payload) {
    res = http.request(method, url, payload, { headers });
  } else {
    res = http.request(method, url, null, { headers });
  }

  const duration = Date.now() - start;
  stressRequestDuration.add(duration);

  const success = check(res, {
    [`${method} ${url} success`]: (r) => r.status >= 200 && r.status < 300,
  });

  if (!success) {
    stressErrorRate.add(1);
  }

  return res;
}

// Test: Concurrent Agent List Operations
export function stressAgentList() {
  const skip = Math.floor(Math.random() * 100);
  const limit = Math.floor(Math.random() * 50) + 1;
  return apiCall('GET', `${BASE_URL}/api/agents?skip=${skip}&limit=${limit}`);
}

// Test: Concurrent Agent Get Operations
export function stressAgentGet() {
  const agentId = `agent-${Math.floor(Math.random() * 20)}`;
  return apiCall('GET', `${BASE_URL}/api/agents/${agentId}`);
}

// Test: Concurrent Invoice Creation
export function stressInvoiceCreate() {
  const payload = JSON.stringify({
    client_name: `Stress Client ${Date.now()}`,
    client_email: `stress-${Date.now()}@test.com`,
    line_items: [
      {
        description: 'Bulk test item',
        quantity: Math.floor(Math.random() * 100) + 1,
        unit_price: Math.random() * 1000,
        total: Math.random() * 100000,
      },
    ],
    tax_rate: 0.1,
    due_date: '2024-12-31',
  });
  return apiCall('POST', `${BASE_URL}/api/invoice/create`, payload);
}

// Test: Concurrent Invoice List
export function stressInvoiceList() {
  const skip = Math.floor(Math.random() * 50);
  const limit = Math.floor(Math.random() * 20) + 1;
  return apiCall('GET', `${BASE_URL}/api/invoice/list?skip=${skip}&limit=${limit}`);
}

// Test: Concurrent Model Training
export function stressModelTrain() {
  const payload = JSON.stringify({
    name: `stress-model-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    task_type: ['classification', 'regression', 'clustering'][Math.floor(Math.random() * 3)],
    training_data: {
      features: Array.from({ length: 10 }, (_, i) => ({
        [`feature_${i}`]: Math.random() * 100,
      })),
      target: Array.from({ length: 10 }, () => Math.floor(Math.random() * 2)),
    },
    features: ['feature_0', 'feature_1', 'feature_2'],
    target: 'label',
  });
  return apiCall('POST', `${BASE_URL}/api/automl/train`, payload);
}

// Test: Concurrent Contract Generation
export function stressContractGenerate() {
  const contractTypes = ['nda', 'sla', 'msa', 'employment', 'consulting'];
  const payload = JSON.stringify({
    contract_type: contractTypes[Math.floor(Math.random() * contractTypes.length)],
    title: `Stress Contract ${Date.now()}`,
    parties: [`Party A ${Date.now()}`, `Party B ${Date.now()}`],
    terms: {
      value: Math.floor(Math.random() * 1000000),
      duration: `${Math.floor(Math.random() * 5) + 1} years`,
      jurisdiction: 'Delaware',
    },
  });
  return apiCall('POST', `${BASE_URL}/api/contracts/generate`, payload);
}

// Test: Concurrent Twin Creation
export function stressTwinCreate() {
  const payload = JSON.stringify({
    name: `stress-twin-${Date.now()}`,
    entity_type: ['factory', 'warehouse', 'store', 'office'][Math.floor(Math.random() * 4)],
    description: 'Stress test twin',
    initial_state: {
      metric1: Math.random() * 100,
      metric2: Math.random() * 100,
      metric3: Math.random() * 100,
    },
  });
  return apiCall('POST', `${BASE_URL}/api/twin/create`, payload);
}

// Test: Concurrent Twin State Updates
export function stressTwinUpdate(twinId) {
  const payload = JSON.stringify({
    state: {
      metric1: Math.random() * 100,
      metric2: Math.random() * 100,
      timestamp: new Date().toISOString(),
    },
  });
  return apiCall('POST', `${BASE_URL}/api/twin/${twinId}/state`, payload);
}

// Test: Concurrent Ranking Operations
export function stressRanking() {
  const payload = JSON.stringify({
    entities: Array.from({ length: 20 }, (_, i) => ({
      id: `entity-${i}`,
      score1: Math.random() * 1000,
      score2: Math.random() * 5,
      score3: Math.floor(Math.random() * 1000),
    })),
    ranking_config: {
      algorithm: ['weighted', 'page_rank', 'collaborative'][Math.floor(Math.random() * 3)],
    },
  });
  return apiCall('POST', `${BASE_URL}/api/ranking/score`, payload);
}

// Test: Concurrent GraphQL Queries
export function stressGraphQL() {
  const queries = [
    `{ agents(skip: 0, limit: 10) { id name type status } }`,
    `{ invoices(skip: 0, limit: 5) { id invoice_number status total } }`,
    `{ twins(skip: 0, limit: 5) { id name entity_type sync_status } }`,
  ];

  const payload = JSON.stringify({
    query: queries[Math.floor(Math.random() * queries.length)],
  });
  return apiCall('POST', `${BASE_URL}/graphql`, payload);
}

// Test: Concurrent Health Checks
export function stressHealthCheck() {
  return apiCall('GET', `${BASE_URL}/health`);
}

// Test: Concurrent Metrics Endpoint
export function stressMetrics() {
  return apiCall('GET', `${BASE_URL}/metrics`);
}

// Main stress test - random operations
export default function () {
  const operations = [
    () => stressHealthCheck(),
    () => stressAgentList(),
    () => stressAgentGet(),
    () => stressInvoiceCreate(),
    () => stressInvoiceList(),
    () => stressModelTrain(),
    () => stressContractGenerate(),
    () => stressTwinCreate(),
    () => stressRanking(),
    () => stressGraphQL(),
    () => stressMetrics(),
  ];

  // Execute 5-10 random operations per VU iteration
  const numOps = Math.floor(Math.random() * 6) + 5;
  for (let i = 0; i < numOps; i++) {
    const op = operations[Math.floor(Math.random() * operations.length)];
    op();
    sleep(Math.random() * 0.5 + 0.1); // 0.1-0.6s between requests
  }
}

// Setup - create test data
export function setup() {
  console.log('Stress test setup starting...');

  // Create test invoices
  const invoices = [];
  for (let i = 0; i < 10; i++) {
    const res = stressInvoiceCreate();
    if (res.status === 200 || res.status === 201) {
      try {
        const data = JSON.parse(res.body);
        invoices.push(data.id);
      } catch (e) {
        console.log('Failed to parse invoice response');
      }
    }
  }

  // Create test twins
  const twins = [];
  for (let i = 0; i < 5; i++) {
    const res = stressTwinCreate();
    if (res.status === 200 || res.status === 201) {
      try {
        const data = JSON.parse(res.body);
        twins.push(data.id);
      } catch (e) {
        console.log('Failed to parse twin response');
      }
    }
  }

  console.log(`Created ${invoices.length} invoices and ${twins.length} twins`);

  return { invoices, twins };
}

// Teardown - cleanup
export function teardown(data) {
  console.log('Stress test teardown...');
  console.log(`Test data: ${JSON.stringify(data)}`);
}