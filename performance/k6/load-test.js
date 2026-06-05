import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const agentListDuration = new Trend('agent_list_duration');
const agentGetDuration = new Trend('agent_get_duration');
const healthCheckDuration = new Trend('health_check_duration');
const invoiceCreateDuration = new Trend('invoice_create_duration');
const invoiceValidateDuration = new Trend('invoice_validate_duration');
const modelTrainDuration = new Trend('model_train_duration');
const contractGenerateDuration = new Trend('contract_generate_duration');
const twinCreateDuration = new Trend('twin_create_duration');
const rankingScoreDuration = new Trend('ranking_score_duration');
const graphqlQueryDuration = new Trend('graphql_query_duration');

const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 50 },   // Ramp down to 50 users
    { duration: '30s', target: 0 },  // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // Less than 1% failure rate
    errors: ['rate<0.05'],             // Less than 5% error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';

// Default headers
const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

// Test: Health Check
export function healthCheck() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/health`, { headers });

  const duration = Date.now() - start;
  healthCheckDuration.add(duration);

  check(res, {
    'health check status 200': (r) => r.status === 200,
    'health check has status field': (r) => JSON.parse(r.body).status !== undefined,
  }) || errorRate.add(1);

  sleep(1);
}

// Test: List Agents
export function listAgents(skip = 0, limit = 20) {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/agents?skip=${skip}&limit=${limit}`, { headers });

  const duration = Date.now() - start;
  agentListDuration.add(duration);

  const success = check(res, {
    'list agents status 200': (r) => r.status === 200,
    'list agents has agents array': (r) => JSON.parse(r.body).agents !== undefined,
    'list agents has pagination': (r) => JSON.parse(r.body).total !== undefined,
  }) || errorRate.add(1);

  if (!success) {
    console.log(`List agents failed: ${res.status} - ${res.body}`);
  }

  sleep(1);
}

// Test: Get Agent
export function getAgent(agentId = 'fraud-agent') {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/agents/${agentId}`, { headers });

  const duration = Date.now() - start;
  agentGetDuration.add(duration);

  const success = check(res, {
    'get agent status 200 or 404': (r) => r.status === 200 || r.status === 404,
    'get agent response is valid': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);

  sleep(1);
}

// Test: Create Invoice
export function createInvoice() {
  const payload = JSON.stringify({
    client_name: `Test Client ${Date.now()}`,
    client_email: `test-${Date.now()}@example.com`,
    line_items: [
      {
        description: 'Test Service',
        quantity: 1,
        unit_price: 100.0,
        total: 100.0,
      },
    ],
    tax_rate: 0.1,
    due_date: '2024-12-31',
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/invoice/create`, payload, { headers });

  const duration = Date.now() - start;
  invoiceCreateDuration.add(duration);

  const success = check(res, {
    'create invoice status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'create invoice has invoice id': (r) => {
      try {
        return JSON.parse(r.body).id !== undefined;
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);

  if (!success) {
    console.log(`Create invoice failed: ${res.status} - ${res.body}`);
  }

  sleep(1);
  return res;
}

// Test: Validate Invoice
export function validateInvoice(invoiceId) {
  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/invoice/validate/${invoiceId}`, null, { headers });

  const duration = Date.now() - start;
  invoiceValidateDuration.add(duration);

  check(res, {
    'validate invoice status 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);
}

// Test: Train AutoML Model
export function trainModel() {
  const payload = JSON.stringify({
    name: `test-model-${Date.now()}`,
    task_type: 'classification',
    training_data: {
      features: [
        { amount: 100, frequency: 5 },
        { amount: 500, frequency: 10 },
        { amount: 1000, frequency: 2 },
      ],
      target: [0, 1, 0],
    },
    features: ['amount', 'frequency'],
    target: 'is_fraud',
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/automl/train`, payload, { headers });

  const duration = Date.now() - start;
  modelTrainDuration.add(duration);

  const success = check(res, {
    'train model status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'train model has model id': (r) => {
      try {
        return JSON.parse(r.body).id !== undefined;
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);

  if (!success) {
    console.log(`Train model failed: ${res.status} - ${res.body}`);
  }

  sleep(1);
  return res;
}

// Test: Generate Contract
export function generateContract() {
  const payload = JSON.stringify({
    contract_type: 'nda',
    title: `Test Contract ${Date.now()}`,
    parties: ['Acme Corp', 'Test Partner'],
    terms: {
      duration: '1 year',
      jurisdiction: 'Delaware',
    },
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/contracts/generate`, payload, { headers });

  const duration = Date.now() - start;
  contractGenerateDuration.add(duration);

  const success = check(res, {
    'generate contract status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'generate contract has contract id': (r) => {
      try {
        return JSON.parse(r.body).id !== undefined;
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);

  if (!success) {
    console.log(`Generate contract failed: ${res.status} - ${res.body}`);
  }

  sleep(1);
  return res;
}

// Test: Create Digital Twin
export function createTwin() {
  const payload = JSON.stringify({
    name: `twin-${Date.now()}`,
    entity_type: 'test-entity',
    description: 'Test digital twin',
    initial_state: {
      temperature: 72.5,
      pressure: 14.7,
    },
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/twin/create`, payload, { headers });

  const duration = Date.now() - start;
  twinCreateDuration.add(duration);

  const success = check(res, {
    'create twin status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'create twin has twin id': (r) => {
      try {
        return JSON.parse(r.body).id !== undefined;
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);

  if (!success) {
    console.log(`Create twin failed: ${res.status} - ${res.body}`);
  }

  sleep(1);
  return res;
}

// Test: Ranking Score
export function scoreRanking() {
  const payload = JSON.stringify({
    entities: [
      { id: 'prod-1', sales: 1000, rating: 4.5 },
      { id: 'prod-2', sales: 5000, rating: 4.0 },
      { id: 'prod-3', sales: 200, rating: 4.8 },
    ],
    ranking_config: {
      algorithm: 'weighted',
      weights: { sales: 0.5, rating: 0.5 },
    },
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/ranking/score`, payload, { headers });

  const duration = Date.now() - start;
  rankingScoreDuration.add(duration);

  const success = check(res, {
    'ranking score status 200': (r) => r.status === 200,
    'ranking score has scores': (r) => {
      try {
        return JSON.parse(r.body).scores !== undefined;
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);

  if (!success) {
    console.log(`Ranking score failed: ${res.status} - ${res.body}`);
  }

  sleep(1);
}

// Test: GraphQL Query
export function graphqlQuery() {
  const payload = JSON.stringify({
    query: `
      query {
        agents(skip: 0, limit: 10) {
          id
          name
          type
        }
      }
    `,
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/graphql`, payload, { headers });

  const duration = Date.now() - start;
  graphqlQueryDuration.add(duration);

  const success = check(res, {
    'graphql query status 200': (r) => r.status === 200,
    'graphql query has data': (r) => {
      try {
        return JSON.parse(r.body).data !== undefined;
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);

  if (!success) {
    console.log(`GraphQL query failed: ${res.status} - ${res.body}`);
  }

  sleep(1);
}

// Main test scenarios
export default function () {
  // Health check
  healthCheck();

  // Agent operations
  listAgents(0, 20);
  getAgent('fraud-agent');
  listAgents(Math.floor(Math.random() * 100), 10);

  // Invoice operations
  createInvoice();

  // Model operations
  trainModel();

  // Contract operations
  generateContract();

  // Twin operations
  createTwin();

  // Ranking
  scoreRanking();

  // GraphQL
  graphqlQuery();
}