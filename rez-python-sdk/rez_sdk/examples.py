"""
REZ Python SDK - Usage Examples

This module contains example usage patterns for the REZ SDK.
"""

from __future__ import annotations

import asyncio

from . import REZClient, REZSyncClient
from .models import (
    AgentCreateRequest,
    AgentUpdateRequest,
    AutoMLTrainRequest,
    AutoMLPredictRequest,
    InvoiceCreateRequest,
    InvoiceLineItem,
    ContractGenerateRequest,
    TwinCreateRequest,
    RankingScoreRequest,
    GraphQLRequest,
)


# ============================================================================
# Async Examples
# ============================================================================


async def async_example_basic():
    """Basic async usage example."""
    async with REZClient(base_url="http://localhost:8080") as client:
        # Health check
        health = await client.agents.health_check()
        print(f"Agent Registry: {health.status}")

        # List all agents
        agents = await client.agents.list_agents(skip=0, limit=10)
        print(f"Found {agents.total} agents")

        for agent in agents.agents:
            print(f"  - {agent.name} ({agent.type})")


async def async_example_agents():
    """Agent management example."""
    async with REZClient() as client:
        # Register a new agent
        new_agent = await client.agents.register_agent(
            AgentCreateRequest(
                name="sales-bot",
                type="sales",
                description="AI sales assistant",
                capabilities=["lead_scoring", "product_recommendation"],
            )
        )
        print(f"Created agent: {new_agent.id}")

        # Update agent
        updated = await client.agents.update_agent(
            new_agent.id,
            AgentUpdateRequest(status="active"),
        )
        print(f"Updated agent status: {updated.status}")

        # Delete when done
        await client.agents.delete_agent(new_agent.id)


async def async_example_automl():
    """AutoML example."""
    async with REZClient() as client:
        # Train a model
        model = await client.automl.train_model(
            AutoMLTrainRequest(
                name="fraud-detector-v1",
                task_type="classification",
                training_data={
                    "features": [
                        {"amount": 100, "frequency": 5, "location": "US"},
                        {"amount": 5000, "frequency": 1, "location": "CN"},
                    ],
                    "target": [0, 1],
                },
                features=["amount", "frequency", "location"],
                target="is_fraud",
            )
        )
        print(f"Trained model: {model.id}, accuracy: {model.accuracy}")

        # Make predictions
        predictions = await client.automl.predict(
            model.id,
            AutoMLPredictRequest(
                features=[
                    {"amount": 250, "frequency": 10, "location": "US"},
                ]
            ),
        )
        print(f"Predictions: {predictions}")


async def async_example_invoice():
    """Invoice management example."""
    async with REZClient() as client:
        # Create an invoice
        invoice = await client.invoice.create_invoice(
            InvoiceCreateRequest(
                client_name="Acme Corp",
                client_email="billing@acme.com",
                line_items=[
                    InvoiceLineItem(
                        description="Web Development Services",
                        quantity=40,
                        unit_price=150.0,
                        total=6000.0,
                    ),
                    InvoiceLineItem(
                        description="UI/UX Design",
                        quantity=20,
                        unit_price=125.0,
                        total=2500.0,
                    ),
                ],
                tax_rate=0.1,
                due_date="2024-12-31",
            )
        )
        print(f"Created invoice: {invoice.invoice_number}, total: ${invoice.total}")

        # Validate the invoice
        validation = await client.invoice.validate_invoice(invoice.id)
        print(f"Validation: {validation}")


async def async_example_contracts():
    """Contract generation example."""
    async with REZClient() as client:
        # Generate an NDA contract
        contract = await client.contracts.generate_contract(
            ContractGenerateRequest(
                contract_type="nda",
                title="Mutual Non-Disclosure Agreement",
                parties=["Acme Corp", "Partner Inc"],
                terms={
                    "duration": "2 years",
                    "confidential_info": "All business, technical, and financial information",
                    "jurisdiction": "Delaware, USA",
                },
            )
        )
        print(f"Generated contract: {contract.id}")
        print(f"Status: {contract.status}")


