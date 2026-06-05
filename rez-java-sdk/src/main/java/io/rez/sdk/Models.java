package io.rez.sdk;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

/**
 * REZ Java SDK - Data Models
 *
 * POJOs for request/response serialization.
 */
public class Models {

    // ============================================================================
    // Common Models
    // ============================================================================

    /** Health check response */
    public static class HealthResponse {
        public String status;
        public String service;
        public String version;
        public String timestamp;
        public String error;

        public HealthResponse() {}

        public HealthResponse(String status, String service) {
            this.status = status;
            this.service = service;
        }
    }

    // ============================================================================
    // Agent Models
    // ============================================================================

    /** AI Agent model */
    public static class Agent {
        public String id;
        public String name;
        public String type;
        public String description;
        public List<String> capabilities;
        public String status;
        public Map<String, Object> config;
        public Map<String, Object> metadata;
        public String created_at;
        public String updated_at;

        public Agent() {}

        @Override
        public String toString() {
            return "Agent{id='" + id + "', name='" + name + "', type='" + type + "'}";
        }
    }

    /** Paginated list of agents */
    public static class AgentListResponse {
        public List<Agent> agents;
        public int total;
        public int skip;
        public int limit;
    }

    /** Request to create an agent */
    public static class AgentCreateRequest {
        public String name;
        public String type;
        public String description;
        public List<String> capabilities;
        public Map<String, Object> config;
        public Map<String, Object> metadata;

        public AgentCreateRequest() {}

        public AgentCreateRequest(String name, String type) {
            this.name = name;
            this.type = type;
        }

        public AgentCreateRequest name(String name) {
            this.name = name;
            return this;
        }

        public AgentCreateRequest type(String type) {
            this.type = type;
            return this;
        }

        public AgentCreateRequest description(String description) {
            this.description = description;
            return this;
        }

        public AgentCreateRequest capabilities(List<String> capabilities) {
            this.capabilities = capabilities;
            return this;
        }

        public AgentCreateRequest config(Map<String, Object> config) {
            this.config = config;
            return this;
        }

        public AgentCreateRequest metadata(Map<String, Object> metadata) {
            this.metadata = metadata;
            return this;
        }
    }

    /** Request to update an agent */
    public static class AgentUpdateRequest {
        public String name;
        public String description;
        public List<String> capabilities;
        public String status;
        public Map<String, Object> config;
        public Map<String, Object> metadata;

        public AgentUpdateRequest() {}

        public AgentUpdateRequest status(String status) {
            this.status = status;
            return this;
        }
    }

    // ============================================================================
    // GraphQL Models
    // ============================================================================

    /** GraphQL query request */
    public static class GraphQLRequest {
        public String query;
        public Map<String, Object> variables;
        public String operationName;

        public GraphQLRequest() {}

        public GraphQLRequest(String query) {
            this.query = query;
        }

        public GraphQLRequest(String query, Map<String, Object> variables) {
            this.query = query;
            this.variables = variables;
        }
    }

    /** GraphQL response */
    public static class GraphQLResponse {
        public Map<String, Object> data;
        public List<Map<String, Object>> errors;
    }

    // ============================================================================
    // AutoML Models
    // ============================================================================

    /** AutoML trained model */
    public static class AutoMLModel {
        public String id;
        public String name;
        public String task_type;
        public String algorithm;
        public String status;
        public Map<String, Double> metrics;
        public List<String> features;
        public String target;
        public String created_at;
        public Double accuracy;
        public Double f1_score;
    }

    /** Request to train an AutoML model */
    public static class AutoMLTrainRequest {
        public String name;
        public String task_type;
        public Map<String, Object> training_data;
        public List<String> features;
        public String target;
        public String algorithm;
        public Map<String, Object> hyperparameters;
        public double validation_split;

        public AutoMLTrainRequest() {
            this.algorithm = "auto";
            this.validation_split = 0.2;
        }

        public AutoMLTrainRequest(String name, String taskType) {
            this();
            this.name = name;
            this.task_type = taskType;
        }
    }

    /** Request for predictions */
    public static class AutoMLPredictRequest {
        public List<Map<String, Object>> features;

        public AutoMLPredictRequest() {}

        public AutoMLPredictRequest(List<Map<String, Object>> features) {
            this.features = features;
        }
    }

    /** Response for model list */
    public static class ModelsResponse {
        public List<AutoMLModel> models;
    }

    // ============================================================================
    // Invoice Models
    // ============================================================================

    /** Invoice line item */
    public static class InvoiceLineItem {
        public String description;
        public double quantity;
        public double unit_price;
        public double total;

        public InvoiceLineItem() {}

