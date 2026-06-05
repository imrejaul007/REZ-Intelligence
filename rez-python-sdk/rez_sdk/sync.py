"""
REZ Python SDK - Synchronous Client

Synchronous wrapper for the async REZ SDK.
Use this when async/await is not available or preferred.

Example:
    from rez_sdk.sync import REZSyncClient

    client = REZSyncClient(base_url="http://localhost:8080", api_key="your-key")
    try:
        agents = client.agents.list_agents()
        print(f"Found {agents.total} agents")
    finally:
        client.close()
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any

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
)
from .models import (
    Agent,
    AgentListResponse,
    AgentCreateRequest,
    AgentUpdateRequest,
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


def _run_async(coro):
    """Run an async coroutine in a synchronous context."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


class SyncWrapper:
    """Synchronous wrapper for async clients."""

    def __init__(self, async_client, executor: ThreadPoolExecutor | None = None):
        self._async_client = async_client
        self._executor = executor or ThreadPoolExecutor(max_workers=4)

    def _wrap(self, coro):
        """Wrap an async method to run synchronously."""
        def sync_method(*args, **kwargs):
            return _run_async(coro(*args, **kwargs))
        return sync_method


class AgentRegistrySyncClient(SyncWrapper):
    """Synchronous Agent Registry client."""

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        async_client = AgentRegistryClient(base_url, api_key, timeout, max_retries, retry_delay)
        super().__init__(async_client)
        self._client = async_client

    def list_agents(
        self,
        skip: int = 0,
        limit: int = 100,
        agent_type: str | None = None,
    ) -> AgentListResponse:
        return _run_async(self._client.list_agents(skip, limit, agent_type))

    def get_agent(self, agent_id: str) -> Agent:
        return _run_async(self._client.get_agent(agent_id))

    def register_agent(self, request: AgentCreateRequest) -> Agent:
        return _run_async(self._client.register_agent(request))

    def update_agent(self, agent_id: str, request: AgentUpdateRequest) -> Agent:
        return _run_async(self._client.update_agent(agent_id, request))

    def delete_agent(self, agent_id: str) -> None:
        return _run_async(self._client.delete_agent(agent_id))

    def health_check(self) -> HealthResponse:
        return _run_async(self._client.health_check())


class AutoMLSyncClient(SyncWrapper):
    """Synchronous AutoML client."""

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        async_client = AutoMLClient(base_url, api_key, timeout, max_retries, retry_delay)
        super().__init__(async_client)
        self._client = async_client

    def list_models(self, skip: int = 0, limit: int = 100) -> dict[str, Any]:
        return _run_async(self._client.list_models(skip, limit))

    def get_model(self, model_id: str) -> AutoMLModel:
        return _run_async(self._client.get_model(model_id))

    def train_model(self, request: AutoMLTrainRequest) -> AutoMLModel:
        return _run_async(self._client.train_model(request))

    def predict(self, model_id: str, request: AutoMLPredictRequest) -> dict[str, Any]:
        return _run_async(self._client.predict(model_id, request))

    def delete_model(self, model_id: str) -> None:
        return _run_async(self._client.delete_model(model_id))

    def health_check(self) -> HealthResponse:
        return _run_async(self._client.health_check())


class InvoiceSyncClient(SyncWrapper):
    """Synchronous Invoice client."""

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        async_client = InvoiceClient(base_url, api_key, timeout, max_retries, retry_delay)
        super().__init__(async_client)
        self._client = async_client

    def create_invoice(self, request: InvoiceCreateRequest) -> InvoiceResponse:
        return _run_async(self._client.create_invoice(request))

    def validate_invoice(self, invoice_id: str) -> dict[str, Any]:
        return _run_async(self._client.validate_invoice(invoice_id))

    def get_invoice(self, invoice_id: str) -> InvoiceResponse:
        return _run_async(self._client.get_invoice(invoice_id))

    def list_invoices(
        self,
        skip: int = 0,
        limit: int = 100,
        status: str | None = None,
    ) -> InvoiceListResponse:
        return _run_async(self._client.list_invoices(skip, limit, status))

    def health_check(self) -> HealthResponse:
        return _run_async(self._client.health_check())


class ContractsSyncClient(SyncWrapper):
    """Synchronous Contracts client."""

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        async_client = ContractsClient(base_url, api_key, timeout, max_retries, retry_delay)
        super().__init__(async_client)
        self._client = async_client

    def generate_contract(self, request: ContractGenerateRequest) -> ContractResponse:
        return _run_async(self._client.generate_contract(request))

    def analyze_contract(self, contract_id: str) -> dict[str, Any]:
        return _run_async(self._client.analyze_contract(contract_id))

    def get_contract(self, contract_id: str) -> ContractResponse:
        return _run_async(self._client.get_contract(contract_id))

    def health_check(self) -> HealthResponse:
        return _run_async(self._client.health_check())


