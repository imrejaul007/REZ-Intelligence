package io.rez.sdk;

import java.util.*;

/**
 * REZ Java SDK - Agent Service
 */
public class AgentService {
    private final REZClient client;

    public AgentService(REZClient client) {
        this.client = client;
    }

    public Models.AgentList list(int skip, int limit) throws REZException {
        Map<String, String> params = new HashMap<>();
        params.put("skip", String.valueOf(skip));
        params.put("limit", String.valueOf(limit));
        Models.AgentListResponse response = client.get("/api/agents", params, Models.AgentListResponse.class);
        return new Models.AgentList(response.agents, response.total, response.skip, response.limit);
    }

    public Models.AgentList list() throws REZException {
        return list(0, 20);
    }

    public Models.Agent get(String agentId) throws REZException {
        return client.get("/api/agents/" + agentId, Models.Agent.class);
    }

    public Models.Agent create(Models.AgentCreateRequest request) throws REZException {
        return client.post("/api/agents", request, Models.Agent.class);
    }

    public Models.Agent update(String agentId, Models.AgentUpdateRequest request) throws REZException {
        return client.put("/api/agents/" + agentId, request, Models.Agent.class);
    }

    public void delete(String agentId) throws REZException {
        client.delete("/api/agents/" + agentId);
    }

    public Models.HealthResponse healthCheck() throws REZException {
        return client.get("/health", Models.HealthResponse.class);
    }
}

/**
 * REZ Java SDK - AutoML Service
 */
class AutoMLService {
    private final REZClient client;

    AutoMLService(REZClient client) {
        this.client = client;
    }

    public List<Models.AutoMLModel> listModels(int skip, int limit) throws REZException {
        Map<String, String> params = new HashMap<>();
        params.put("skip", String.valueOf(skip));
        params.put("limit", String.valueOf(limit));
        Models.ModelsResponse response = client.get("/api/automl/models", params, Models.ModelsResponse.class);
        return response.models != null ? response.models : Collections.emptyList();
    }

    public Models.AutoMLModel getModel(String modelId) throws REZException {
        return client.get("/api/automl/models/" + modelId, Models.AutoMLModel.class);
    }

    public Models.AutoMLModel train(Models.AutoMLTrainRequest request) throws REZException {
        return client.post("/api/automl/train", request, Models.AutoMLModel.class);
    }

    public Map<String, Object> predict(String modelId, Models.AutoMLPredictRequest request) throws REZException {
        return client.post("/api/automl/predict/" + modelId, request, Map.class);
    }

    public void deleteModel(String modelId) throws REZException {
        client.delete("/api/automl/models/" + modelId);
    }
}

/**
 * REZ Java SDK - Invoice Service
 */
class InvoiceService {
    private final REZClient client;

    InvoiceService(REZClient client) {
        this.client = client;
    }

    public Models.InvoiceResponse create(Models.InvoiceCreateRequest request) throws REZException {
        return client.post("/api/invoice/create", request, Models.InvoiceResponse.class);
    }

    public Models.InvoiceResponse get(String invoiceId) throws REZException {
        return client.get("/api/invoice/" + invoiceId, Models.InvoiceResponse.class);
    }

    public Models.InvoiceList list(int skip, int limit, String status) throws REZException {
        Map<String, String> params = new HashMap<>();
        params.put("skip", String.valueOf(skip));
        params.put("limit", String.valueOf(limit));
        if (status != null) params.put("status", status);
        Models.InvoiceListResponse response = client.get("/api/invoice/list", params, Models.InvoiceListResponse.class);
        return new Models.InvoiceList(response.invoices, response.total, response.skip, response.limit);
    }

    public Map<String, Object> validate(String invoiceId) throws REZException {
        return client.post("/api/invoice/validate/" + invoiceId, null, Map.class);
    }
}

/**
 * REZ Java SDK - Contracts Service
 */
