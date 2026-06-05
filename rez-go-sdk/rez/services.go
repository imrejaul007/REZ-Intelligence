/*
REZ Go SDK - Invoice, Contracts, Legal, Twin, Ranking, GraphQL Services
*/
package rez

import (
	"context"
	"encoding/json"
	"fmt"
)

// ============================================================================
// Invoice Service
// ============================================================================

// InvoiceService handles invoice operations
type InvoiceService struct {
	client *Client
}

// CreateInvoice creates a new invoice
func (s *InvoiceService) Create(ctx context.Context, req InvoiceCreateRequest) (*InvoiceResponse, error) {
	data, status, err := s.client.doPost(ctx, "/api/invoice/create", req)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp InvoiceResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}

// GetInvoice retrieves an invoice by ID
func (s *InvoiceService) Get(ctx context.Context, invoiceID string) (*InvoiceResponse, error) {
	data, status, err := s.client.doGet(ctx, "/api/invoice/"+invoiceID, nil)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp InvoiceResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}

// List retrieves all invoices
func (s *InvoiceService) List(ctx context.Context, skip, limit int, status string) (*InvoiceListResponse, error) {
	params := map[string]string{
		"skip":  fmt.Sprintf("%d", skip),
		"limit": fmt.Sprintf("%d", limit),
	}
	if status != "" {
		params["status"] = status
	}

	data, status, err := s.client.doGet(ctx, "/api/invoice/list", params)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp InvoiceListResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}

// Validate validates an invoice
func (s *InvoiceService) Validate(ctx context.Context, invoiceID string) (map[string]interface{}, error) {
	data, status, err := s.client.doPost(ctx, "/api/invoice/validate/"+invoiceID, nil)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return resp, nil
}

// ============================================================================
// Contracts Service
// ============================================================================

// ContractsService handles contract operations
type ContractsService struct {
	client *Client
}

// Generate generates a new contract
func (s *ContractsService) Generate(ctx context.Context, req ContractGenerateRequest) (*ContractResponse, error) {
	data, status, err := s.client.doPost(ctx, "/api/contracts/generate", req)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp ContractResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}

// Get retrieves a contract by ID
func (s *ContractsService) Get(ctx context.Context, contractID string) (*ContractResponse, error) {
	data, status, err := s.client.doGet(ctx, "/api/contracts/"+contractID, nil)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp ContractResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}

// Analyze analyzes a contract
func (s *ContractsService) Analyze(ctx context.Context, contractID string) (map[string]interface{}, error) {
	data, status, err := s.client.doPost(ctx, "/api/contracts/analyze/"+contractID, nil)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return resp, nil
}

// ============================================================================
// Legal Service
// ============================================================================

// LegalService handles legal operations
type LegalService struct {
	client *Client
}

// Research performs legal research
func (s *LegalService) Research(ctx context.Context, query, jurisdiction string) (map[string]interface{}, error) {
	path := "/api/legal/research?query=" + query
	if jurisdiction != "" {
		path += "&jurisdiction=" + jurisdiction
	}

	data, status, err := s.client.doGet(ctx, path, nil)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return resp, nil
}

// AnalyzeDocument analyzes a legal document
func (s *LegalService) AnalyzeDocument(ctx context.Context, documentText string) (map[string]interface{}, error) {
	req := map[string]string{"document_text": documentText}
	data, status, err := s.client.doPost(ctx, "/api/legal/analyze", req)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return resp, nil
}

// CheckCompliance checks compliance
func (s *LegalService) CheckCompliance(ctx context.Context, requirements []string, context_ map[string]interface{}) (map[string]interface{}, error) {
	req := map[string]interface{}{
		"requirements": requirements,
		"context":      context_,
	}
	data, status, err := s.client.doPost(ctx, "/api/legal/compliance", req)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return resp, nil
}

// ============================================================================
// Twin Service
// ============================================================================

// TwinService handles digital twin operations
type TwinService struct {
	client *Client
}

// Create creates a new digital twin
func (s *TwinService) Create(ctx context.Context, req TwinCreateRequest) (*TwinResponse, error) {
	data, status, err := s.client.doPost(ctx, "/api/twin/create", req)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp TwinResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}

// Get retrieves a twin by ID
func (s *TwinService) Get(ctx context.Context, twinID string) (*TwinResponse, error) {
	data, status, err := s.client.doGet(ctx, "/api/twin/"+twinID, nil)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp TwinResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}

// GetState retrieves twin state
func (s *TwinService) GetState(ctx context.Context, twinID string) (map[string]interface{}, error) {
	data, status, err := s.client.doGet(ctx, "/api/twin/"+twinID+"/state", nil)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return resp, nil
}

// UpdateState updates twin state
func (s *TwinService) UpdateState(ctx context.Context, twinID string, state map[string]interface{}) (map[string]interface{}, error) {
	req := TwinStateUpdateRequest{State: state}
	data, status, err := s.client.doPost(ctx, "/api/twin/"+twinID+"/state", req)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return resp, nil
}

// Sync synchronizes twin
func (s *TwinService) Sync(ctx context.Context, twinID string) (map[string]interface{}, error) {
	data, status, err := s.client.doPost(ctx, "/api/twin/"+twinID+"/sync", nil)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return resp, nil
}

// ============================================================================
// Ranking Service
// ============================================================================

// RankingService handles ranking operations
type RankingService struct {
	client *Client
}

// ScoreEntities scores and ranks entities
func (s *RankingService) Score(ctx context.Context, req RankingScoreRequest) (*RankingScoreResponse, error) {
	data, status, err := s.client.doPost(ctx, "/api/ranking/score", req)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp RankingScoreResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}

// GetTopK retrieves top K ranked entities
func (s *RankingService) GetTopK(ctx context.Context, entities []map[string]interface{}, k int, algorithm string) ([]map[string]interface{}, error) {
	req := map[string]interface{}{
		"entities":  entities,
		"k":        k,
		"algorithm": algorithm,
	}
	data, status, err := s.client.doPost(ctx, "/api/ranking/top-k", req)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp struct {
		Entities []map[string]interface{} `json:"entities"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return resp.Entities, nil
}

// ============================================================================
// GraphQL Service
// ============================================================================

// GraphQLService handles GraphQL operations
type GraphQLService struct {
	client *Client
}

// Execute executes a GraphQL query
func (s *GraphQLService) Execute(ctx context.Context, req GraphQLRequest) (*GraphQLResponse, error) {
	data, status, err := s.client.doPost(ctx, "/graphql", req)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp GraphQLResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}