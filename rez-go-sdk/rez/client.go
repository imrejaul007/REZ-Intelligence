/*
REZ Go SDK - Main Client

Provides a Go client for interacting with the REZ Agent OS ecosystem.
Supports automatic retry, context cancellation, and comprehensive error handling.
*/
package rez

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// Config holds client configuration
type Config struct {
	BaseURL    string
	APIKey     string
	Timeout    time.Duration
	MaxRetries int
}

// Client is the main REZ client
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	maxRetries int
	mu         sync.RWMutex

	Agents     *AgentService
	AutoML     *AutoMLService
	Invoice    *InvoiceService
	Contracts  *ContractsService
	Legal      *LegalService
	Twin       *TwinService
	Ranking    *RankingService
	GraphQL    *GraphQLService
}

// NewClient creates a new REZ client
func NewClient(opts ...Option) (*Client, error) {
	cfg := Config{
		BaseURL:    "http://localhost:8080",
		Timeout:    30 * time.Second,
		MaxRetries: 3,
	}

	for _, opt := range opts {
		opt(&cfg)
	}

	if cfg.BaseURL == "" {
		return nil, fmt.Errorf("baseURL is required")
	}

	client := &Client{
		baseURL:    cfg.BaseURL,
		apiKey:     cfg.APIKey,
		maxRetries: cfg.MaxRetries,
		httpClient: &http.Client{
			Timeout: cfg.Timeout,
		},
	}

	// Initialize services
	client.Agents = &AgentService{client: client}
	client.AutoML = &AutoMLService{client: client}
	client.Invoice = &InvoiceService{client: client}
	client.Contracts = &ContractsService{client: client}
	client.Legal = &LegalService{client: client}
	client.Twin = &TwinService{client: client}
	client.Ranking = &RankingService{client: client}
	client.GraphQL = &GraphQLService{client: client}

	return client, nil
}

// Option configures the client
type Option func(*Config)

// WithBaseURL sets the base URL
func WithBaseURL(url string) Option {
	return func(c *Config) {
		c.BaseURL = url
	}
}

// WithAPIKey sets the API key
func WithAPIKey(key string) Option {
	return func(c *Config) {
		c.APIKey = key
	}
}

// WithTimeout sets the request timeout
func WithTimeout(timeout time.Duration) Option {
	return func(c *Config) {
		c.Timeout = timeout
	}
}

// WithMaxRetries sets max retry attempts
func WithMaxRetries(n int) Option {
	return func(c *Config) {
		c.MaxRetries = n
	}
}

// Error represents an API error
type Error struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details,omitempty"`
}

func (e *Error) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// APIError wraps API errors
type APIError struct {
	StatusCode int
	Error      *Error
}

func (e *APIError) Error() string {
	if e.Error != nil {
		return e.Error.Error()
	}
	return fmt.Sprintf("API error: %d", e.StatusCode)
}

// IsNotFound checks if error is a not found error
func IsNotFound(err error) bool {
	if ae, ok := err.(*APIError); ok {
		return ae.StatusCode == 404
	}
	return false
}

// IsUnauthorized checks if error is an auth error
func IsUnauthorized(err error) bool {
	if ae, ok := err.(*APIError); ok {
		return ae.StatusCode == 401
	}
	return false
}

// IsRateLimited checks if error is a rate limit error
func IsRateLimited(err error) bool {
	if ae, ok := err.(*APIError); ok {
		return ae.StatusCode == 429
	}
	return false
}

// Response common response structure
type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *Error      `json:"error,omitempty"`
}

// HealthResponse health check response
type HealthResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	Version   string `json:"version,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
	Error     string `json:"error,omitempty"`
}

// doRequest performs an HTTP request with retry logic
func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}) ([]byte, int, error) {
	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to marshal request: %w", err)
		}
		reqBody = bytes.NewReader(jsonData)
	}

	url := c.baseURL + path
	if method == "GET" && body != nil {
		// For GET, encode body as query params if needed
		q := reqBody
		q.Close()
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("X-API-Key", c.apiKey)
	}

	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("request failed: %w", err)
			time.Sleep(time.Duration(attempt+1) * time.Second)
			continue
		}

		defer resp.Body.Close()
		respBody, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			lastErr = fmt.Errorf("failed to read response: %w", readErr)
			continue
		}

		// Handle error responses
		if resp.StatusCode >= 400 {
			var apiErr APIError
			apiErr.StatusCode = resp.StatusCode

			if len(respBody) > 0 {
				var errResp struct {
					Error *Error `json:"error"`
				}
				if json.Unmarshal(respBody, &errResp) == nil && errResp.Error != nil {
					apiErr.Error = errResp.Error
				}
			}

			// Retry on 5xx and 429
			if resp.StatusCode >= 500 || resp.StatusCode == 429 {
				lastErr = &apiErr
				time.Sleep(time.Duration(attempt+1) * time.Second)
				continue
			}

			return respBody, resp.StatusCode, &apiErr
		}

		return respBody, resp.StatusCode, nil
	}

	return nil, 0, lastErr
}

// doGet performs a GET request
func (c *Client) doGet(ctx context.Context, path string, params map[string]string) ([]byte, int, error) {
	if params != nil && len(params) > 0 {
		sep := "?"
		for k, v := range params {
			path += sep + k + "=" + v
			sep = "&"
		}
	}
	return c.doRequest(ctx, "GET", path, nil)
}

// doPost performs a POST request
func (c *Client) doPost(ctx context.Context, path string, body interface{}) ([]byte, int, error) {
	return c.doRequest(ctx, "POST", path, body)
}

// doPut performs a PUT request
func (c *Client) doPut(ctx context.Context, path string, body interface{}) ([]byte, int, error) {
	return c.doRequest(ctx, "PUT", path, body)
}

// doDelete performs a DELETE request
func (c *Client) doDelete(ctx context.Context, path string) ([]byte, int, error) {
	return c.doRequest(ctx, "DELETE", path, nil)
}

// Close closes the client (for interface compliance)
func (c *Client) Close() error {
	return nil
}

// HealthCheck checks the health of all services
func (c *Client) HealthCheck(ctx context.Context) (map[string]HealthResponse, error) {
	services := []string{"agents", "automl", "invoice", "contracts", "legal", "twin", "ranking", "graphql"}
	results := make(map[string]HealthResponse)

	for _, svc := range services {
		resp, err := c.Agents.HealthCheck(ctx)
		if err != nil {
			results[svc] = HealthResponse{
				Status:  "down",
				Service: svc,
				Error:   err.Error(),
			}
		} else {
			results[svc] = *resp
		}
	}

	return results, nil
}