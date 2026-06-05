# REZ Python SDK

A Python SDK for interacting with the REZ Agent OS ecosystem. Supports async operations with automatic retry, rate limiting, and comprehensive error handling.

## Installation

```bash
pip install rez-sdk
```

Or install from source:

```bash
cd rez-python-sdk
pip install -e .
```

## Quick Start

### Async Usage

```python
import asyncio
from rez_sdk import REZClient

async def main():
    async with REZClient(base_url="http://localhost:8080", api_key="your-key") as client:
        # List all agents
        agents = await client.agents.list_agents()
        print(f"Found {agents.total} agents")

        # Get a specific agent
        agent = await client.agents.get_agent("fraud-agent")
        print(f"Agent: {agent.name}")

        # Train a model
        model = await client.automl.train_model(
            name="fraud-detector",
            task_type="classification",
            training_data={"features": [...], "target": [...]},
            features=["amount", "frequency", "location"],
            target="is_fraud"
        )

        # Create an invoice
        invoice = await client.invoice.create_invoice(
            client_name="Acme Corp",
            client_email="billing@acme.com",
            line_items=[...],
            due_date="2024-12-31"
        )

asyncio.run(main())
```

### Sync Usage

```python
from rez_sdk.sync import REZSyncClient

with REZSyncClient(base_url="http://localhost:8080", api_key="your-key") as client:
    agents = client.agents.list_agents()
    print(f"Found {agents.total} agents")
```

## Services

### Agent Registry

Manage AI agent registration, discovery, and lifecycle.

```python
from rez_sdk import REZClient

async with REZClient() as client:
    # List agents
    agents = await client.agents.list_agents()

    # Register agent
    agent = await client.agents.register_agent(
        AgentCreateRequest(
            name="sales-bot",
            type="sales",
            capabilities=["lead_scoring"]
        )
    )

    # Update agent
    updated = await client.agents.update_agent(agent.id, AgentUpdateRequest(status="active"))

    # Delete agent
    await client.agents.delete_agent(agent.id)
```

### AutoML

Automated machine learning model training and inference.

```python
async with REZClient() as client:
    # Train model
    model = await client.automl.train_model(
        AutoMLTrainRequest(
            name="fraud-detector-v1",
            task_type="classification",
            training_data={"features": [...], "target": [...]},
            features=["amount", "frequency", "location"],
            target="is_fraud"
        )
    )

    # Predict
    predictions = await client.automl.predict(model.id, AutoMLPredictRequest(features=[...]))
```

### Invoice

Invoice generation, validation, and management.

```python
from rez_sdk import REZClient
from rez_sdk.models import InvoiceCreateRequest, InvoiceLineItem

async with REZClient() as client:
    invoice = await client.invoice.create_invoice(
        InvoiceCreateRequest(
            client_name="Acme Corp",
            client_email="billing@acme.com",
            line_items=[
                InvoiceLineItem(
                    description="Services",
                    quantity=10,
                    unit_price=100.0,
                    total=1000.0
                )
            ],
            tax_rate=0.1,
            due_date="2024-12-31"
        )
    )

    # Validate
    validation = await client.invoice.validate_invoice(invoice.id)
```

### Contracts

Contract generation, analysis, and management.

```python
async with REZClient() as client:
    contract = await client.contracts.generate_contract(
        ContractGenerateRequest(
            contract_type="nda",
            title="Mutual NDA",
            parties=["Acme Corp", "Partner Inc"],
            terms={"duration": "2 years", "jurisdiction": "Delaware"}
        )
    )

    # Analyze
    analysis = await client.contracts.analyze_contract(contract.id)
```

### Digital Twin

Digital twin models and real-time synchronization.

```python
async with REZClient() as client:
    # Create twin
    twin = await client.twin.create_twin(
        TwinCreateRequest(
            name="Factory-001",
            entity_type="factory",
            initial_state={"temperature": 72, "pressure": 14.7}
        )
    )

    # Update state
    await client.twin.update_twin_state(twin.id, {"temperature": 73})

    # Sync
    await client.twin.sync_twin(twin.id)
```

### Ranking

Ranking and recommendation algorithms.

```python
async with REZClient() as client:
    results = await client.ranking.score_entities(
        RankingScoreRequest(
            entities=[
                {"id": "prod-1", "sales": 1000, "rating": 4.5},
                {"id": "prod-2", "sales": 5000, "rating": 4.0}
            ],
            ranking_config={"algorithm": "weighted"}
        )
    )
```

### GraphQL

Unified GraphQL API access.

```python
async with REZClient() as client:
    result = await client.graphql.execute(
        GraphQLRequest(
            query="""
                query GetAgents($type: String) {
                    agents(type: $type) { id name status }
                }
            """,
            variables={"type": "sales"}
        )
    )
```

## Error Handling

```python
from rez_sdk import REZClient
from rez_sdk.exceptions import (
    REZClientError,
    RateLimitError,
    AuthenticationError,
    NotFoundError,
    ValidationError
)

async with REZClient() as client:
    try:
        agent = await client.agents.get_agent("non-existent")
    except NotFoundError:
        print("Agent not found")
    except RateLimitError:
        print("Rate limit exceeded")
    except AuthenticationError:
        print("Authentication failed")
    except ValidationError as e:
        print(f"Validation error: {e.message}")
    except REZClientError as e:
        print(f"General error: {e.message}")
```

## Configuration

```python
from rez_sdk import REZClient

client = REZClient(
    base_url="http://localhost:8080",  # API base URL
    api_key="your-api-key",           # Optional API key
    timeout=30.0,                      # Request timeout (seconds)
    max_retries=3,                     # Max retry attempts
    retry_delay=1.0                    # Base delay between retries
)
```

## Health Checks

```python
async with REZClient() as client:
    # Check single service
    health = await client.agents.health_check()

    # Check all services
    health = await client.health_check_all()
    for service, status in health.items():
        print(f"{service}: {status.status}")
```

## Development

### Install Dependencies

```bash
pip install -e ".[dev]"
```

### Run Tests

```bash
pytest tests/
```

### Build Package

```bash
python -m build
```

## License

MIT License