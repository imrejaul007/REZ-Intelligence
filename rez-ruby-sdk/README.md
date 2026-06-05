# REZ Ruby SDK

A Ruby client for the REZ Agent OS ecosystem. Simple, idiomatic Ruby with automatic retry and comprehensive error handling.

## Installation

### Bundler

```ruby
# Add to Gemfile
gem 'rez-sdk', '~> 1.0'
```

```bash
bundle install
```

### Manual

```bash
gem install rez-sdk
```

## Quick Start

```ruby
require 'rez'

# Create client
client = REZ.client(base_url: 'http://localhost:8080', api_key: 'your-key')

# List agents
agents = client.agents.list
puts "Found #{agents['total']} agents"

# Get single agent
agent = client.agents.get('fraud-agent')
puts "Agent: #{agent['name']}"
```

## Configuration

```ruby
client = REZ.client(
  base_url: 'https://api.rez.io',  # API base URL
  api_key: 'your-key',            # API key
  timeout: 30,                    # Request timeout (seconds)
  max_retries: 3                  # Max retry attempts
)
```

Or use block syntax:

```ruby
REZ.connect(base_url: 'https://api.rez.io', api_key: 'key') do |client|
  agents = client.agents.list
end
```

## Agent Service

```ruby
# List agents
agents = client.agents.list(skip: 0, limit: 20)

# Get agent
agent = client.agents.get('fraud-agent')

# Create agent
agent = client.agents.create(
  name: 'sales-bot',
  type: 'sales',
  capabilities: ['lead_scoring', 'recommendation']
)

# Update agent
updated = client.agents.update('agent-id', status: 'active')

# Delete agent
client.agents.delete('agent-id')

# Health check
health = client.agents.health_check
```

## AutoML Service

```ruby
# Train model
model = client.automl.train(
  name: 'fraud-detector',
  task_type: 'classification',
  training_data: {
    features: [
      { amount: 100, frequency: 5 },
      { amount: 5000, frequency: 1 }
    ],
    target: [0, 1]
  },
  features: ['amount', 'frequency'],
  target: 'is_fraud'
)

# Predict
predictions = client.automl.predict(model['id'], [
  { amount: 250, frequency: 10 }
])

# List models
models = client.automl.list_models
```

## Invoice Service

```ruby
# Create invoice
invoice = client.invoice.create(
  client_name: 'Acme Corp',
  client_email: 'billing@acme.com',
  line_items: [
    {
      description: 'Web Development',
      quantity: 40,
      unit_price: 150.0,
      total: 6000.0
    }
  ],
  tax_rate: 0.1,
  due_date: '2024-12-31'
)

# Get invoice
invoice = client.invoice.get('invoice-id')

# List invoices
invoices = client.invoice.list(status: 'paid')

# Validate
validation = client.invoice.validate('invoice-id')
```

## Contracts Service

```ruby
# Generate contract
contract = client.contracts.generate(
  contract_type: 'nda',
  title: 'Mutual NDA',
  parties: ['Acme Corp', 'Partner Inc'],
  terms: {
    duration: '2 years',
    jurisdiction: 'Delaware'
  }
)

# Analyze
analysis = client.contracts.analyze(contract['id'])
```

## Legal Service

```ruby
# Legal research
results = client.legal.research('GDPR compliance', jurisdiction: 'EU')

# Analyze document
analysis = client.legal.analyze_document('Contract text here...')

# Check compliance
compliance = client.legal.check_compliance(
  ['SOC2', 'HIPAA'],
  context: { industry: 'healthcare' }
)
```

## Digital Twin Service

```ruby
# Create twin
twin = client.twin.create(
  name: 'Factory-001',
  entity_type: 'factory',
  initial_state: {
    temperature: 72.5,
    pressure: 14.7
  }
)

# Get state
state = client.twin.get_state(twin['id'])

# Update state
client.twin.update_state(twin['id'], { temperature: 73.0 })

# Sync
result = client.twin.sync(twin['id'])
```

## Ranking Service

```ruby
# Score entities
result = client.ranking.score(
  entities: [
    { id: 'prod-1', sales: 1000, rating: 4.5 },
    { id: 'prod-2', sales: 5000, rating: 4.0 }
  ],
  ranking_config: {
    algorithm: 'weighted',
    weights: { sales: 0.5, rating: 0.5 }
  }
)

# Get top K
top_k = client.ranking.top_k(entities, k: 10, algorithm: 'weighted')
```

## GraphQL Service

```ruby
# Simple query
result = client.graphql.execute(
  '{ agents(skip: 0, limit: 10) { id name type } }'
)

# Query with variables
result = client.graphql.execute(
  'query GetAgents($type: String) { agents(type: $type) { id name } }',
  variables: { type: 'sales' }
)
```

## Error Handling

```ruby
require 'rez'

begin
  agent = client.agents.get('non-existent')
rescue REZ::NotFoundError => e
  puts "Agent not found: #{e.message}"
rescue REZ::AuthenticationError => e
  puts "Auth failed: #{e.message}"
rescue REZ::RateLimitError => e
  puts "Rate limited, retry after #{e.details['retry_after']} seconds"
rescue REZ::ValidationError => e
  puts "Validation error: #{e.message}"
rescue REZ::REZError => e
  puts "Error #{e.status_code}: #{e.message}"
end
```

### Error Classes

| Class | Description |
|-------|-------------|
| `REZError` | Base exception |
| `AuthenticationError` | Auth failure (401) |
| `NotFoundError` | Resource not found (404) |
| `ValidationError` | Validation failed (422) |
| `RateLimitError` | Rate limited (429) |

## Health Check All Services

```ruby
health = client.health_check_all

health.each do |service, status|
  puts "#{service}: #{status['status']}"
end
```

## Development

```bash
# Install dependencies
bundle install

# Run tests
bundle exec rspec

# Build gem
rake build

# Install locally
rake install
```

## Testing

```ruby
# Test example
RSpec.describe REZ::Client do
  it 'lists agents' do
    client = REZ.client
    response = client.agents.list
    expect(response).to have_key('agents')
  end
end
```

## License

MIT License