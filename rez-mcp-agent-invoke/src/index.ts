import logger from './utils/logger.js';

import 'dotenv/config';
import { randomUUID, randomBytes } from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

/**
 * Generate a random number between 0 and 1 using crypto
 */
function cryptoRandom(): number {
  return Number(randomBytes(4).readUInt32BE(0)) / 0xFFFFFFFF;
}

// Environment configuration
const AGENT_ORCHESTRATOR_URL = process.env.AGENT_ORCHESTRATOR_URL || 'http://localhost:4062';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const USE_REAL_AGENTS = process.env.USE_REAL_AGENTS === 'true';

// Agent Registry
const agentRegistry: Record<string, Agent> = {
  // Commerce Agents
  'reorder-predictor': {
    id: 'reorder-predictor',
    name: 'Reorder Predictor Agent',
    category: 'commerce',
    description: 'Predicts when users will reorder from merchants',
    capabilities: ['predict_reorder', 'calculate_reorder_score', 'suggest_items'],
    endpoint: process.env.REORDER_ENGINE_URL || 'http://localhost:4040',
    apiPath: '/api/reorder/predict',
    status: 'active'
  },
  'demand-forecast': {
    id: 'demand-forecast',
    name: 'Demand Forecast Agent',
    category: 'commerce',
    description: 'Forecasts demand for products',
    capabilities: ['forecast_demand', 'identify_trends', 'seasonal_analysis'],
    endpoint: process.env.DEMAND_FORECAST_URL || 'http://localhost:4042',
    apiPath: '/api/forecast',
    status: 'active'
  },
  'price-optimizer': {
    id: 'price-optimizer',
    name: 'Price Optimizer Agent',
    category: 'commerce',
    description: 'Optimizes pricing based on demand and competition',
    capabilities: ['suggest_price', 'analyze_elasticity', 'competitive_pricing'],
    endpoint: process.env.PRICE_OPTIMIZER_URL || 'http://localhost:4043',
    apiPath: '/api/price',
    status: 'active'
  },
  // User Agents
  'churn-risk': {
    id: 'churn-risk',
    name: 'Churn Risk Agent',
    category: 'user',
    description: 'Identifies users at risk of churning',
    capabilities: ['score_churn_risk', 'identify_factors', 'suggest_retention'],
    endpoint: AGENT_ORCHESTRATOR_URL,
    apiPath: '/api/agents/churn-risk',
    status: 'active'
  },
  'ltv-predictor': {
    id: 'ltv-predictor',
    name: 'LTV Predictor Agent',
    category: 'user',
    description: 'Predicts customer lifetime value',
    capabilities: ['predict_ltv', 'segment_by_value', 'identify_high_value'],
    endpoint: AGENT_ORCHESTRATOR_URL,
    apiPath: '/api/agents/ltv-predictor',
    status: 'active'
  },
  'personalization': {
    id: 'personalization',
    name: 'Personalization Agent',
    category: 'user',
    description: 'Personalizes content and recommendations',
    capabilities: ['personalize_recommendations', 'build_user_profile', 'taste_analysis'],
    endpoint: AGENT_ORCHESTRATOR_URL,
    apiPath: '/api/agents/personalization',
    status: 'active'
  },
  // Operations Agents
  'inventory-alert': {
    id: 'inventory-alert',
    name: 'Inventory Alert Agent',
    category: 'operations',
    description: 'Alerts on low inventory levels',
    capabilities: ['check_stock', 'predict_stockout', 'suggest_reorder'],
    endpoint: AGENT_ORCHESTRATOR_URL,
    apiPath: '/api/agents/inventory-alert',
    status: 'active'
  },
  'fraud-detection': {
    id: 'fraud-detection',
    name: 'Fraud Detection Agent',
    category: 'operations',
    description: 'Detects fraudulent transactions',
    capabilities: ['score_transaction', 'identify_patterns', 'block_suspicious'],
    endpoint: AGENT_ORCHESTRATOR_URL,
    apiPath: '/api/agents/fraud-detection',
    status: 'active'
  }
};

interface Agent {
  id: string;
  name: string;
  category: 'commerce' | 'user' | 'operations' | 'marketing';
  description: string;
  capabilities: string[];
  endpoint: string;
  apiPath: string;
  status: 'active' | 'inactive' | 'training';
}