class ContractsService {
    private final REZClient client;

    ContractsService(REZClient client) {
        this.client = client;
    }

    public Models.ContractResponse generate(Models.ContractGenerateRequest request) throws REZException {
        return client.post("/api/contracts/generate", request, Models.ContractResponse.class);
    }

    public Models.ContractResponse get(String contractId) throws REZException {
        return client.get("/api/contracts/" + contractId, Models.ContractResponse.class);
    }

    public Map<String, Object> analyze(String contractId) throws REZException {
        return client.post("/api/contracts/analyze/" + contractId, null, Map.class);
    }
}

/**
 * REZ Java SDK - Legal Service
 */
class LegalService {
    private final REZClient client;

    LegalService(REZClient client) {
        this.client = client;
    }

    public Map<String, Object> research(String query, String jurisdiction) throws REZException {
        String path = "/api/legal/research?query=" + query;
        if (jurisdiction != null) {
            path += "&jurisdiction=" + jurisdiction;
        }
        return client.get(path, Map.class);
    }

    public Map<String, Object> analyzeDocument(String documentText) throws REZException {
        Map<String, String> request = new HashMap<>();
        request.put("document_text", documentText);
        return client.post("/api/legal/analyze", request, Map.class);
    }

    public Map<String, Object> checkCompliance(List<String> requirements, Map<String, Object> context) throws REZException {
        Map<String, Object> request = new HashMap<>();
        request.put("requirements", requirements);
        request.put("context", context != null ? context : new HashMap<>());
        return client.post("/api/legal/compliance", request, Map.class);
    }
}

/**
 * REZ Java SDK - Twin Service
 */
class TwinService {
    private final REZClient client;

    TwinService(REZClient client) {
        this.client = client;
    }

    public Models.TwinResponse create(Models.TwinCreateRequest request) throws REZException {
        return client.post("/api/twin/create", request, Models.TwinResponse.class);
    }

    public Models.TwinResponse get(String twinId) throws REZException {
        return client.get("/api/twin/" + twinId, Models.TwinResponse.class);
    }

    public Map<String, Object> getState(String twinId) throws REZException {
        return client.get("/api/twin/" + twinId + "/state", Map.class);
    }

    public Map<String, Object> updateState(String twinId, Map<String, Object> state) throws REZException {
        return client.post("/api/twin/" + twinId + "/state", new Models.TwinStateUpdateRequest(state), Map.class);
    }

    public Map<String, Object> sync(String twinId) throws REZException {
        return client.post("/api/twin/" + twinId + "/sync", null, Map.class);
    }
}

/**
 * REZ Java SDK - Ranking Service
 */
class RankingService {
    private final REZClient client;

    RankingService(REZClient client) {
        this.client = client;
    }

    public Models.RankingScoreResponse score(Models.RankingScoreRequest request) throws REZException {
        return client.post("/api/ranking/score", request, Models.RankingScoreResponse.class);
    }

    public List<Map<String, Object>> getTopK(List<Map<String, Object>> entities, int k, String algorithm) throws REZException {
        Map<String, Object> request = new HashMap<>();
        request.put("entities", entities);
        request.put("k", k);
        request.put("algorithm", algorithm);
        Models.TopKResponse response = client.post("/api/ranking/top-k", request, Models.TopKResponse.class);
        return response.entities;
    }
}

/**
 * REZ Java SDK - GraphQL Service
 */
class GraphQLService {
    private final REZClient client;

    GraphQLService(REZClient client) {
        this.client = client;
    }

    public Models.GraphQLResponse execute(String query) throws REZException {
        return client.post("/graphql", new Models.GraphQLRequest(query), Models.GraphQLResponse.class);
    }

    public Models.GraphQLResponse execute(String query, Map<String, Object> variables) throws REZException {
        return client.post("/graphql", new Models.GraphQLRequest(query, variables), Models.GraphQLResponse.class);
    }
}