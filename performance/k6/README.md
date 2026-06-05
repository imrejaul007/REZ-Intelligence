# REZ Performance Testing with k6

This directory contains k6 load tests for the REZ Agent OS ecosystem.

## Prerequisites

1. Install k6:
   ```bash
   # macOS
   brew install k6

   # Linux
   sudo gpg -k
   sudo apt-get install k6

   # Or use Docker
   docker pull grafana/k6
   ```

2. Running the REZ stack (either via Docker or local):
   ```bash
   # Docker
   cd REZ-Intelligence/deploy/docker
   docker-compose up -d

   # Or local (ensure services are running)
   # Start your services on http://localhost:8080
   ```

## Test Types

### 1. Load Test (`load-test.js`)

Standard load test that ramps up users and tests all API endpoints.

```bash
# Run with default settings (localhost:8080)
k6 run load-test.js

# Run with custom settings
BASE_URL=https://api.rez.io API_KEY=your-key k6 run load-test.js

# Run with more VUs
k6 run --vus 200 --duration 5m load-test.js
```

### 2. Stress Test (`stress-test.js`)

Aggressive stress test to find breaking points.

```bash
k6 run stress-test.js

# Run with Docker
docker run --rm -v $(pwd):/scripts -w /scripts \
  grafana/k6 run stress-test.js
```

### 3. Spike Test (`spike-test.js`)

Tests system behavior under sudden load spikes.

```bash
k6 run spike-test.js
```

### 4. Soak Test (`soak-test.js`)

Long-duration test for detecting memory leaks and sustained performance issues.

```bash
# Default 30-minute soak test
k6 run soak-test.js

# Shorter soak test
k6 run --duration 10m soak-test.js
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:8080` | REZ API base URL |
| `API_KEY` | `test-api-key` | API key for authentication |

### Common Options

```bash
# Virtual Users
k6 run --vus 100 load-test.js

# Duration
k6 run --duration 5m load-test.js

# Output formats
k6 run load-test.js --out json=results.json
k6 run load-test.js --out influxdb=http://localhost:8086/k6

# Verbose mode
k6 run load-test.js --verbose
```

## Expected Results

### Load Test Thresholds

- **HTTP Request Duration**: p(95) < 500ms
- **HTTP Request Failed**: rate < 0.01 (1%)
- **Error Rate**: rate < 0.05 (5%)

### Stress Test Thresholds

- **HTTP Request Duration**: p(99) < 1000ms
- **HTTP Request Failed**: rate < 0.05 (5%)
- **Error Rate**: rate < 0.10 (10%)

### Spike Test Thresholds

- **HTTP Request Duration**: p(95) < 1000ms
- **HTTP Request Failed**: rate < 0.10 (10%)
- **Error Rate**: rate < 0.15 (15%)

### Soak Test Thresholds

- **HTTP Request Duration**: p(95) < 500ms
- **HTTP Request Failed**: rate < 0.01 (1%)
- **Minimum Requests**: 50,000
- **Maximum Errors**: 500

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Performance Tests

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Run daily at 2 AM

jobs:
  k6:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run k6
        uses: grafana/k6-action@v0.2.0
        with:
          flags: run load-test.js
        env:
          BASE_URL: ${{ secrets.REZ_API_URL }}
          API_KEY: ${{ secrets.REZ_API_KEY }}
```

## Monitoring

Results can be exported to various monitoring systems:

```bash
# InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 load-test.js

# Prometheus
k6 run --out prometheus=http://localhost:9090 load-test.js

# CloudWatch (requires k6-cloud or custom integration)
k6 run --out cloudwatch load-test.js
```

## Interpreting Results

### Key Metrics to Watch

1. **Latency** (p95, p99)
   - Under 200ms: Excellent
   - 200-500ms: Good
   - 500-1000ms: Acceptable under load
   - Over 1000ms: Needs optimization

2. **Error Rate**
   - Under 1%: Healthy
   - 1-5%: Degraded
   - Over 5%: Critical

3. **Throughput**
   - Check requests/second vs baseline
   - Look for throughput degradation over time (sign of resource exhaustion)

4. **Soak Test Specific**
   - Memory usage should be stable
   - Latency should not increase over time
   - No gradual error rate increase

## Troubleshooting

### Connection Refused

Ensure services are running:
```bash
curl http://localhost:8080/health
```

### Authentication Errors

Check API key configuration:
```bash
curl -H "X-API-Key: your-key" http://localhost:8080/health
```

### High Error Rate

1. Check service logs
2. Verify database connections
3. Check network latency
4. Review service resource usage