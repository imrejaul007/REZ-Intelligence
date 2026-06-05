"""
REZ Python SDK

A Python SDK for interacting with the REZ Agent OS ecosystem.
Supports async operations with automatic retry, rate limiting, and comprehensive error handling.

Example:
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
"""

from .client import (
    REZClient,
    AgentRegistryClient,
    AutoMLClient,
    InvoiceClient,
    ContractsClient,
    LegalClient,
    TwinClient,
    RankingClient,
    GraphQLClient,
    REZClientError,
    RateLimitError,
    AuthenticationError,
    NotFoundError,
    ValidationError,
)
from .models import (
    Agent,
    AgentListResponse,
    AgentCreateRequest,
    AgentUpdateRequest,
    GraphQLRequest,
    GraphQLResponse,
    AutoMLModel,
    AutoMLTrainRequest,
    AutoMLPredictRequest,
    InvoiceCreateRequest,
    InvoiceResponse,
    InvoiceListResponse,
    ContractGenerateRequest,
    ContractResponse,
    TwinCreateRequest,
    TwinResponse,
    RankingScoreRequest,
    RankingScoreResponse,
    HealthResponse,
)

__version__ = "1.0.0"

__all__ = [
    # Main client
    "REZClient",
    # Service clients
    "AgentRegistryClient",
    "AutoMLClient",
    "InvoiceClient",
    "ContractsClient",
    "LegalClient",
    "TwinClient",
    "RankingClient",
    "GraphQLClient",
    # Exceptions
    "REZClientError",
    "RateLimitError",
    "AuthenticationError",
    "NotFoundError",
    "ValidationError",
    # Models
    "Agent",
    "AgentListResponse",
    "AgentCreateRequest",
    "AgentUpdateRequest",
    "GraphQLRequest",
    "GraphQLResponse",
    "AutoMLModel",
    "AutoMLTrainRequest",
    "AutoMLPredictRequest",
    "InvoiceCreateRequest",
    "InvoiceResponse",
    "InvoiceListResponse",
    "ContractGenerateRequest",
    "ContractResponse",
    "TwinCreateRequest",
    "TwinResponse",
    "RankingScoreRequest",
    "RankingScoreResponse",
    "HealthResponse",
]