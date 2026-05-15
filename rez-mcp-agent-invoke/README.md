# REZ Agent Invoke MCP

MCP server for invoking and testing REZ AI agents.

## Available Agents

### Commerce Agents
- `reorder-predictor` - Predicts reorder probability
- `demand-forecast` - Forecasts product demand
- `price-optimizer` - Optimizes pricing

### User Agents
- `churn-risk` - Identifies churn risk
- `ltv-predictor` - Predicts lifetime value
- `personalization` - Personalizes recommendations

### Operations Agents
- `inventory-alert` - Alerts on low inventory
- `fraud-detection` - Detects fraud

## Tools

- `list_agents` - List all available agents
- `get_agent` - Get agent details
- `invoke_agent` - Invoke an agent with input
- `get_agent_history` - Get invocation history
- `test_agent` - Test an agent with sample data
- `compare_agents` - Compare multiple agents

## Usage

```bash
npm install
npm run build
npm start
```

## MCP Tools

### list_agents
Filter agents by category.

```json
{
  "category": "commerce"
}
```

### get_agent
Get detailed info about a specific agent.

```json
{
  "agentId": "churn-risk"
}
```

### invoke_agent
Invoke an agent with input data.

```json
{
  "agentId": "churn-risk",
  "userId": "user_123",
  "data": { "orderHistory": [...] }
}
```

### get_agent_history
Get recent invocations for an agent.

```json
{
  "agentId": "churn-risk",
  "limit": 10
}
```

### test_agent
Test an agent with sample data.

```json
{
  "agentId": "reorder-predictor",
  "testData": { "merchantId": "m_456", "userId": "u_789" }
}
```

### compare_agents
Compare outputs from multiple agents.

```json
{
  "agentIds": ["churn-risk", "ltv-predictor"],
  "input": { "userId": "user_123" }
}
```
