/*
REZ Go SDK - Data Models

Pydantic-equivalent models for Go with JSON tags.
*/
package rez

import "time"

// ============================================================================
// Agent Models
// ============================================================================

// Agent represents an AI agent
type Agent struct {
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	Type          string                 `json:"type"`
	Description   string                 `json:"description,omitempty"`
	Capabilities  []string               `json:"capabilities,omitempty"`
	Status        string                 `json:"status,omitempty"`
	Config        map[string]interface{} `json:"config,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt     string                 `json:"created_at,omitempty"`
	UpdatedAt     string                 `json:"updated_at,omitempty"`
}

// AgentListResponse paginated list of agents
type AgentListResponse struct {
	Agents []Agent `json:"agents"`
	Total  int     `json:"total"`
	Skip   int     `json:"skip"`
	Limit  int     `json:"limit"`
}

// AgentCreateRequest request to create an agent
type AgentCreateRequest struct {
	Name         string                 `json:"name"`
	Type         string                 `json:"type"`
	Description  string                 `json:"description,omitempty"`
	Capabilities []string               `json:"capabilities,omitempty"`
	Config       map[string]interface{} `json:"config,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// AgentUpdateRequest request to update an agent
type AgentUpdateRequest struct {
	Name         string                 `json:"name,omitempty"`
	Description  string                 `json:"description,omitempty"`
	Capabilities []string               `json:"capabilities,omitempty"`
	Status       string                 `json:"status,omitempty"`
	Config       map[string]interface{} `json:"config,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// ============================================================================
// GraphQL Models
// ============================================================================

// GraphQLRequest GraphQL query request
type GraphQLRequest struct {
	Query         string                 `json:"query"`
	Variables     map[string]interface{} `json:"variables,omitempty"`
	OperationName string                 `json:"operationName,omitempty"`
}

// GraphQLResponse GraphQL response
type GraphQLResponse struct {
	Data   map[string]interface{}   `json:"data,omitempty"`
	Errors []map[string]interface{} `json:"errors,omitempty"`
}

// ============================================================================
// AutoML Models
// ============================================================================

// AutoMLModel represents a trained model
type AutoMLModel struct {
	ID        string             `json:"id"`
	Name      string             `json:"name"`
	TaskType  string             `json:"task_type"`
	Algorithm string             `json:"algorithm"`
	Status    string             `json:"status"`
	Metrics   map[string]float64 `json:"metrics,omitempty"`
	Features  []string           `json:"features,omitempty"`
	Target    string             `json:"target,omitempty"`
	CreatedAt string             `json:"created_at,omitempty"`
	Accuracy  *float64           `json:"accuracy,omitempty"`
	F1Score   *float64           `json:"f1_score,omitempty"`
}

// AutoMLTrainRequest request to train a model
type AutoMLTrainRequest struct {
	Name            string                 `json:"name"`
	TaskType        string                 `json:"task_type"`
	TrainingData    map[string]interface{} `json:"training_data"`
	Features        []string               `json:"features"`
	Target          string                 `json:"target"`
	Algorithm       string                 `json:"algorithm,omitempty"`
	Hyperparameters map[string]interface{} `json:"hyperparameters,omitempty"`
	ValidationSplit float64                `json:"validation_split,omitempty"`
}

// AutoMLPredictRequest request for predictions
type AutoMLPredictRequest struct {
	Features []map[string]interface{} `json:"features"`
}

// ============================================================================
// Invoice Models
// ============================================================================

// InvoiceLineItem invoice line item
type InvoiceLineItem struct {
	Description string  `json:"description"`
	Quantity    float64 `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	Total       float64 `json:"total"`
}

// InvoiceResponse invoice response
type InvoiceResponse struct {
	ID            string             `json:"id"`
	InvoiceNumber string             `json:"invoice_number"`
	Status        string             `json:"status"`
	ClientName    string             `json:"client_name"`
	ClientEmail   string             `json:"client_email"`
	IssueDate     string             `json:"issue_date"`
	DueDate       string             `json:"due_date"`
	LineItems     []InvoiceLineItem  `json:"line_items"`
	Subtotal      float64            `json:"subtotal"`
	Tax           float64            `json:"tax"`
	Total         float64            `json:"total"`
	Currency      string             `json:"currency,omitempty"`
	Notes         string             `json:"notes,omitempty"`
}

// InvoiceListResponse paginated list of invoices
type InvoiceListResponse struct {
	Invoices []InvoiceResponse `json:"invoices"`
	Total    int              `json:"total"`
	Skip     int              `json:"skip"`
	Limit    int              `json:"limit"`
}

// InvoiceCreateRequest request to create an invoice
type InvoiceCreateRequest struct {
	ClientName string            `json:"client_name"`
	ClientEmail string           `json:"client_email"`
	LineItems  []InvoiceLineItem `json:"line_items"`
	TaxRate    float64           `json:"tax_rate,omitempty"`
	DueDate    string            `json:"due_date"`
	Currency   string            `json:"currency,omitempty"`
	Notes      string            `json:"notes,omitempty"`
}

// ============================================================================
// Contract Models
// ============================================================================

// ContractResponse contract response
type ContractResponse struct {
	ID              string                 `json:"id"`
	ContractType    string                 `json:"contract_type"`
	Title           string                 `json:"title"`
	Parties         []string               `json:"parties"`
	Content         string                 `json:"content,omitempty"`
	Status          string                 `json:"status"`
	CreatedAt       string                 `json:"created_at"`
	EffectiveDate   string                 `json:"effective_date,omitempty"`
	ExpirationDate  string                 `json:"expiration_date,omitempty"`
}

// ContractGenerateRequest request to generate a contract
type ContractGenerateRequest struct {
	ContractType   string                 `json:"contract_type"`
	Title          string                 `json:"title"`
	Parties        []string               `json:"parties"`
	Terms          map[string]interface{} `json:"terms"`
	EffectiveDate  string                 `json:"effective_date,omitempty"`
	ExpirationDate string                 `json:"expiration_date,omitempty"`
}

// ============================================================================
// Digital Twin Models
// ============================================================================

// TwinResponse digital twin response
type TwinResponse struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	EntityType  string                 `json:"entity_type"`
	Description string                 `json:"description,omitempty"`
	State       map[string]interface{} `json:"state,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	SyncStatus  string                 `json:"sync_status,omitempty"`
	CreatedAt   string                 `json:"created_at"`
	UpdatedAt   string                 `json:"updated_at,omitempty"`
}

// TwinCreateRequest request to create a digital twin
type TwinCreateRequest struct {
	Name         string                 `json:"name"`
	EntityType  string                 `json:"entity_type"`
	Description string                 `json:"description,omitempty"`
	InitialState map[string]interface{} `json:"initial_state,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// TwinStateUpdateRequest request to update twin state
type TwinStateUpdateRequest struct {
	State map[string]interface{} `json:"state"`
}

// ============================================================================
// Ranking Models
// ============================================================================

// RankingScoreRequest request to score entities
type RankingScoreRequest struct {
	Entities     []map[string]interface{} `json:"entities"`
	RankingConfig map[string]interface{}  `json:"ranking_config"`
	Weights      map[string]float64      `json:"weights,omitempty"`
}

// RankingScoreResponse ranking score response
type RankingScoreResponse struct {
	Scores    []map[string]interface{} `json:"scores"`
	Total     int                      `json:"total"`
	Algorithm string                    `json:"algorithm"`
}

// ============================================================================
// Legal Models
// ============================================================================

// LegalResearchRequest legal research request
type LegalResearchRequest struct {
	Query        string `json:"query"`
	Jurisdiction string `json:"jurisdiction,omitempty"`
}

// LegalDocumentAnalysisRequest request to analyze a document
type LegalDocumentAnalysisRequest struct {
	DocumentText string `json:"document_text"`
}

// ComplianceCheckRequest compliance check request
type ComplianceCheckRequest struct {
	Requirements []string               `json:"requirements"`
	Context     map[string]interface{} `json:"context,omitempty"`
}

// ============================================================================
// Service-specific types
// ============================================================================

// ServiceInfo represents service information
type ServiceInfo struct {
	Name        string    `json:"name"`
	Version     string    `json:"version"`
	Status      string    `json:"status"`
	Uptime      float64   `json:"uptime"`
	LastUpdated time.Time `json:"last_updated"`
}

// Metrics represents service metrics
type Metrics struct {
	RequestsTotal   int64              `json:"requests_total"`
	RequestsSuccess int64              `json:"requests_success"`
	RequestsFailed  int64              `json:"requests_failed"`
	LatencyAvg     float64            `json:"latency_avg_ms"`
	LatencyP95     float64            `json:"latency_p95_ms"`
	LatencyP99     float64            `json:"latency_p99_ms"`
	ActiveWorkers  int                `json:"active_workers"`
	QueueDepth     int                `json:"queue_depth"`
}

// PaginationParams common pagination parameters
type PaginationParams struct {
	Skip  int `json:"skip"`
	Limit int `json:"limit"`
}

// ListOptions common list options
type ListOptions struct {
	Skip   int    `url:"skip"`
	Limit  int    `url:"limit"`
	Type   string `url:"type,omitempty"`
	Status string `url:"status,omitempty"`
}

// SortOptions sorting options
type SortOptions struct {
	Field     string `url:"field"`
	Direction string `url:"direction"` // asc or desc
}

// FilterOptions filtering options
type FilterOptions struct {
	Query map[string]string `url:"-"`
}

// Webhook webhook configuration
type Webhook struct {
	ID        string    `json:"id"`
	URL       string    `json:"url"`
	Events    []string  `json:"events"`
	Secret    string    `json:"secret,omitempty"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at"`
}

// WebhookEvent represents a webhook event
type WebhookEvent struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Data      map[string]interface{} `json:"data"`
	Timestamp time.Time              `json:"timestamp"`
}

// Tenant tenant information
type Tenant struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Plan      string                 `json:"plan"`
	Status    string                 `json:"status"`
	Config    map[string]interface{} `json:"config,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
}
