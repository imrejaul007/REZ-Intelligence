/*
REZ Go SDK - AutoML Service
*/
package rez

import (
	"context"
	"encoding/json"
	"fmt"
)

// AutoMLService handles AutoML operations
type AutoMLService struct {
	client *Client
}

// ListModels retrieves all trained models
func (s *AutoMLService) ListModels(ctx context.Context, skip, limit int) ([]AutoMLModel, error) {
	params := map[string]string{
		"skip":  fmt.Sprintf("%d", skip),
		"limit": fmt.Sprintf("%d", limit),
	}

	data, status, err := s.client.doGet(ctx, "/api/automl/models", params)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp struct {
		Models []AutoMLModel `json:"models"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return resp.Models, nil
}

// GetModel retrieves a model by ID
func (s *AutoMLService) GetModel(ctx context.Context, modelID string) (*AutoMLModel, error) {
	data, status, err := s.client.doGet(ctx, "/api/automl/models/"+modelID, nil)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp AutoMLModel
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}

// TrainModel starts a new model training job
func (s *AutoMLService) TrainModel(ctx context.Context, req AutoMLTrainRequest) (*AutoMLModel, error) {
	data, status, err := s.client.doPost(ctx, "/api/automl/train", req)
	if err != nil {
		return nil, err
	}

	if status >= 400 {
		return nil, fmt.Errorf("API error: %d", status)
	}

	var resp AutoMLModel
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}

// Predict runs inference with a trained model
func (s *AutoMLService) Predict(ctx context.Context, modelID string, req AutoMLPredictRequest) (map[string]interface{}, error) {
	data, status, err := s.client.doPost(ctx, "/api/automl/predict/"+modelID, req)
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

// DeleteModel deletes a trained model
func (s *AutoMLService) DeleteModel(ctx context.Context, modelID string) error {
	_, status, err := s.client.doDelete(ctx, "/api/automl/models/"+modelID)
	if err != nil {
		return err
	}

	if status >= 400 {
		return fmt.Errorf("API error: %d", status)
	}

	return nil
}