async def async_example_twin():
    """Digital Twin example."""
    async with REZClient() as client:
        # Create a factory twin
        twin = await client.twin.create_twin(
            TwinCreateRequest(
                name="Factory-001",
                entity_type="factory",
                description="Main manufacturing facility",
                initial_state={
                    "temperature": 72.5,
                    "pressure": 14.7,
                    "output_rate": 1000,
                    "status": "operational",
                },
            )
        )
        print(f"Created twin: {twin.id}")

        # Update state
        updated_state = await client.twin.update_twin_state(
            twin.id,
            {"temperature": 73.0, "output_rate": 1050},
        )
        print(f"Updated state: {updated_state}")


async def async_example_ranking():
    """Ranking service example."""
    async with REZClient() as client:
        # Score and rank products
        results = await client.ranking.score_entities(
            RankingScoreRequest(
                entities=[
                    {"id": "prod-1", "sales": 1000, "rating": 4.5, "reviews": 500},
                    {"id": "prod-2", "sales": 5000, "rating": 4.0, "reviews": 200},
                    {"id": "prod-3", "sales": 200, "rating": 4.8, "reviews": 50},
                ],
                ranking_config={"algorithm": "weighted", "weights": {"sales": 0.4, "rating": 0.3, "reviews": 0.3}},
            )
        )
        print(f"Ranked {results.total} products using {results.algorithm}")
        for score in results.scores:
            print(f"  {score['entity_id']}: {score['score']:.3f}")


async def async_example_graphql():
    """GraphQL query example."""
    async with REZClient() as client:
        # Execute a GraphQL query
        result = await client.graphql.execute(
            GraphQLRequest(
                query="""
                    query GetAgents($type: String) {
                        agents(type: $type) {
                            id
                            name
                            status
                        }
                    }
                """,
                variables={"type": "sales"},
            )
        )
        print(f"GraphQL result: {result.data}")


async def async_example_health_check_all():
    """Check health of all services."""
    async with REZClient() as client:
        health = await client.health_check_all()
        print("REZ Service Health:")
        for service, status in health.items():
            emoji = "✅" if status.status == "healthy" else "⚠️" if status.status == "degraded" else "❌"
            print(f"  {emoji} {service}: {status.status}")


# ============================================================================
# Sync Examples
# ============================================================================


def sync_example_basic():
    """Basic sync usage example."""
    with REZSyncClient(base_url="http://localhost:8080") as client:
        # List all agents
        agents = client.agents.list_agents()
        print(f"Found {agents.total} agents")

        # Get a specific agent
        try:
            agent = client.agents.get_agent("fraud-agent")
            print(f"Agent: {agent.name}")
        except Exception as e:
            print(f"Agent not found: {e}")


def sync_example_invoice():
    """Sync invoice creation example."""
    with REZSyncClient() as client:
        invoice = client.invoice.create_invoice(
            InvoiceCreateRequest(
                client_name="Test Client",
                client_email="test@example.com",
                line_items=[
                    InvoiceLineItem(
                        description="Consulting Services",
                        quantity=10,
                        unit_price=200.0,
                        total=2000.0,
                    ),
                ],
                due_date="2024-12-31",
            )
        )
        print(f"Created invoice: {invoice.invoice_number}")


# ============================================================================
# Main
# ============================================================================


if __name__ == "__main__":
    print("REZ Python SDK Examples")
    print("=" * 50)

    # Run async examples
    print("\n1. Basic Async Example:")
    asyncio.run(async_example_basic())

    print("\n2. Health Check All Services:")
    asyncio.run(async_example_health_check_all())

    print("\n3. Sync Example:")
    try:
        sync_example_basic()
    except Exception as e:
        print(f"Sync example error: {e}")

    print("\nDone!")