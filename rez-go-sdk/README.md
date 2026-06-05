# REZ Go SDK

A Go client for the REZ Agent OS ecosystem. Supports context cancellation, automatic retry, and comprehensive error handling.

## Installation

```bash
go get github.com/rez-io/rez-go
```

## Quick Start

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/rez-io/rez-go/rez"
)

func main() {
    // Create client
    client, err := rez.NewClient(
        rez.WithBaseURL("http://localhost:8080"),
        rez.WithAPIKey("your-api-key"),
    )
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    ctx := context.Background()

    // List agents
    agents, err := client.Agents.List(ctx, 0, 10)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Found %d agents\n", agents.Total)

    // Get single agent
    agent, err := client.Agents.Get(ctx, "fraud-agent")
    if err != nil {
        if rez.IsNotFound(err) {
            fmt.Println("Agent not found")
        } else {
            log.Fatal(err)
        }
    }
    fmt.Printf("Agent: %s\n", agent.Name)
}
```

## Configuration

```go
client, err := rez.NewClient(
    rez.WithBaseURL("https://api.rez.io"),
    rez.WithAPIKey("your-key"),
    rez.WithTimeout(60 * time.Second),  // Request timeout
    rez.WithMaxRetries(5),              // Max retry attempts
)
```

## Agent Registry

```go
// List agents
agents, err := client.Agents.List(ctx, skip, limit)

// Get agent
agent, err := client.Agents.Get(ctx, "agent-id")

// Register agent
req := rez.AgentCreateRequest{
    Name:        "sales-bot",
    Type:        "sales",
    Capabilities: []string{"lead_scoring"},
}
agent, err := client.Agents.Create(ctx, req)

// Update agent
req := rez.AgentUpdateRequest{Status: "active"}
agent, err := client.Agents.Update(ctx, "agent-id", req)

// Delete agent
err := client.Agents.Delete(ctx, "agent-id")

// Health check
health, err := client.Agents.HealthCheck(ctx)
```

## AutoML

```go
// Train model
req := rez.AutoMLTrainRequest{
    Name:     "fraud-detector",
    TaskType: "classification",
    TrainingData: map[string]interface{}{
        "features": []map[string]interface{}{
            {"amount": 100, "frequency": 5},
            {"amount": 5000, "frequency": 1},
        },
        "target": []int{0, 1},
    },
    Features: []string{"amount", "frequency"},
    Target:   "is_fraud",
}
model, err := client.AutoML.TrainModel(ctx, req)

// Predict
predictions, err := client.AutoML.Predict(ctx, model.ID, rez.AutoMLPredictRequest{
    Features: []map[string]interface{}{
        {"amount": 250, "frequency": 10},
    },
})

// List models
models, err := client.AutoML.ListModels(ctx, 0, 10)

// Delete model
err := client.AutoML.DeleteModel(ctx, modelID)
```

## Invoice

```go
// Create invoice
req := rez.InvoiceCreateRequest{
    ClientName:  "Acme Corp",
    ClientEmail: "billing@acme.com",
    LineItems: []rez.InvoiceLineItem{
        {
            Description: "Web Development",
            Quantity:    40,
            UnitPrice:   150,
            Total:       6000,
        },
    },
    TaxRate: 0.1,
    DueDate: "2024-12-31",
}
invoice, err := client.Invoice.Create(ctx, req)

// Get invoice
invoice, err := client.Invoice.Get(ctx, invoiceID)

// List invoices
invoices, err := client.Invoice.List(ctx, 0, 20, "paid")

// Validate invoice
result, err := client.Invoice.Validate(ctx, invoiceID)
```

## Contracts

```go
// Generate contract
req := rez.ContractGenerateRequest{
    ContractType: "nda",
    Title:        "Mutual NDA",
    Parties:      []string{"Acme Corp", "Partner Inc"},
    Terms: map[string]interface{}{
        "duration":     "2 years",
        "jurisdiction": "Delaware",
    },
}
contract, err := client.Contracts.Generate(ctx, req)

// Analyze contract
analysis, err := client.Contracts.Analyze(ctx, contractID)
```

## Digital Twin

```go
// Create twin
req := rez.TwinCreateRequest{
    Name:        "Factory-001",
    EntityType:  "factory",
    InitialState: map[string]interface{}{
        "temperature": 72.5,
        "pressure":   14.7,
    },
}
twin, err := client.Twin.Create(ctx, req)

// Update state
updated, err := client.Twin.UpdateState(ctx, twin.ID, map[string]interface{}{
    "temperature": 73.0,
})

// Sync
result, err := client.Twin.Sync(ctx, twin.ID)
```

## Ranking

```go
// Score entities
req := rez.RankingScoreRequest{
    Entities: []map[string]interface{}{
        {"id": "prod-1", "sales": 1000, "rating": 4.5},
        {"id": "prod-2", "sales": 5000, "rating": 4.0},
    },
    RankingConfig: map[string]interface{}{
        "algorithm": "weighted",
        "weights":   map[string]float64{"sales": 0.5, "rating": 0.5},
    },
}
result, err := client.Ranking.Score(ctx, req)

// Get top K
topK, err := client.Ranking.GetTopK(ctx, entities, 10, "weighted")
```

## GraphQL

```go
req := rez.GraphQLRequest{
    Query: `
        query GetAgents($type: String) {
            agents(type: $type) {
                id
                name
                status
            }
        }
    `,
    Variables: map[string]interface{}{
        "type": "sales",
    },
}
result, err := client.GraphQL.Execute(ctx, req)
if result.Data != nil {
    fmt.Printf("Data: %v\n", result.Data)
}
```

## Error Handling

```go
import "github.com/rez-io/rez-go/rez"

// Check error types
agent, err := client.Agents.Get(ctx, "non-existent")
if err != nil {
    if rez.IsNotFound(err) {
        fmt.Println("Agent not found")
    } else if rez.IsUnauthorized(err) {
        fmt.Println("Authentication failed")
    } else if rez.IsRateLimited(err) {
        fmt.Println("Rate limited, retry later")
    } else {
        log.Fatal(err)
    }
}

// Access API error details
if ae, ok := err.(*rez.APIError); ok {
    fmt.Printf("Error code: %s\n", ae.Error.Code)
    fmt.Printf("Message: %s\n", ae.Error.Message)
}
```

## Development

```bash
# Install dependencies
go mod tidy

# Build
go build ./...

# Run tests
go test ./...

# Run examples
go run examples/main.go
```

## License

MIT License