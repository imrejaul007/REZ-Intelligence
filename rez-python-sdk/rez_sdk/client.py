"""
REZ Python SDK - Base HTTP Client

Provides async HTTP client with automatic retry, timeout, and error handling.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, TypeVar, Generic
from urllib.parse import urljoin

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
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
    ErrorResponse,
)

logger = logging.getLogger(__name__)

T = TypeVar("T")


class REZClientError(Exception):
    """Base exception for REZ SDK errors."""

    def __init__(self, message: str, status_code: int | None = None, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class RateLimitError(REZClientError):
    """Raised when rate limit is exceeded."""
    pass


class AuthenticationError(REZClientError):
    """Raised when authentication fails."""
    pass


class NotFoundError(REZClientError):
    """Raised when a resource is not found."""
    pass


class ValidationError(REZClientError):
    """Raised when request validation fails."""
    pass


def _handle_response_error(status_code: int, data: dict | None) -> None:
    """Convert HTTP status codes to specific exceptions."""
    if status_code == 401:
        raise AuthenticationError(
            message=data.get("message", "Authentication failed"),
            status_code=status_code,
            details=data,
        )
    elif status_code == 404:
        raise NotFoundError(
            message=data.get("message", "Resource not found"),
            status_code=status_code,
            details=data,
        )
    elif status_code == 422:
        raise ValidationError(
            message=data.get("message", "Validation failed"),
            status_code=status_code,
            details=data,
        )
    elif status_code == 429:
        raise RateLimitError(
            message=data.get("message", "Rate limit exceeded"),
            status_code=status_code,
            details=data,
        )
    else:
        raise REZClientError(
            message=data.get("message", f"HTTP {status_code} error"),
            status_code=status_code,
            details=data,
        )


class BaseClient:
    """
    Base HTTP client with automatic retry and error handling.

    Args:
        base_url: Base URL for the REZ API
        api_key: API key for authentication
        timeout: Request timeout in seconds (default: 30)
        max_retries: Maximum number of retry attempts (default: 3)
        retry_delay: Base delay between retries in seconds (default: 1)
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "rez-python-sdk/1.0.0",
        }
        if api_key:
            headers["X-API-Key"] = api_key

        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=httpx.Timeout(timeout),
        )

    async def _request(
        self,
        method: str,
        path: str,
        params: dict | None = None,
        json_data: dict | None = None,
        headers: dict | None = None,
    ) -> dict[str, Any]:
        """
        Make an HTTP request with retry logic.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE, etc.)
            path: API endpoint path
            params: Query parameters
            json_data: JSON request body
            headers: Additional headers

        Returns:
            Response JSON data

        Raises:
            REZClientError: On request failure after retries
        """
        url = urljoin(self.base_url + "/", path.lstrip("/"))

        @retry(
            stop=stop_after_attempt(max_retries),
            wait=wait_exponential(multiplier=retry_delay, min=1, max=10),
            retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
            reraise=True,
        )
        async def _do_request():
            response = await self._client.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                headers=headers,
            )

            if response.status_code >= 400:
                try:
                    error_data = response.json()
                except Exception:
                    error_data = {"message": response.text}

                _handle_response_error(response.status_code, error_data)

            return response.json()

        return await _do_request()

    async def get(self, path: str, params: dict | None = None) -> dict[str, Any]:
        """Make a GET request."""
        return await self._request("GET", path, params=params)

    async def post(self, path: str, json_data: dict | None = None) -> dict[str, Any]:
        """Make a POST request."""
        return await self._request("POST", path, json_data=json_data)

    async def put(self, path: str, json_data: dict | None = None) -> dict[str, Any]:
        """Make a PUT request."""
        return await self._request("PUT", path, json_data=json_data)

    async def delete(self, path: str) -> dict[str, Any]:
        """Make a DELETE request."""
        return await self._request("DELETE", path)

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

    async def __aenter__(self) -> "BaseClient":
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.close()


