# REZ Java SDK

A Java client for the REZ Agent OS ecosystem. Supports automatic retry, comprehensive error handling, and all REZ services.

## Installation

### Maven

```xml
<dependency>
    <groupId>io.rez</groupId>
    <artifactId>rez-java-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Gradle

```groovy
implementation 'io.rez:rez-java-sdk:1.0.0'
```

### Manual

Download from [GitHub Releases](https://github.com/rez-io/rez-java-sdk/releases) and add to classpath.

## Quick Start

```java
import io.rez.sdk.REZClient;

public class Example {
    public static void main(String[] args) {
        try (REZClient client = REZClient.builder()
            .baseUrl("http://localhost:8080")
            .apiKey("your-api-key")
            .build()) {

            // List agents
            AgentList agents = client.agents().list(0, 10);
            System.out.println("Found " + agents.total + " agents");

            // Get single agent
            Agent agent = client.agents().get("fraud-agent");
            System.out.println("Agent: " + agent.name);

        } catch (REZException e) {
            e.printStackTrace();
        }
    }
}
```

## Configuration

```java
REZClient client = REZClient.builder()
    .baseUrl("https://api.rez.io")           // API base URL
    .apiKey("your-key")                      // API key
    .timeout(Duration.ofMinutes(1))          // Request timeout
    .maxRetries(5)                           // Max retry attempts
    .build();
```

## Agent Service

```java
// List agents
AgentList list = client.agents().list(0, 20);

// Get agent
Agent agent = client.agents().get("fraud-agent");

// Create agent
AgentCreateRequest request = new AgentCreateRequest("sales-bot", "sales");
request.setCapabilities(List.of("lead_scoring", "recommendation"));
Agent created = client.agents().create(request);

// Update agent
AgentUpdateRequest update = new AgentUpdateRequest();
update.setStatus("active");
Agent updated = client.agents().update("agent-id", update);

// Delete agent
client.agents().delete("agent-id");

// Health check
HealthResponse health = client.agents().healthCheck();
```

## AutoML Service

```java
// Train model
AutoMLTrainRequest trainReq = new AutoMLTrainRequest("fraud-detector", "classification");
trainReq.setTrainingData(Map.of(
    "features", List.of(Map.of("amount", 100), Map.of("amount", 5000)),
    "target", List.of(0, 1)
));
trainReq.setFeatures(List.of("amount"));
trainReq.setTarget("is_fraud");
AutoMLModel model = client.automl().train(trainReq);

// Predict
AutoMLPredictRequest predictReq = new AutoMLPredictRequest(
    List.of(Map.of("amount", 250))
);
Map<String, Object> predictions = client.automl().predict(model.id, predictReq);

// List models
List<AutoMLModel> models = client.automl().listModels(0, 10);
```

## Invoice Service

```java
// Create invoice
InvoiceCreateRequest req = new InvoiceCreateRequest("Acme Corp", "billing@acme.com", "2024-12-31");
req.setLineItems(List.of(
    new InvoiceLineItem("Web Development", 40, 150.0),
    new InvoiceLineItem("UI/UX Design", 20, 125.0)
));
req.setTaxRate(0.1);
InvoiceResponse invoice = client.invoice().create(req);

// Get invoice
InvoiceResponse invoice = client.invoice().get("invoice-id");

// List invoices
InvoiceList list = client.invoice().list(0, 20, "paid");

// Validate
Map<String, Object> validation = client.invoice().validate("invoice-id");
```

## Contracts Service

```java
// Generate contract
ContractGenerateRequest req = new ContractGenerateRequest("nda", "Mutual NDA",
    List.of("Acme Corp", "Partner Inc"));
req.setTerms(Map.of("duration", "2 years", "jurisdiction", "Delaware"));
ContractResponse contract = client.contracts().generate(req);

// Analyze contract
Map<String, Object> analysis = client.contracts().analyze(contract.id);
```

## Digital Twin Service

```java
// Create twin
TwinCreateRequest req = new TwinCreateRequest("Factory-001", "factory");
req.setInitialState(Map.of("temperature", 72.5, "pressure", 14.7));
TwinResponse twin = client.twin().create(req);

// Update state
Map<String, Object> newState = Map.of("temperature", 73.0);
client.twin().updateState(twin.id, newState);

// Sync
Map<String, Object> result = client.twin().sync(twin.id);
```

## Ranking Service

```java
// Score entities
RankingScoreRequest req = new RankingScoreRequest(
    List.of(
        Map.of("id", "prod-1", "sales", 1000, "rating", 4.5),
        Map.of("id", "prod-2", "sales", 5000, "rating", 4.0)
    ),
    Map.of("algorithm", "weighted", "weights", Map.of("sales", 0.5, "rating", 0.5))
);
RankingScoreResponse result = client.ranking().score(req);

// Get top K
List<Map<String, Object>> topK = client.ranking().getTopK(entities, 10, "weighted");
```

## GraphQL Service

```java
// Simple query
GraphQLResponse response = client.graphql().execute(
    "{ agents(skip: 0, limit: 10) { id name type } }"
);

// Query with variables
GraphQLResponse response = client.graphql().execute(
    "query GetAgents($type: String) { agents(type: $type) { id name } }",
    Map.of("type", "sales")
);
```

## Error Handling

```java
try {
    Agent agent = client.agents().get("non-existent");
} catch (REZException e) {
    if (e instanceof APIException) {
        APIException apiEx = (APIException) e;
        System.out.println("Status: " + apiEx.getStatusCode());

        if (apiEx.isNotFound()) {
            System.out.println("Agent not found");
        } else if (apiEx.isUnauthorized()) {
            System.out.println("Authentication failed");
        } else if (apiEx.isRateLimited()) {
            System.out.println("Rate limited");
        } else if (apiEx.isServerError()) {
            System.out.println("Server error");
        }
    }
}
```

## Development

```bash
# Build
./gradlew build

# Run tests
./gradlew test

# Publish
./gradlew publish
```

## Dependencies

- Apache HttpClient 4.5.14
- Jackson 2.16.0
- Jakarta Validation 3.0.2
- SLF4J 2.0.9

## License

MIT License