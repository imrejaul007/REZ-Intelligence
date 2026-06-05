import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const spikeErrorRate = new Rate('spike_errors');
const spikeLatency = new Trend('spike_latency');
const spikeThroughput = new Trend('spike_throughput');

// Test configuration - spike test for sudden load increases
export const options = {
  stages: [
    { duration: '30s', target: 10 },    // Baseline: 10 users
    { duration: '10s', target: 1000 },  // SPIKE: jump to 1000 users
    { duration: '30s', target: 1000 },  // Hold spike for 30 seconds
    { duration: '30s', target: 10 },    // Recover to baseline
    { duration: '30s', target: 0 },     // Wind down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],   // 95% under 1 second even under spike
    http_req_failed: ['rate<0.10'],      // Allow up to 10% failures during spike
    spike_errors: ['rate<0.15'],         // Allow up to 15% error rate during spike
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

// Spike test operations
function spikeRequest(method, url, payload = null) {
  const start = Date.now();
  const body = payload ? payload : null;
  const res = http.request(method, url, body, { headers });
  const duration = Date.now() - start;

  spikeLatency.add(duration);

  const success = check(res, {
    'request success': (r) => r.status >= 200 && r.status < 500, // Allow 4xx during spike
  });

  if (!success) {
    spikeErrorRate.add(1);
  }

  return res;
}

// Test: Simple health check
export function spikeHealthCheck() {
  return spikeRequest('GET', `${BASE_URL}/health`);
}

// Test: Agent list
export function spikeAgentList() {
  return spikeRequest('GET', `${BASE_URL}/api/agents?skip=0&limit=10`);
}

// Test: Invoice create
export function spikeInvoiceCreate() {
  const payload = JSON.stringify({
    client_name: `Spike Client ${Date.now()}`,
    client_email: `spike-${Date.now()}@test.com`,
    line_items: [
      {
        description: 'Spike test item',
        quantity: 1,
        unit_price: 100,
        total: 100,
      },
    ],
    tax_rate: 0.1,
    due_date: '2024-12-31',
  });
  return spikeRequest('POST', `${BASE_URL}/api/invoice/create`, payload);
}

// Test: Model train
export function spikeModelTrain() {
  const payload = JSON.stringify({
    name: `spike-model-${Date.now()}`,
    task_type: 'classification',
    training_data: {
      features: [{ f1: 1, f2: 2 }, { f1: 3, f2: 4 }],
      target: [0, 1],
    },
    features: ['f1', 'f2'],
    target: 'label',
  });
  return spikeRequest('POST', `${BASE_URL}/api/automl/train`, payload);
}

// Test: Contract generate
export function spikeContractGenerate() {
  const payload = JSON.stringify({
    contract_type: 'nda',
    title: `Spike Contract ${Date.now()}`,
    parties: ['Spike A', 'Spike B'],
    terms: { duration: '1 year' },
  });
  return spikeRequest('POST', `${BASE_URL}/api/contracts/generate`, payload);
}

// Test: Twin create
export function spikeTwinCreate() {
  const payload = JSON.stringify({
    name: `spike-twin-${Date.now()}`,
    entity_type: 'test',
    initial_state: { value: 100 },
  });
  return spikeRequest('POST', `${BASE_URL}/api/twin/create`, payload);
}

// Test: Ranking
export function spikeRanking() {
  const payload = JSON.stringify({
    entities: [
      { id: '1', score: 100 },
      { id: '2', score: 200 },
    ],
    ranking_config: { algorithm: 'weighted' },
  });
  return spikeRequest('POST', `${BASE_URL}/api/ranking/score`, payload);
}

// Test: GraphQL
export function spikeGraphQL() {
  const payload = JSON.stringify({
    query: '{ agents(skip: 0, limit: 5) { id name } }',
  });
  return spikeRequest('POST', `${BASE_URL}/graphql`, payload);
}

// Main spike test - rapid-fire requests
export default function () {
  const operations = [
    spikeHealthCheck,
    spikeAgentList,
    spikeInvoiceCreate,
    spikeModelTrain,
    spikeContractGenerate,
    spikeTwinCreate,
    spikeRanking,
    spikeGraphQL,
  ];

  // Execute as many operations as possible
  for (let i = 0; i < operations.length; i++) {
    operations[i]();
  }
}