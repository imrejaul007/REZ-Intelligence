/*
REZ Go SDK - Agent Service
*/
package rez

import (
	"context"
	"encoding/json"
	"fmt"
)

// AgentService handles agent operations
type AgentService struct {
	client *Client
}

// List retrieves all agents
func (s *AgentService) List(ctx context.Context, skip, limit int) (*AgentListResponse, error) {
	params := map[string]string{
		"skip":  fmt.Sprintf("%d", skip),
		"limit": fmt.Sprintf("%d", limit),
	}

	data, status, err := s.client.doGet(ctx, "/api/agents", params)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp AgentListResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}

// Get retrieves a single agent by ID
func (s *AgentService) Get(ctx context.Context, agentID string) (*Agent, error) {
	data, status, err := s.client.doGet(ctx, "/api/agents/"+agentID, nil)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp Agent
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}

// Create registers a new agent
func (s *AgentService) Create(ctx context.Context, req AgentCreateRequest) (*Agent, error) {
	data, status, err := s.client.doPost(ctx, "/api/agents", req)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp Agent
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}

// Update updates an existing agent
func (s *AgentService) Update(ctx context.Context, agentID string, req AgentUpdateRequest) (*Agent, error) {
	data, status, err := s.client.doPut(ctx, "/api/agents/"+agentID, req)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp Agent
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}

// Delete removes an agent
func (s *AgentService) Delete(ctx context.Context, agentID string) error {
	_, status, err := s.client.doDelete(ctx, "/api/agents/"+agentID)
	if err != nil {
		return err
	}

	if status >= 400 {
		return fmt.Errorf("API error: %d", status)
	}

	return nil
}

// HealthCheck checks agent service health
func (s *AgentService) HealthCheck(ctx context.Context) (*HealthResponse, error) {
	data, status, err := s.client.doGet(ctx, "/health", nil)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp HealthResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}