class AgentRegistryClient(BaseClient):
    """
    Client for the Agent Registry service.

    Manages AI agent registration, discovery, and lifecycle management.

    Example:
        async with AgentRegistryClient() as client:
            agents = await client.list_agents()
            agent = await client.get_agent("fraud-agent")
    """

    async def list_agents(
        self,
        skip: int = 0,
        limit: int = 100,
        agent_type: str | None = None,
    ) -> AgentListResponse:
        """
        List all registered agents.

        Args:
            skip: Number of records to skip (pagination)
            limit: Maximum number of records to return
            agent_type: Filter by agent type

        Returns:
            AgentListResponse with agents and pagination info
        """
        params: dict[str, Any] = {"skip": skip, "limit": limit}
        if agent_type:
            params["type"] = agent_type

        data = await self.get("/api/agents", params=params)
        return AgentListResponse(**data)

    async def get_agent(self, agent_id: str) -> Agent:
        """
        Get a specific agent by ID.

        Args:
            agent_id: Unique agent identifier

        Returns:
            Agent details
        """
        data = await self.get(f"/api/agents/{agent_id}")
        return Agent(**data)

    async def register_agent(self, request: AgentCreateRequest) -> Agent:
        """
        Register a new agent.

        Args:
            request: Agent registration details

        Returns:
            Created agent with generated ID
        """
        data = await self.post("/api/agents", json_data=request.model_dump())
        return Agent(**data)

    async def update_agent(self, agent_id: str, request: AgentUpdateRequest) -> Agent:
        """
        Update an existing agent.

        Args:
            agent_id: Agent ID to update
            request: Updated agent details

        Returns:
            Updated agent
        """
        data = await self.put(f"/api/agents/{agent_id}", json_data=request.model_dump())
        return Agent(**data)

    async def delete_agent(self, agent_id: str) -> None:
        """
        Delete an agent.

        Args:
            agent_id: Agent ID to delete
        """
        await self.delete(f"/api/agents/{agent_id}")

    async def health_check(self) -> HealthResponse:
        """Check agent registry service health."""
        data = await self.get("/health")
        return HealthResponse(**data)


class AutoMLClient(BaseClient):
    """
    Client for the AutoML service.

    Provides automated machine learning model training and inference.

    Example:
        async with AutoMLClient() as client:
            model = await client.train_model(training_data={"features": [...], "target": [...]})
            prediction = await client.predict(model_id=model.id, features=[...])
    """

    async def list_models(self, skip: int = 0, limit: int = 100) -> dict[str, Any]:
        """List all trained models."""
        data = await self.get("/api/automl/models", params={"skip": skip, "limit": limit})
        return data

    async def get_model(self, model_id: str) -> AutoMLModel:
        """Get a specific model by ID."""
        data = await self.get(f"/api/automl/models/{model_id}")
        return AutoMLModel(**data)

    async def train_model(self, request: AutoMLTrainRequest) -> AutoMLModel:
        """
        Start a new model training job.

        Args:
            request: Training configuration and data

        Returns:
            Trained model with metrics
        """
        data = await self.post("/api/automl/train", json_data=request.model_dump())
        return AutoMLModel(**data)

    async def predict(self, model_id: str, request: AutoMLPredictRequest) -> dict[str, Any]:
        """
        Run inference with a trained model.

        Args:
            model_id: Model ID to use for prediction
            request: Input features for prediction

        Returns:
            Prediction results
        """
        data = await self.post(
            f"/api/automl/predict/{model_id}",
            json_data=request.model_dump(),
        )
        return data

    async def delete_model(self, model_id: str) -> None:
        """Delete a trained model."""
        await self.delete(f"/api/automl/models/{model_id}")

    async def health_check(self) -> HealthResponse:
        """Check AutoML service health."""
        data = await self.get("/health")
        return HealthResponse(**data)