        public InvoiceLineItem(String description, double quantity, double unitPrice) {
            this.description = description;
            this.quantity = quantity;
            this.unit_price = unitPrice;
            this.total = quantity * unitPrice;
        }
    }

    /** Invoice response */
    public static class InvoiceResponse {
        public String id;
        public String invoice_number;
        public String status;
        public String client_name;
        public String client_email;
        public String issue_date;
        public String due_date;
        public List<InvoiceLineItem> line_items;
        public double subtotal;
        public double tax;
        public double total;
        public String currency;
        public String notes;
    }

    /** Paginated list of invoices */
    public static class InvoiceListResponse {
        public List<InvoiceResponse> invoices;
        public int total;
        public int skip;
        public int limit;
    }

    /** Request to create an invoice */
    public static class InvoiceCreateRequest {
        public String client_name;
        public String client_email;
        public List<InvoiceLineItem> line_items;
        public double tax_rate;
        public String due_date;
        public String currency;
        public String notes;

        public InvoiceCreateRequest() {
            this.currency = "USD";
            this.tax_rate = 0.0;
        }

        public InvoiceCreateRequest(String clientName, String clientEmail, String dueDate) {
            this();
            this.client_name = clientName;
            this.client_email = clientEmail;
            this.due_date = dueDate;
        }
    }

    // ============================================================================
    // Contract Models
    // ============================================================================

    /** Contract response */
    public static class ContractResponse {
        public String id;
        public String contract_type;
        public String title;
        public List<String> parties;
        public String content;
        public String status;
        public String created_at;
        public String effective_date;
        public String expiration_date;
    }

    /** Request to generate a contract */
    public static class ContractGenerateRequest {
        public String contract_type;
        public String title;
        public List<String> parties;
        public Map<String, Object> terms;
        public String effective_date;
        public String expiration_date;

        public ContractGenerateRequest() {}

        public ContractGenerateRequest(String contractType, String title, List<String> parties) {
            this.contract_type = contractType;
            this.title = title;
            this.parties = parties;
        }
    }

    // ============================================================================
    // Digital Twin Models
    // ============================================================================

    /** Digital twin response */
    public static class TwinResponse {
        public String id;
        public String name;
        public String entity_type;
        public String description;
        public Map<String, Object> state;
        public Map<String, Object> metadata;
        public String sync_status;
        public String created_at;
        public String updated_at;
    }

    /** Request to create a digital twin */
    public static class TwinCreateRequest {
        public String name;
        public String entity_type;
        public String description;
        public Map<String, Object> initial_state;
        public Map<String, Object> metadata;

        public TwinCreateRequest() {}

        public TwinCreateRequest(String name, String entityType) {
            this.name = name;
            this.entity_type = entityType;
        }
    }

    /** Request to update twin state */
    public static class TwinStateUpdateRequest {
        public Map<String, Object> state;

        public TwinStateUpdateRequest(Map<String, Object> state) {
            this.state = state;
        }
    }

    // ============================================================================
    // Ranking Models
    // ============================================================================

    /** Request to score entities */
    public static class RankingScoreRequest {
        public List<Map<String, Object>> entities;
        public Map<String, Object> ranking_config;
        public Map<String, Double> weights;

        public RankingScoreRequest() {}

        public RankingScoreRequest(List<Map<String, Object>> entities, Map<String, Object> rankingConfig) {
            this.entities = entities;
            this.ranking_config = rankingConfig;
        }
    }

    /** Ranking score response */
    public static class RankingScoreResponse {
        public List<Map<String, Object>> scores;
        public int total;
        public String algorithm;
    }

    /** Top K response */
    public static class TopKResponse {
        public List<Map<String, Object>> entities;
    }

    // ============================================================================
    // API Error Models
    // ============================================================================

    /** API Error */
    public static class APIError {
        public String code;
        public String message;
        public Map<String, Object> details;

        @Override
        public String toString() {
            return code + ": " + message;
        }
    }

    /** Agent list wrapper */
    public static class AgentList {
        public final List<Agent> agents;
        public final int total;
        public final int skip;
        public final int limit;

        public AgentList(List<Agent> agents, int total, int skip, int limit) {
            this.agents = agents != null ? agents : List.of();
            this.total = total;
            this.skip = skip;
            this.limit = limit;
        }
    }

    /** Invoice list wrapper */
    public static class InvoiceList {
        public final List<InvoiceResponse> invoices;
        public final int total;
        public final int skip;
        public final int limit;

        public InvoiceList(List<InvoiceResponse> invoices, int total, int skip, int limit) {
            this.invoices = invoices != null ? invoices : List.of();
            this.total = total;
            this.skip = skip;
            this.limit = limit;
        }
    }
}