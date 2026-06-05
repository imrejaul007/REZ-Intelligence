"""
REZ Python SDK - Data Models

Pydantic models for request/response validation and serialization.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ============================================================================
# Common Models
# ============================================================================


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Service status: healthy, degraded, or down")
    service: str = Field(..., description="Service name")
    version: Optional[str] = Field(None, description="Service version")
    timestamp: Optional[str] = Field(None, description="ISO timestamp")
    error: Optional[str] = Field(None, description="Error message if unhealthy")


# ============================================================================
# Agent Models
# ============================================================================


class Agent(BaseModel):
    """AI Agent model."""
    id: str = Field(..., description="Unique agent identifier")
    name: str = Field(..., description="Agent name")
    type: str = Field(..., description="Agent type (fraud, sales, support, etc.)")
    description: Optional[str] = Field(None, description="Agent description")
    capabilities: list[str] = Field(default_factory=list, description="List of capabilities")
    status: str = Field(default="active", description="Agent status")
    config: dict[str, Any] = Field(default_factory=dict, description="Agent configuration")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    created_at: Optional[str] = Field(None, description="Creation timestamp")
    updated_at: Optional[str] = Field(None, description="Last update timestamp")


class AgentListResponse(BaseModel):
    """Paginated list of agents."""
    agents: list[Agent] = Field(..., description="List of agents")
    total: int = Field(..., description="Total number of agents")
    skip: int = Field(..., description="Number skipped")
    limit: int = Field(..., description="Page size")


class AgentCreateRequest(BaseModel):
    """Request to create a new agent."""
    name: str = Field(..., description="Agent name")
    type: str = Field(..., description="Agent type")
    description: Optional[str] = Field(None, description="Agent description")
    capabilities: list[str] = Field(default_factory=list, description="Capabilities")
    config: dict[str, Any] = Field(default_factory=dict, description="Configuration")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Metadata")


class AgentUpdateRequest(BaseModel):
    """Request to update an agent."""
    name: Optional[str] = Field(None, description="Agent name")
    description: Optional[str] = Field(None, description="Agent description")
    capabilities: Optional[list[str]] = Field(None, description="Capabilities")
    status: Optional[str] = Field(None, description="Agent status")
    config: Optional[dict[str, Any]] = Field(None, description="Configuration")
    metadata: Optional[dict[str, Any]] = Field(None, description="Metadata")


# ============================================================================
# GraphQL Models
# ============================================================================


class GraphQLRequest(BaseModel):
    """GraphQL query request."""
    query: str = Field(..., description="GraphQL query string")
    variables: Optional[dict[str, Any]] = Field(None, description="Query variables")
    operation_name: Optional[str] = Field(None, description="Operation name")


class GraphQLResponse(BaseModel):
    """GraphQL response."""
    data: Optional[dict[str, Any]] = Field(None, description="Response data")
    errors: Optional[list[dict[str, Any]]] = Field(None, description="GraphQL errors")


# ============================================================================
# AutoML Models
# ============================================================================


class AutoMLModel(BaseModel):
    """AutoML trained model."""
    id: str = Field(..., description="Model identifier")
    name: str = Field(..., description="Model name")
    task_type: str = Field(..., description="Task type (classification, regression, etc.)")
    algorithm: str = Field(..., description="Algorithm used")
    status: str = Field(default="training", description="Model status")
    metrics: dict[str, float] = Field(default_factory=dict, description="Model metrics")
    features: list[str] = Field(default_factory=list, description="Feature names")
    target: Optional[str] = Field(None, description="Target variable")
    created_at: Optional[str] = Field(None, description="Creation timestamp")
    accuracy: Optional[float] = Field(None, description="Model accuracy")
    f1_score: Optional[float] = Field(None, description="F1 score")


class AutoMLTrainRequest(BaseModel):
    """Request to train an AutoML model."""
    name: str = Field(..., description="Model name")
    task_type: str = Field(..., description="Task type")
    training_data: dict[str, Any] = Field(..., description="Training data")
    features: list[str] = Field(..., description="Feature columns")
    target: str = Field(..., description="Target column")
    algorithm: Optional[str] = Field("auto", description="Algorithm (auto, random_forest, etc.)")
    hyperparameters: Optional[dict[str, Any]] = Field(None, description="Hyperparameters")
    validation_split: float = Field(0.2, description="Validation split ratio")


class AutoMLPredictRequest(BaseModel):
    """Request to make predictions."""
    features: list[dict[str, Any]] = Field(..., description="Input features")


# ============================================================================
# Invoice Models
# ============================================================================


class InvoiceLineItem(BaseModel):
    """Invoice line item."""
    description: str = Field(..., description="Item description")
    quantity: float = Field(..., description="Quantity")
    unit_price: float = Field(..., description="Unit price")
    total: float = Field(..., description="Line total")


class InvoiceResponse(BaseModel):
    """Invoice response."""
    id: str = Field(..., description="Invoice ID")
    invoice_number: str = Field(..., description="Invoice number")
    status: str = Field(..., description="Invoice status")
    client_name: str = Field(..., description="Client name")
    client_email: str = Field(..., description="Client email")
    issue_date: str = Field(..., description="Issue date")
    due_date: str = Field(..., description="Due date")
    line_items: list[InvoiceLineItem] = Field(..., description="Line items")
    subtotal: float = Field(..., description="Subtotal")
    tax: float = Field(..., description="Tax amount")
    total: float = Field(..., description="Total amount")
    currency: str = Field(default="USD", description="Currency code")
    notes: Optional[str] = Field(None, description="Additional notes")


class InvoiceListResponse(BaseModel):
    """Paginated list of invoices."""
    invoices: list[InvoiceResponse] = Field(..., description="List of invoices")
    total: int = Field(..., description="Total count")
    skip: int = Field(..., description="Number skipped")
    limit: int = Field(..., description="Page size")


class InvoiceCreateRequest(BaseModel):
    """Request to create an invoice."""
    client_name: str = Field(..., description="Client name")
    client_email: str = Field(..., description="Client email")
    line_items: list[InvoiceLineItem] = Field(..., description="Line items")
    tax_rate: float = Field(0.0, description="Tax rate")
    due_date: str = Field(..., description="Due date")
    currency: str = Field("USD", description="Currency code")
    notes: Optional[str] = Field(None, description="Additional notes")


# ============================================================================
# Contracts Models
# ============================================================================


class ContractResponse(BaseModel):
    """Contract response."""
    id: str = Field(..., description="Contract ID")
    contract_type: str = Field(..., description="Contract type")
    title: str = Field(..., description="Contract title")
    parties: list[str] = Field(..., description="Party names")
    content: str = Field(..., description="Contract content")
    status: str = Field(..., description="Contract status")
    created_at: str = Field(..., description="Creation timestamp")
    effective_date: Optional[str] = Field(None, description="Effective date")
    expiration_date: Optional[str] = Field(None, description="Expiration date")


class ContractGenerateRequest(BaseModel):
    """Request to generate a contract."""
    contract_type: str = Field(..., description="Contract type")
    title: str = Field(..., description="Contract title")
    parties: list[str] = Field(..., description="Party information")
    terms: dict[str, Any] = Field(..., description="Contract terms")
    effective_date: Optional[str] = Field(None, description="Effective date")
    expiration_date: Optional[str] = Field(None, description="Expiration date")


# ============================================================================
# Twin Models
# ============================================================================


class TwinResponse(BaseModel):
    """Digital Twin response."""
    id: str = Field(..., description="Twin ID")
    name: str = Field(..., description="Twin name")
    entity_type: str = Field(..., description="Entity type")
    description: Optional[str] = Field(None, description="Twin description")
    state: dict[str, Any] = Field(default_factory=dict, description="Current state")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Metadata")
    sync_status: str = Field(..., description="Synchronization status")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: Optional[str] = Field(None, description="Last update timestamp")


class TwinCreateRequest(BaseModel):
    """Request to create a digital twin."""
    name: str = Field(..., description="Twin name")
    entity_type: str = Field(..., description="Entity type")
    description: Optional[str] = Field(None, description="Twin description")
    initial_state: dict[str, Any] = Field(default_factory=dict, description="Initial state")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Metadata")


# ============================================================================
# Ranking Models
# ============================================================================


class RankingScoreRequest(BaseModel):
    """Request to score entities."""
    entities: list[dict[str, Any]] = Field(..., description="Entities to score")
    ranking_config: dict[str, Any] = Field(..., description="Ranking configuration")
    weights: Optional[dict[str, float]] = Field(None, description="Feature weights")


class RankingScoreResponse(BaseModel):
    """Ranking score response."""
    scores: list[dict[str, Any]] = Field(..., description="Entity scores")
    total: int = Field(..., description="Total entities scored")
    algorithm: str = Field(..., description="Algorithm used")