class InvoiceClient(BaseClient):
    """
    Client for the Invoice service.

    Handles invoice generation, validation, and management.

    Example:
        async with InvoiceClient() as client:
            invoice = await client.create_invoice(invoice_data={...})
            validated = await client.validate_invoice(invoice.id)
    """

    async def create_invoice(self, request: InvoiceCreateRequest) -> InvoiceResponse:
        """
        Create a new invoice.

        Args:
            request: Invoice details

        Returns:
            Created invoice
        """
        data = await self.post("/api/invoice/create", json_data=request.model_dump())
        return InvoiceResponse(**data)

    async def validate_invoice(self, invoice_id: str) -> dict[str, Any]:
        """
        Validate an invoice for compliance and accuracy.

        Args:
            invoice_id: Invoice ID to validate

        Returns:
            Validation result
        """
        data = await self.post(f"/api/invoice/validate/{invoice_id}")
        return data

    async def get_invoice(self, invoice_id: str) -> InvoiceResponse:
        """Get invoice details."""
        data = await self.get(f"/api/invoice/{invoice_id}")
        return InvoiceResponse(**data)

    async def list_invoices(
        self,
        skip: int = 0,
        limit: int = 100,
        status: str | None = None,
    ) -> InvoiceListResponse:
        """List all invoices with optional filtering."""
        params: dict[str, Any] = {"skip": skip, "limit": limit}
        if status:
            params["status"] = status

        data = await self.get("/api/invoice/list", params=params)
        return InvoiceListResponse(**data)

    async def health_check(self) -> HealthResponse:
        """Check Invoice service health."""
        data = await self.get("/health")
        return HealthResponse(**data)


class ContractsClient(BaseClient):
    """
    Client for the Contracts service.

    Provides contract generation, analysis, and management.

    Example:
        async with ContractsClient() as client:
            contract = await client.generate_contract(contract_type="nda", parties=[...])
            analyzed = await client.analyze_contract(contract.id)
    """

    async def generate_contract(self, request: ContractGenerateRequest) -> ContractResponse:
        """
        Generate a new contract.

        Args:
            request: Contract generation parameters

        Returns:
            Generated contract
        """
        data = await self.post("/api/contracts/generate", json_data=request.model_dump())
        return ContractResponse(**data)

    async def analyze_contract(self, contract_id: str) -> dict[str, Any]:
        """
        Analyze a contract for risks and compliance.

        Args:
            contract_id: Contract ID to analyze

        Returns:
            Analysis results
        """
        data = await self.post(f"/api/contracts/analyze/{contract_id}")
        return data

    async def get_contract(self, contract_id: str) -> ContractResponse:
        """Get contract details."""
        data = await self.get(f"/api/contracts/{contract_id}")
        return ContractResponse(**data)

    async def health_check(self) -> HealthResponse:
        """Check Contracts service health."""
        data = await self.get("/health")
        return HealthResponse(**data)