class LegalSyncClient(SyncWrapper):
    """Synchronous Legal client."""

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        async_client = LegalClient(base_url, api_key, timeout, max_retries, retry_delay)
        super().__init__(async_client)
        self._client = async_client

    def legal_research(self, query: str, jurisdiction: str | None = None) -> dict[str, Any]:
        return _run_async(self._client.legal_research(query, jurisdiction))

    def analyze_document(self, document_text: str) -> dict[str, Any]:
        return _run_async(self._client.analyze_document(document_text))

    def check_compliance(
        self,
        requirements: list[str],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return _run_async(self._client.check_compliance(requirements, context))

    def health_check(self) -> HealthResponse:
        return _run_async(self._client.health_check())


class TwinSyncClient(SyncWrapper):
    """Synchronous Digital Twin client."""

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        async_client = TwinClient(base_url, api_key, timeout, max_retries, retry_delay)
        super().__init__(async_client)
        self._client = async_client

    def create_twin(self, request: TwinCreateRequest) -> TwinResponse:
        return _run_async(self._client.create_twin(request))

    def get_twin(self, twin_id: str) -> TwinResponse:
        return _run_async(self._client.get_twin(twin_id))

    def get_twin_state(self, twin_id: str) -> dict[str, Any]:
        return _run_async(self._client.get_twin_state(twin_id))

    def update_twin_state(self, twin_id: str, state: dict[str, Any]) -> dict[str, Any]:
        return _run_async(self._client.update_twin_state(twin_id, state))

    def sync_twin(self, twin_id: str) -> dict[str, Any]:
        return _run_async(self._client.sync_twin(twin_id))

    def health_check(self) -> HealthResponse:
        return _run_async(self._client.health_check())


class RankingSyncClient(SyncWrapper):
    """Synchronous Ranking client."""

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        async_client = RankingClient(base_url, api_key, timeout, max_retries, retry_delay)
        super().__init__(async_client)
        self._client = async_client

    def score_entities(self, request: RankingScoreRequest) -> RankingScoreResponse:
        return _run_async(self._client.score_entities(request))

    def get_top_k(
        self,
        entities: list[dict[str, Any]],
        k: int = 10,
        algorithm: str = "weighted",
    ) -> list[dict[str, Any]]:
        return _run_async(self._client.get_top_k(entities, k, algorithm))

    def health_check(self) -> HealthResponse:
        return _run_async(self._client.health_check())


class GraphQLSyncClient(SyncWrapper):
    """Synchronous GraphQL client."""

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        from .models import GraphQLRequest, GraphQLResponse
        async_client = GraphQLClient(base_url, api_key, timeout, max_retries, retry_delay)
        super().__init__(async_client)
        self._client = async_client


class REZSyncClient:
    """
    Synchronous REZ SDK client.

    Provides synchronous access to all REZ services.

    Example:
        from rez_sdk.sync import REZSyncClient

        client = REZSyncClient(base_url="http://localhost:8080", api_key="your-key")
        try:
            agents = client.agents.list_agents()
        finally:
            client.close()
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        self.base_url = base_url
        self.api_key = api_key
        self._agents = AgentRegistrySyncClient(base_url, api_key, timeout, max_retries, retry_delay)
        self._automl = AutoMLSyncClient(base_url, api_key, timeout, max_retries, retry_delay)
        self._invoice = InvoiceSyncClient(base_url, api_key, timeout, max_retries, retry_delay)
        self._contracts = ContractsSyncClient(base_url, api_key, timeout, max_retries, retry_delay)
        self._legal = LegalSyncClient(base_url, api_key, timeout, max_retries, retry_delay)
        self._twin = TwinSyncClient(base_url, api_key, timeout, max_retries, retry_delay)
        self._ranking = RankingSyncClient(base_url, api_key, timeout, max_retries, retry_delay)
        self._graphql = GraphQLSyncClient(base_url, api_key, timeout, max_retries, retry_delay)

    @property
    def agents(self) -> AgentRegistrySyncClient:
        """Get Agent Registry client."""
        return self._agents

    @property
    def automl(self) -> AutoMLSyncClient:
        """Get AutoML client."""
        return self._automl

    @property
    def invoice(self) -> InvoiceSyncClient:
        """Get Invoice client."""
        return self._invoice

    @property
    def contracts(self) -> ContractsSyncClient:
        """Get Contracts client."""
        return self._contracts

    @property
    def legal(self) -> LegalClient:
        """Get Legal client."""
        return self._legal

    @property
    def twin(self) -> TwinSyncClient:
        """Get Twin client."""
        return self._twin

    @property
    def ranking(self) -> RankingSyncClient:
        """Get Ranking client."""
        return self._ranking

    @property
    def graphql(self) -> GraphQLSyncClient:
        """Get GraphQL client."""
        return self._graphql

    def close(self) -> None:
        """Close the client (no-op for sync client, kept for API compatibility)."""
        pass

    def __enter__(self) -> "REZSyncClient":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()