interface AgentInvocation {
  id: string;
  agentId: string;
  input: Record<string, unknown>;
  output?: unknown;
  confidence?: number;
  reasoning?: string;
  timestamp: string;
  latency: number;
  success: boolean;
  error?: string;
  source: 'real' | 'mock';
}

// Invocation history
const invocationHistory: AgentInvocation[] = [];

// Real API helper
async function invokeRealAgent(agent: Agent, input: Record<string, unknown>): Promise<{ output: unknown; confidence: number; reasoning?: string }> {
  const response = await fetch(`${agent.endpoint}${agent.apiPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_SERVICE_TOKEN
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Agent API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return {
    output: result.output || result.data || result,
    confidence: result.confidence || result.score || 0.85,
    reasoning: result.reasoning || result.explanation
  };
}

// MCP Tools
const tools = [
  {
    name: 'list_agents',
    description: 'List all available AI agents in the REZ ecosystem.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['commerce', 'user', 'operations', 'marketing'],
          description: 'Filter by agent category'
        }
      }
    }
  },
  {
    name: 'get_agent',
    description: 'Get detailed information about a specific agent.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', required: true }
      },
      required: ['agentId']
    }
  },
  {
    name: 'invoke_agent',
    description: 'Invoke an AI agent with input data and get a response.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent ID (e.g., reorder-predictor, churn-risk)', required: true },
        userId: { type: 'string', description: 'User ID for user-specific agents' },
        merchantId: { type: 'string', description: 'Merchant ID for merchant-specific agents' },
        data: { type: 'object', description: 'Additional input data for the agent' }
      },
      required: ['agentId']
    }
  },
  {
    name: 'get_agent_history',
    description: 'Get invocation history for an agent.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', required: true },
        limit: { type: 'number', default: 10 }
      },
      required: ['agentId']
    }
  },
  {
    name: 'test_agent',
    description: 'Test an agent with sample data and return structured results.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', required: true },
        testData: { type: 'object', description: 'Test input data', required: true }
      },
      required: ['agentId', 'testData']
    }
  },
  {
    name: 'compare_agents',
    description: 'Compare outputs from multiple agents for the same input.',
    inputSchema: {
      type: 'object',
      properties: {
        agentIds: { type: 'array', items: { type: 'string' }, required: true },
        input: { type: 'object', description: 'Common input for all agents', required: true }
      },
      required: ['agentIds', 'input']
    }
  }
];

// Tool handlers
async function handleListAgents(args: Record<string, unknown>): Promise<string> {
  let agents = Object.values(agentRegistry);

  if (args.category) {
    agents = agents.filter(a => a.category === args.category);
  }

  return JSON.stringify({
    count: agents.length,
    agents: agents.map(a => ({
      id: a.id,
      name: a.name,
      category: a.category,
      description: a.description,
      capabilities: a.capabilities,
      status: a.status,
      endpoint: USE_REAL_AGENTS ? a.endpoint : 'mock'
    })),
    realAgents: USE_REAL_AGENTS
  }, null, 2);
}

async function handleGetAgent(args: Record<string, unknown>): Promise<string> {
  const agent = agentRegistry[args.agentId as string];

  if (!agent) {
    return JSON.stringify({
      error: 'Agent not found',
      available: Object.keys(agentRegistry)
    });
  }

  return JSON.stringify({
    ...agent,
    endpoint: USE_REAL_AGENTS ? agent.endpoint : 'mock'
  }, null, 2);
}

async function handleInvokeAgent(args: Record<string, unknown>): Promise<string> {
  const agent = agentRegistry[args.agentId as string];
  const startTime = Date.now();
  const invocationId = `inv_${Date.now()}_${randomUUID().replace(/-/g, '').substring(0, 8)}`;

  if (!agent) {
    return JSON.stringify({
      success: false,
      error: 'Agent not found',
      available: Object.keys(agentRegistry)
    });
  }

  const input = {
    userId: args.userId,
    merchantId: args.merchantId,
    ...(args.data as Record<string, unknown>)
  };

  try {
    let output: unknown;
    let confidence = 0.85;
    let reasoning = 'Analysis complete';
    let source: 'real' | 'mock' = 'mock';

    // Try real agent if enabled
    if (USE_REAL_AGENTS) {
      try {
        const result = await invokeRealAgent(agent, input);
        output = result.output;
        confidence = result.confidence;
        reasoning = result.reasoning || 'Real agent analysis';
        source = 'real';
      } catch (error) {
        logger.error(`Real agent failed, falling back to mock: ${error}`);
        // Fall through to mock
      }
    }

    // Use mock if real failed or not enabled
    if (source === 'mock') {
      const mockResult = simulateAgentInvocation(agent, args);
      output = mockResult.output;
      confidence = mockResult.confidence;
      reasoning = mockResult.reasoning;
    }

    const latency = Date.now() - startTime;

    const invocation: AgentInvocation = {
      id: invocationId,
      agentId: agent.id,
      input,
      output,
      confidence,
      reasoning,
      timestamp: new Date().toISOString(),
      latency,
      success: true,
      source
    };

    invocationHistory.unshift(invocation);
    if (invocationHistory.length > 100) invocationHistory.pop();

    return JSON.stringify({
      success: true,
      invocationId,
      agentId: agent.id,
      agentName: agent.name,
      output,
      confidence,
      reasoning,
      latency: `${latency}ms`,
      timestamp: invocation.timestamp,
      source
    }, null, 2);
  } catch (error) {
    const latency = Date.now() - startTime;

    const invocation: AgentInvocation = {
      id: invocationId,
      agentId: agent.id,
      input,
      timestamp: new Date().toISOString(),
      latency,
      success: false,
      error: String(error),
      source: 'mock'
    };

    invocationHistory.unshift(invocation);

    return JSON.stringify({
      success: false,
      invocationId,
      agentId: agent.id,
      error: String(error),
      latency: `${latency}ms`,
      source: 'mock'
    }, null, 2);
  }
}

function simulateAgentInvocation(agent: Agent, args: Record<string, unknown>): { output: unknown; confidence: number; reasoning: string } {
  // Simulate different agent outputs based on agent type
  switch (agent.id) {
    case 'reorder-predictor':
      return {
        output: {
          score: cryptoRandom() * 100,
          predictedItems: [
            { name: 'Margherita Pizza', probability: 0.92 },
            { name: 'Garlic Bread', probability: 0.78 }
          ],
          nextOrderDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        confidence: 0.89,
        reasoning: 'Based on order history and time patterns'
      };
    case 'churn-risk':
      return {
        output: {
          score: cryptoRandom(),
          riskLevel: cryptoRandom() > 0.5 ? 'high' : 'medium',
          factors: [
            '30+ days since last order',
            'Decreasing order frequency',
            'No engagement with nudges'
          ],
          recommendations: [
            'Send win-back offer',
            'Highlight popular new items',
            'Offer loyalty points bonus'
          ]
        },
        confidence: 0.82,
        reasoning: 'Based on engagement metrics and behavioral patterns'
      };
    case 'demand-forecast':
      return {
        output: {
          forecast: {
            next7days: Math.floor(cryptoRandom() * 1000) + 500,
            trend: 'increasing',
            seasonality: 'peak_hours'
          }
        },
        confidence: 0.78,
        reasoning: 'Based on historical sales and seasonal data'
      };
    case 'price-optimizer':
      return {
        output: {
          currentPrice: 299,
          suggestedPrice: Math.floor(299 * (0.9 + cryptoRandom() * 0.2)),
          elasticity: -1.2,
          competitors: { avg: 320, range: [280, 350] }
        },
        confidence: 0.75,
        reasoning: 'Based on demand elasticity and competitor analysis'
      };
    case 'ltv-predictor':
      return {
        output: {
          predictedLTV: Math.floor(cryptoRandom() * 50000) + 10000,
          tier: 'high_value',
          monthsActive: Math.floor(cryptoRandom() * 24) + 6
        },
        confidence: 0.81,
        reasoning: 'Based on transaction history and user behavior'
      };
    case 'personalization':
      return {
        output: {
          userProfile: {
            cuisine: ['Italian', 'Mexican'],
            priceRange: 'medium',
            diet: ['vegetarian']
          },
          topRecommendations: [
            { item: 'Veggie Supreme Pizza', score: 0.95 },
            { item: 'Veg Tacos', score: 0.88 }
          ]
        },
        confidence: 0.87,
        reasoning: 'Based on order history and preference patterns'
      };
    case 'inventory-alert':
      return {
        output: {
          lowStockItems: [
            { item: 'Mozzarella Cheese', current: 5, threshold: 20 },
            { item: 'Olive Oil', current: 3, threshold: 15 }
          ],
          predictedStockout: [
            { item: 'Mozzarella Cheese', daysUntilStockout: 2 }
          ]
        },
        confidence: 0.84,
        reasoning: 'Based on consumption rate and lead time'
      };
    case 'fraud-detection':
      return {
        output: {
          fraudScore: cryptoRandom() * 0.3,
          riskLevel: 'low',
          signals: [
            'Normal transaction amount',
            'Known device',
            'Consistent location'
          ]
        },
        confidence: 0.91,
        reasoning: 'Based on transaction patterns and device signals'
      };
    default:
      return {
        output: {
          result: 'Analysis complete',
          metadata: { agent: agent.id, processed: true }
        },
        confidence: 0.80,
        reasoning: 'Analysis complete'
      };
  }
}

async function handleGetAgentHistory(args: Record<string, unknown>): Promise<string> {
  const history = invocationHistory
    .filter(i => i.agentId === args.agentId)
    .slice(0, (args.limit as number) || 10);

  return JSON.stringify({
    agentId: args.agentId,
    count: history.length,
    history: history.map(h => ({
      id: h.id,
      timestamp: h.timestamp,
      latency: `${h.latency}ms`,
      success: h.success,
      output: h.output,
      error: h.error,
      source: h.source
    }))
  }, null, 2);
}

async function handleTestAgent(args: Record<string, unknown>): Promise<string> {
  const agent = agentRegistry[args.agentId as string];

  if (!agent) {
    return JSON.stringify({ error: 'Agent not found' });
  }

  const startTime = Date.now();
  const input = { data: args.testData };
  let source: 'real' | 'mock' = 'mock';
  let output: unknown;

  // Try real agent if enabled
  if (USE_REAL_AGENTS) {
    try {
      const result = await invokeRealAgent(agent, input);
      output = result.output;
      source = 'real';
    } catch {
      // Fall through to mock
    }
  }

  // Use mock if real failed or not enabled
  if (source === 'mock') {
    output = simulateAgentInvocation(agent, input).output;
  }

  const latency = Date.now() - startTime;

  return JSON.stringify({
    success: true,
    agentId: agent.id,
    agentName: agent.name,
    testData: args.testData,
    output,
    latency: `${latency}ms`,
    capabilities: agent.capabilities,
    source
  }, null, 2);
}

async function handleCompareAgents(args: Record<string, unknown>): Promise<string> {
  const results = [];
  const agentIds = args.agentIds as string[];
  const input = args.input as Record<string, unknown>;

  for (const agentId of agentIds) {
    const agent = agentRegistry[agentId];
    if (agent) {
      const startTime = Date.now();
      let output: unknown;
      let source: 'real' | 'mock' = 'mock';

      // Try real agent if enabled
      if (USE_REAL_AGENTS) {
        try {
          const result = await invokeRealAgent(agent, input);
          output = result.output;
          source = 'real';
        } catch {
          // Fall through to mock
        }
      }

      // Use mock if real failed or not enabled
      if (source === 'mock') {
        output = simulateAgentInvocation(agent, { data: input }).output;
      }

      results.push({
        agentId,
        agentName: agent.name,
        output,
        latency: Date.now() - startTime,
        source
      });
    }
  }

  return JSON.stringify({
    comparisonId: `cmp_${Date.now()}`,
    input,
    results,
    timestamp: new Date().toISOString(),
    realAgents: USE_REAL_AGENTS
  }, null, 2);
}

// Create MCP Server
const server = new Server(
  {
    name: 'rez-agent-invoke',
    version: '1.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case 'list_agents':
        result = await handleListAgents(args || {});
        break;
      case 'get_agent':
        result = await handleGetAgent(args || {});
        break;
      case 'invoke_agent':
        result = await handleInvokeAgent(args || {});
        break;
      case 'get_agent_history':
        result = await handleGetAgentHistory(args || {});
        break;
      case 'test_agent':
        result = await handleTestAgent(args || {});
        break;
      case 'compare_agents':
        result = await handleCompareAgents(args || {});
        break;
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }

    return { content: [{ type: 'text', text: result }] };
  } catch (error) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }], isError: true };
  }
});

async function main() {
  logger.error('REZ Agent Invoke MCP running on stdio');
  logger.error(`Agent Orchestrator URL: ${AGENT_ORCHESTRATOR_URL}`);
  logger.error(`Real Agents: ${USE_REAL_AGENTS ? 'ENABLED' : 'DISABLED (set USE_REAL_AGENTS=true to enable)'}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
