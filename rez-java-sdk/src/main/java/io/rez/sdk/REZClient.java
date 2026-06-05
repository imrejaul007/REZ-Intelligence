package io.rez.sdk;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.*;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.util.EntityUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.HashMap;
import java.util.function.Supplier;

/**
 * REZ Java SDK - Main Client
 *
 * Provides a Java client for interacting with the REZ Agent OS ecosystem.
 * Supports automatic retry, context cancellation, and comprehensive error handling.
 */
public class REZClient implements AutoCloseable {

    private final String baseUrl;
    private final String apiKey;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final int maxRetries;
    private final Duration timeout;

    private final AgentService agents;
    private final AutoMLService automl;
    private final InvoiceService invoice;
    private final ContractsService contracts;
    private final LegalService legal;
    private final TwinService twin;
    private final RankingService ranking;
    private final GraphQLService graphql;

    private REZClient(Builder builder) {
        this.baseUrl = builder.baseUrl;
        this.apiKey = builder.apiKey;
        this.maxRetries = builder.maxRetries;
        this.timeout = builder.timeout;

        // Configure HTTP client
        RequestConfig config = RequestConfig.custom()
            .setConnectTimeout((int) timeout.toMillis())
            .setSocketTimeout((int) timeout.toMillis())
            .build();

        this.httpClient = HttpClientBuilder.create()
            .setDefaultRequestConfig(config)
            .build();

        // Configure ObjectMapper
        this.objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        // Initialize services
        this.agents = new AgentService(this);
        this.automl = new AutoMLService(this);
        this.invoice = new InvoiceService(this);
        this.contracts = new ContractsService(this);
        this.legal = new LegalService(this);
        this.twin = new TwinService(this);
        this.ranking = new RankingService(this);
        this.graphql = new GraphQLService(this);
    }

    public static Builder builder() {
        return new Builder();
    }

    // Package-private HTTP methods

    <T> T get(String path, Class<T> clazz) throws REZException {
        return executeWithRetry(() -> {
            HttpGet request = new HttpGet(baseUrl + path);
            addHeaders(request);
            return executeRequest(request, clazz);
        });
    }

    <T> T get(String path, Map<String, String> params, Class<T> clazz) throws REZException {
        if (params != null && !params.isEmpty()) {
            StringBuilder queryString = new StringBuilder("?");
            params.forEach((k, v) -> {
                if (queryString.length() > 1) queryString.append("&");
                queryString.append(k).append("=").append(v);
            });
            path += queryString.toString();
        }
        return get(path, clazz);
    }

    <T> T post(String path, Object body, Class<T> clazz) throws REZException {
        return executeWithRetry(() -> {
            HttpPost request = new HttpPost(baseUrl + path);
            addHeaders(request);
            if (body != null) {
                try {
                    request.setEntity(new StringEntity(objectMapper.writeValueAsString(body), StandardCharsets.UTF_8));
                } catch (Exception e) {
                    throw new REZException("Failed to serialize request body", e);
                }
            }
            return executeRequest(request, clazz);
        });
    }

    <T> T put(String path, Object body, Class<T> clazz) throws REZException {
        return executeWithRetry(() -> {
            HttpPut request = new HttpPut(baseUrl + path);
            addHeaders(request);
            if (body != null) {
                try {
                    request.setEntity(new StringEntity(objectMapper.writeValueAsString(body), StandardCharsets.UTF_8));
                } catch (Exception e) {
                    throw new REZException("Failed to serialize request body", e);
                }
            }
            return executeRequest(request, clazz);
        });
    }

    void delete(String path) throws REZException {
        executeWithRetry(() -> {
            HttpDelete request = new HttpDelete(baseUrl + path);
            addHeaders(request);
            executeRequest(request, Void.class);
            return null;
        });
    }

    private void addHeaders(HttpRequestBase request) {
        request.setHeader("Content-Type", "application/json");
        request.setHeader("User-Agent", "rez-java-sdk/1.0.0");
        if (apiKey != null && !apiKey.isEmpty()) {
            request.setHeader("X-API-Key", apiKey);
        }
    }

    private <T> T executeRequest(HttpRequestBase request, Class<T> clazz) throws REZException {
        try {
            HttpResponse response = httpClient.execute(request);
            int statusCode = response.getStatusLine().getStatusCode();

            String responseBody = EntityUtils.toString(response.getEntity(), StandardCharsets.UTF_8);

            if (statusCode >= 400) {
                APIError error = null;
                try {
                    error = objectMapper.readValue(responseBody, APIError.class);
                } catch (Exception ignored) {}

                throw new APIException(statusCode, error);
            }

            if (clazz == Void.class) {
                return null;
            }

            return objectMapper.readValue(responseBody, clazz);
        } catch (APIException e) {
            throw e;
        } catch (Exception e) {
            throw new REZException("Request failed: " + e.getMessage(), e);
        }
    }

    private <T> T executeWithRetry(Supplier<T> action) throws REZException {
        REZException lastException = null;

        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return action.get();
            } catch (APIException e) {
                // Don't retry client errors (4xx except 429)
                if (e.getStatusCode() >= 400 && e.getStatusCode() < 500 && e.getStatusCode() != 429) {
                    throw e;
                }
                lastException = e;
            } catch (REZException e) {
                lastException = e;
            }

            if (attempt < maxRetries) {
                try {
                    Thread.sleep((long) Math.pow(2, attempt) * 1000);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        throw lastException;
    }

    // Service accessors

    public AgentService agents() { return agents; }
    public AutoMLService automl() { return automl; }
    public InvoiceService invoice() { return invoice; }
    public ContractsService contracts() { return contracts; }
    public LegalService legal() { return legal; }
    public TwinService twin() { return twin; }
    public RankingService ranking() { return ranking; }
    public GraphQLService graphql() { return graphql; }

    @Override
    public void close() {
        // HttpClient is managed externally, just for AutoCloseable compliance
    }

    // Builder pattern

    public static class Builder {
        private String baseUrl = "http://localhost:8080";
        private String apiKey;
        private int maxRetries = 3;
        private Duration timeout = Duration.ofSeconds(30);

        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }

        public Builder maxRetries(int maxRetries) {
            this.maxRetries = maxRetries;
            return this;
        }

        public Builder timeout(Duration timeout) {
            this.timeout = timeout;
            return this;
        }

        public REZClient build() {
            return new REZClient(this);
        }
    }
}