class LegalClient(BaseClient):
    """
    Client for the Legal service.

    Provides legal research, document analysis, and compliance checking.

    Example:
        async with LegalClient() as client:
            research = await client.legal_research(query="GDPR compliance")
            compliance = await client.check_compliance(requirements=["SOC2", "HIPAA"])
    """

    async def legal_research(self, query: str, jurisdiction: str | None = None) -> dict[str, Any]:
        """
        Perform legal research.

        Args:
            query: Legal question or topic
            jurisdiction: Optional jurisdiction filter

        Returns:
            Research results
        """
        params: dict[str, Any] = {"query": query}
        if jurisdiction:
            params["jurisdiction"] = jurisdiction

        data = await self.get("/api/legal/research", params=params)
        return data

    async def analyze_document(self, document_text: str) -> dict[str, Any]:
        """
        Analyze a legal document.

        Args:
            document_text: Text content of the document

        Returns:
            Analysis results
        """
        data = await self.post(
            "/api/legal/analyze",
            json_data={"document_text": document_text},
        )
        return data

    async def check_compliance(
        self,
        requirements: list[str],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Check compliance against requirements.

        Args:
            requirements: List of compliance requirements to check
            context: Additional context for compliance check

        Returns:
            Compliance check results
        """
        data = await self.post(
            "/api/legal/compliance",
            json_data={
                "requirements": requirements,
                "context": context or {},
            },
        )
        return data

    async def health_check(self) -> HealthResponse:
        """Check Legal service health."""
        data = await self.get("/health")
        return HealthResponse(**data)


class TwinClient(BaseClient):
    """
    Client for the Digital Twin service.

    Manages digital twin models and real-time synchronization.

    Example:
        async with TwinClient() as client:
            twin = await client.create_twin(name="Factory 1", entity_type="factory")
            state = await client.get_twin_state(twin.id)
    """

    async def create_twin(self, request: TwinCreateRequest) -> TwinResponse:
        """
        Create a new digital twin.

        Args:
            request: Twin creation parameters

        Returns:
            Created twin
        """
        data = await self.post("/api/twin/create", json_data=request.model_dump())
        return TwinResponse(**data)

    async def get_twin(self, twin_id: str) -> TwinResponse:
        """Get twin details."""
        data = await self.get(f"/api/twin/{twin_id}")
        return TwinResponse(**data)

    async def get_twin_state(self, twin_id: str) -> dict[str, Any]:
        """
        Get current twin state.

        Args:
            twin_id: Twin ID

        Returns:
            Current state data
        """
        data = await self.get(f"/api/twin/{twin_id}/state")
        return data

    async def update_twin_state(
        self,
        twin_id: str,
        state: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Update twin state.

        Args:
            twin_id: Twin ID
            state: New state data

        Returns:
            Updated state
        """
        data = await self.post(
            f"/api/twin/{twin_id}/state",
            json_data={"state": state},
        )
        return data

    async def sync_twin(self, twin_id: str) -> dict[str, Any]:
        """
        Synchronize twin with physical entity.

        Args:
            twin_id: Twin ID to sync

        Returns:
            Sync results
        """
        data = await self.post(f"/api/twin/{twin_id}/sync")
        return data

    async def health_check(self) -> HealthResponse:
        """Check Twin service health."""
        data = await self.get("/health")
        return HealthResponse(**data)


class RankingClient(BaseClient):
    """
    Client for the Ranking service.

    Provides ranking and recommendation algorithms.

    Example:
        async with RankingClient() as client:
            scores = await client.score_entities(
                entities=[{"id": "1", "features": {...}}, ...],
                ranking_config={"algorithm": "page_rank"}
            )
    """

    async def score_entities(
        self,
        request: RankingScoreRequest,
    ) -> RankingScoreResponse:
        """
        Score and rank entities.

        Args:
            request: Entities and ranking configuration

        Returns:
            Ranked entities with scores
        """
        data = await self.post("/api/ranking/score", json_data=request.model_dump())
        return RankingScoreResponse(**data)

    async def get_top_k(
        self,
        entities: list[dict[str, Any]],
        k: int = 10,
        algorithm: str = "weighted",
    ) -> list[dict[str, Any]]:
        """
        Get top K ranked entities.

        Args:
            entities: List of entities to rank
            k: Number of top entities to return
            algorithm: Ranking algorithm to use

        Returns:
            Top K entities
        """
        data = await self.post(
            "/api/ranking/top-k",
            json_data={
                "entities": entities,
                "k": k,
                "algorithm": algorithm,
            },
        )
        return data["entities"]

    async def health_check(self) -> HealthResponse:
        """Check Ranking service health."""
        data = await self.get("/health")
        return HealthResponse(**data)


class GraphQLClient(BaseClient):
    """
    Client for the GraphQL service.

    Provides unified GraphQL API access to REZ services.

    Example:
        async with GraphQLClient() as client:
            result = await client.execute(
                query='query { agents { id name } }'
            )
    """

    async def execute(self, request: GraphQLRequest) -> GraphQLResponse:
        """
        Execute a GraphQL query or mutation.

        Args:
            request: GraphQL query and variables

        Returns:
            GraphQL response
        """
        data = await self.post(
            "/graphql",
            json_data=request.model_dump(),
        )
        return GraphQLResponse(**data)

    async def health_check(self) -> HealthResponse:
        """Check GraphQL service health."""
        data = await self.get("/health")
        return HealthResponse(**data)


class REZClient(BaseClient):
    """
    Unified REZ SDK client.

    Provides access to all REZ services through a single client instance.

    Example:
        async with REZClient(base_url="https://api.rez.io", api_key="your-key") as client:
            # Access all services
            agents = await client.agents.list_agents()
            model = await client.automl.train_model(training_data={...})
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        super().__init__(base_url, api_key, timeout, max_retries, retry_delay)
        self._agents: AgentRegistryClient | None = None
        self._automl: AutoMLClient | None = None
        self._invoice: InvoiceClient | None = None
        self._contracts: ContractsClient | None = None
        self._legal: LegalClient | None = None
        self._twin: TwinClient | None = None
        self._ranking: RankingClient | None = None
        self._graphql: GraphQLClient | None = None

    @property
    def agents(self) -> AgentRegistryClient:
        """Get Agent Registry client."""
        if self._agents is None:
            self._agents = AgentRegistryClient(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.timeout,
                max_retries=self.max_retries,
                retry_delay=self.retry_delay,
            )
        return self._agents

    @property
    def automl(self) -> AutoMLClient:
        """Get AutoML client."""
        if self._automl is None:
            self._automl = AutoMLClient(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.timeout,
                max_retries=self.max_retries,
                retry_delay=self.retry_delay,
            )
        return self._automl

    @property
    def invoice(self) -> InvoiceClient:
        """Get Invoice client."""
        if self._invoice is None:
            self._invoice = InvoiceClient(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.timeout,
                max_retries=self.max_retries,
                retry_delay=self.retry_delay,
            )
        return self._invoice

    @property
    def contracts(self) -> ContractsClient:
        """Get Contracts client."""
        if self._contracts is None:
            self._contracts = ContractsClient(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.timeout,
                max_retries=self.max_retries,
                retry_delay=self.retry_delay,
            )
        return self._contracts

    @property
    def legal(self) -> LegalClient:
        """Get Legal client."""
        if self._legal is None:
            self._legal = LegalClient(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.timeout,
                max_retries=self.max_retries,
                retry_delay=self.retry_delay,
            )
        return self._legal

    @property
    def twin(self) -> TwinClient:
        """Get Twin client."""
        if self._twin is None:
            self._twin = TwinClient(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.timeout,
                max_retries=self.max_retries,
                retry_delay=self.retry_delay,
            )
        return self._twin

    @property
    def ranking(self) -> RankingClient:
        """Get Ranking client."""
        if self._ranking is None:
            self._ranking = RankingClient(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.timeout,
                max_retries=self.max_retries,
                retry_delay=self.retry_delay,
            )
        return self._ranking

    @property
    def graphql(self) -> GraphQLClient:
        """Get GraphQL client."""
        if self._graphql is None:
            self._graphql = GraphQLClient(
                base_url=self.base_url,
                api_key=self.api_key,
                timeout=self.timeout,
                max_retries=self.max_retries,
                retry_delay=self.retry_delay,
            )
        return self._graphql

    async def health_check_all(self) -> dict[str, HealthResponse]:
        """
        Check health of all REZ services.

        Returns:
            Dictionary mapping service names to health responses
        """
        services = ["agents", "automl", "invoice", "contracts", "legal", "twin", "ranking", "graphql"]
        results: dict[str, HealthResponse] = {}

        for service_name in services:
            try:
                client = getattr(self, service_name)
                results[service_name] = await client.health_check()
            except Exception as e:
                results[service_name] = HealthResponse(
                    status="down",
                    service=service_name,
                    error=str(e),
                )

        return results
