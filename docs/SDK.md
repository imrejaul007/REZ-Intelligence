# REZ Agent OS - SDK Documentation

Complete SDK documentation for the REZ Agent OS ecosystem.

## Available SDKs

| SDK | Language | Package Manager | Status |
|-----|----------|-----------------|--------|
| [TypeScript/Node.js](https://github.com/rez-io/rez/tree/main/rez-sdk) | TypeScript | npm | ✅ Stable |
| [Python](https://github.com/rez-io/rez/tree/main/rez-python-sdk) | Python 3.10+ | pip | ✅ Stable |
| [Go](https://github.com/rez-io/rez/tree/main/rez-go-sdk) | Go 1.21+ | go mod | ✅ Stable |
| [Java](https://github.com/rez-io/rez/tree/main/rez-java-sdk) | Java 17+ | Maven/Gradle | ✅ Stable |
| [Ruby](https://github.com/rez-io/rez/tree/main/rez-ruby-sdk) | Ruby 3.0+ | gem | ✅ Stable |

---

## Installation

### TypeScript / Node.js

```bash
npm install @rez/sdk
# or
yarn add @rez/sdk
# or
pnpm add @rez/sdk
```

### Python

```bash
pip install rez-sdk
# or
uv add rez-sdk
```

### Go

```bash
go get github.com/rez-io/rez-go
```

### Java

```xml
<!-- Maven -->
<dependency>
    <groupId>io.rez</groupId>
    <artifactId>rez-java-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

```groovy
// Gradle
implementation 'io.rez:rez-java-sdk:1.0.0'
```

### Ruby

```ruby
# Gemfile
gem 'rez-sdk', '~> 1.0'
```

```bash
bundle install
```

---

## Quick Start

### TypeScript

```typescript
import { REZClient } from '@rez/sdk';

const client = new REZClient({
  baseUrl: 'https://api.rez.io',
  apiKey: 'your-api-key'
});

// List agents
const agents = await client.agents.list();
console.log(`Found ${agents.total} agents`);

// Train a model
const model = await client.automl.train({
  name: 'fraud-detector',
  taskType: 'classification',
  trainingData: { features: [...], target: [...] },
  features: ['amount', 'frequency'],
  target: 'is_fraud'
});
```

### Python

```python
from rez_sdk import REZClient

async with REZClient(base_url="https://api.rez.io", api_key="your-key") as client:
    # List agents
    agents = await client.agents.list_agents()
    print(f"Found {agents.total} agents")

    # Train a model
    model = await client.automl.train_model(
        name="fraud-detector",
        task_type="classification",
        training_data={"features": [...], "target": [...]},
        features=["amount", "frequency"],
        target="is_fraud"
    )
```

### Go

```go
client, _ := rez.NewClient(
    rez.WithBaseURL("https://api.rez.io"),
    rez.WithAPIKey("your-api-key"),
)

// List agents
agents, _ := client.Agents.List(ctx, 0, 10)
fmt.Printf("Found %d agents\n", agents.Total)

// Train model
model, _ := client.AutoML.TrainModel(ctx, rez.AutoMLTrainRequest{
    Name: "fraud-detector",
    TaskType: "classification",
    // ...
})
```

### Java

```java
try (REZClient client = REZClient.builder()
    .baseUrl("https://api.rez.io")
    .apiKey("your-api-key")
    .build()) {

    // List agents
    AgentList agents = client.agents().list(0, 10);
    System.out.println("Found " + agents.total + " agents");

    // Train model
    AutoMLModel model = client.automl().train(new AutoMLTrainRequest("fraud-detector", "classification"));
}
```

### Ruby

```ruby
require 'rez'

client = REZ.client(base_url: 'https://api.rez.io', api_key: 'your-key')

# List agents
agents = client.agents.list
puts "Found #{agents['total']} agents"

# Train model
model = client.automl.train(
  name: 'fraud-detector',
  task_type: 'classification',
  training_data: { features: [...], target: [...] },
  features: ['amount', 'frequency'],
  target: 'is_fraud'
)
```

---

## Services

All SDKs provide access to the following services:

### Agent Registry

Manage AI agents (registration, discovery, lifecycle).

```typescript
// List agents
const agents = await client.agents.list();

// Get agent
const agent = await client.agents.get('fraud-agent');

// Create agent
const newAgent = await client.agents.create({
  name: 'sales-bot',
  type: 'sales',
  capabilities: ['lead_scoring']
});

// Update agent
const updated = await client.agents.update('agent-id', { status: 'active' });

// Delete agent
await client.agents.delete('agent-id');
```

### AutoML

Automated machine learning model training and inference.

```typescript
// Train model
const model = await client.automl.train({
  name: 'fraud-detector',
  taskType: 'classification',
  trainingData: { features: [...], target: [...] },
  features: ['amount', 'frequency', 'location'],
  target: 'is_fraud'
});

// Predict
const predictions = await client.automl.predict(model.id, {
  features: [{ amount: 250, frequency: 10, location: 'US' }]
});
```

### Invoice

Invoice generation, validation, and management.

```typescript
// Create invoice
const invoice = await client.invoice.create({
  clientName: 'Acme Corp',
  clientEmail: 'billing@acme.com',
  lineItems: [
    { description: 'Web Development', quantity: 40, unitPrice: 150, total: 6000 }
  ],
  taxRate: 0.1,
  dueDate: '2024-12-31'
});

// Validate
const validation = await client.invoice.validate(invoice.id);
```

### Contracts

Contract generation, analysis, and management.

```typescript
// Generate contract
const contract = await client.contracts.generate({
  contractType: 'nda',
  title: 'Mutual NDA',
  parties: ['Acme Corp', 'Partner Inc'],
  terms: { duration: '2 years', jurisdiction: 'Delaware' }
});

// Analyze
const analysis = await client.contracts.analyze(contract.id);
```

### Digital Twin

Digital twin models and real-time synchronization.

```typescript
// Create twin
const twin = await client.twin.create({
  name: 'Factory-001',
  entityType: 'factory',
  initialState: { temperature: 72.5, pressure: 14.7 }
});

// Update state
await client.twin.updateState(twin.id, { temperature: 73.0 });

// Sync
await client.twin.sync(twin.id);
```

### Ranking

Ranking and recommendation algorithms.

```typescript
// Score entities
const result = await client.ranking.score({
  entities: [
    { id: 'prod-1', sales: 1000, rating: 4.5 },
    { id: 'prod-2', sales: 5000, rating: 4.0 }
  ],
  rankingConfig: {
    algorithm: 'weighted',
    weights: { sales: 0.5, rating: 0.5 }
  }
});

// Get top K
const topK = await client.ranking.getTopK(entities, 10, 'weighted');
```

### GraphQL

Unified GraphQL API access.

```typescript
// Execute query
const result = await client.graphql.execute({
  query: `
    query GetAgents($type: String) {
      agents(type: $type) { id name status }
    }
  `,
  variables: { type: 'sales' }
});
```

---

## Authentication

### API Key

```typescript
const client = new REZClient({
  baseUrl: 'https://api.rez.io',
  apiKey: 'your-api-key'
});
```

### JWT Token

```typescript
const client = new REZClient({
  baseUrl: 'https://api.rez.io',
  jwtToken: 'your-jwt-token'
});
```

---

## Error Handling

### TypeScript

```typescript
try {
  const agent = await client.agents.get('non-existent');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Agent not found');
  } else if (error instanceof AuthenticationError) {
    console.log('Auth failed');
  } else if (error instanceof RateLimitError) {
    console.log('Rate limited');
  }
}
```

### Python

```python
from rez_sdk import REZClient, NotFoundError, RateLimitError

try:
    agent = await client.agents.get_agent('non-existent')
except NotFoundError:
    print('Agent not found')
except RateLimitError:
    print('Rate limited')
```

### Go

```go
import "github.com/rez-io/rez-go/rez"

agent, err := client.Agents.Get(ctx, "non-existent")
if err != nil {
    if rez.IsNotFound(err) {
        fmt.Println("Agent not found")
    }
}
```

### Java

```java
try {
    Agent agent = client.agents().get("non-existent");
} catch (REZException e) {
    if (e instanceof APIException) {
        APIException apiEx = (APIException) e;
        if (apiEx.isNotFound()) {
            System.out.println("Agent not found");
        }
    }
}
```

### Ruby

```ruby
begin
  agent = client.agents.get('non-existent')
rescue REZ::NotFoundError => e
  puts "Agent not found"
rescue REZ::RateLimitError => e
  puts "Rate limited"
end
```

---

## Configuration

### Timeouts

```typescript
const client = new REZClient({
  baseUrl: 'https://api.rez.io',
  timeout: 60000,  // 60 seconds
  maxRetries: 5
});
```

### Retry Logic

```typescript
const client = new REZClient({
  baseUrl: 'https://api.rez.io',
  maxRetries: 3,
  retryDelay: 1000  // 1 second base delay
});
```

---

## Health Checks

### Check Single Service

```typescript
const health = await client.agents.healthCheck();
console.log(`Status: ${health.status}`);
```

### Check All Services

```typescript
const health = await client.healthCheckAll();
for (const [service, status] of Object.entries(health)) {
  console.log(`${service}: ${status.status}`);
}
```

---

## SDK Features Comparison

| Feature | TypeScript | Python | Go | Java | Ruby |
|---------|------------|--------|-----|------|------|
| Async/await | ✅ | ✅ | ✅ | ✅ | ❌ |
| Sync support | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auto-retry | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rate limiting | ✅ | ✅ | ✅ | ✅ | ✅ |
| Streaming | ✅ | ❌ | ❌ | ❌ | ❌ |
| Webhooks | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Community SDKs

Building a SDK in another language? Let us know and we can add it here!

Current community SDKs:
- *None yet - be the first!*

---

## Support

- **Documentation**: https://docs.rez.io
- **SDK Issues**: https://github.com/rez-io/rez/issues
- **Discord**: https://discord.gg/rez