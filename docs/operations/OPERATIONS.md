# REZ Agent OS - Operations Guide

Complete operational documentation for running REZ Agent OS in production.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Deployment](#deployment)
3. [Monitoring](#monitoring)
4. [Logging](#logging)
5. [Security](#security)
6. [Backup & Recovery](#backup--recovery)
7. [Scaling](#scaling)
8. [Troubleshooting](#troubleshooting)
9. [Runbooks](#runbooks)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              REZ Agent OS                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────┐     ┌─────────────────────────────────────────────────┐      │
│  │   Clients   │     │              API Gateway (8080)                │      │
│  │  ─────────  │     │  ┌─────────┐ ┌──────────┐ ┌────────────────┐  │      │
│  │  Web/Mobile │     │  │  Auth   │ │ Rate Lim │ │ Service Router │  │      │
│  │  SDKs       │     │  │ Middle  │ │  Middle  │ │                │  │      │
│  │  CLI        │     │  └────┬────┘ └────┬─────┘ └───────┬────────┘  │      │
│  └──────┬──────┘     └───────┼──────────┼───────────────┼────────────┘      │
│         │                    │          │               │                   │
│         └────────────────────┴──────────┴───────────────┘                   │
│                                    │                                         │
│         ┌─────────────────────────┼─────────────────────────────┐          │
│         │                         │                             │          │
│  ┌──────┴───────┐  ┌──────────────┴──────────┐  ┌───────────────┴────┐      │
│  │   Agents     │  │        Services         │  │    MCP Services    │      │
│  │  ─────────   │  │  ───────────────────   │  │  ────────────────   │      │
│  │  Fraud Agent │  │  • AutoML              │  │  • Analytics       │      │
│  │  Sales Agent │  │  • Invoice             │  │  • Event Bus       │      │
│  │  Support     │  │  • Contracts           │  │  • Identity        │      │
│  │  Consultant  │  │  • Legal               │  │  • Inventory       │      │
│  │  Info Agent  │  │  • Digital Twin        │  │  • Logs            │      │
│  │  Planning    │  │  • Ranking             │  │  • Notification    │      │
│  └──────────────┘  └───────────────────────┘  └───────────────────┘      │
│                              │                                               │
│  ┌───────────────────────────┴────────────────────────────────────────┐     │
│  │                         Data Layer                                  │     │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │     │
│  │  │ PostgreSQL │  │   Redis    │  │     S3     │  │ Prometheus │  │     │
│  │  │   Primary  │  │   Cache    │  │  Storage   │  │  Metrics   │  │     │
│  │  │   + Replica│  │  + Cluster │  │            │  │  + Grafana  │  │     │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Deployment

### Prerequisites

- Kubernetes 1.24+
- Helm 3.8+
- 8GB+ RAM available
- 50GB+ storage

### Quick Deploy

```bash
# Clone repository
git clone https://github.com/rez-io/rez.git
cd rez

# Deploy with Helm
helm install rez ./deploy/helm/rez \
  --namespace rez-system \
  --create-namespace

# Verify deployment
kubectl get pods -n rez-system

# Check logs
kubectl logs -n rez-system -l app=rez-gateway -f
```

### Production Deploy

```bash
# Create namespace
kubectl create namespace rez-system

# Create secrets
kubectl create secret generic rez-secrets \
  --namespace rez-system \
  --from-literal=db-password=your-secure-password \
  --from-literal=redis-password=your-secure-password

# Deploy with custom values
helm install rez ./deploy/helm/rez \
  --namespace rez-system \
  --values ./deploy/helm/rez/values-production.yaml

# Check status
kubectl get all -n rez-system
```

---

## Monitoring

### Accessing Dashboards

```bash
# Port-forward Grafana
kubectl port-forward -n rez-system svc/grafana 3000:80

# Open http://localhost:3000
# Default: admin / (check secret)
```

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `gateway_requests_total` | Total gateway requests | > 10000/min |
| `gateway_request_duration_ms` | Request latency p99 | > 500ms |
| `gateway_errors_total` | Error count | > 1% |
| `gateway_rate_limit_hits` | Rate limit rejections | > 100/min |
| `redis_connected_clients` | Redis connections | > 1000 |
| `db_connections_active` | Active DB connections | > 80% max |

### Prometheus Queries

```promql
# Request rate
rate(gateway_requests_total[5m])

# Error rate
rate(gateway_errors_total[5m]) / rate(gateway_requests_total[5m])

# P99 latency
histogram_quantile(0.99, rate(gateway_request_duration_bucket[5m]))

# Memory usage
container_memory_usage_bytes{pod=~"rez-.*"}

# CPU usage
rate(container_cpu_usage_seconds_total{pod=~"rez-.*"}[5m])
```

### Alerting Rules

```yaml
# alerts.yaml
groups:
  - name: rez-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(gateway_errors_total[5m]) / rate(gateway_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"

      - alert: HighLatency
        expr: histogram_quantile(0.99, rate(gateway_request_duration_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Request latency above threshold"

      - alert: RateLimitThrottling
        expr: rate(gateway_rate_limit_hits[5m]) > 100
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Rate limiting active"
```

---

## Logging

### Centralized Logging Setup

```yaml
# fluentd-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/*.log
      pos_file /var/log/containers.log.pos
      tag kubernetes.*
      read_from_head true
      <parse>
        @type json
        time_key time
        time_format %Y-%m-%dT%H:%M:%S.%NZ
      </parse>
    </source>

    <match kubernetes.**>
      @type elasticsearch
      host elasticsearch.logging.svc
      port 9200
      logstash_format true
      buffer_path /var/log/fluentd-buffers
      flush_interval 5s
    </match>
```

### Log Levels

| Level | Usage |
|-------|-------|
| `error` | Errors only |
| `warn` | Warnings and errors |
| `info` | General information |
| `debug` | Debug information |

### Log Analysis

```bash
# View recent logs
kubectl logs -n rez-system -l app=rez-gateway --tail=100

# Search logs
kubectl logs -n rez-system -l app=rez-gateway | grep -i error

# Follow logs
kubectl logs -n rez-system -l app=rez-gateway -f

# Export logs
kubectl logs -n rez-system -l app=rez-gateway > logs.txt
```

---

## Security

### Network Policies

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: rez-gateway-policy
spec:
  podSelector:
    matchLabels:
      app: rez-gateway
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: rez-postgresql
        - podSelector:
            matchLabels:
              app: rez-redis-master
```

### Authentication

```bash
# Generate JWT secret
openssl rand -base64 32

# Update secret
kubectl create secret generic rez-auth \
  --namespace rez-system \
  --from-literal=jwt-secret=your-secret \
  --dry-run=client -o yaml | kubectl apply -f -
```

### TLS Configuration

```bash
# Create TLS certificate
kubectl create secret tls rez-tls \
  --namespace rez-system \
  --cert=cert.pem \
  --key=key.pem

# Enable TLS in Ingress
kubectl patch ingress rez-gateway \
  --namespace rez-system \
  --patch '{"spec":{"tls":[{"secretName":"rez-tls","hosts":["api.rez.io"]}]}}'
```

---

## Backup & Recovery

### PostgreSQL Backup

```bash
# Manual backup
kubectl exec -n rez-system svc/rez-postgresql -- pg_dump -U postgres rezdb > backup.sql

# Automated backup (CronJob)
kubectl create cronjob backup-db \
  --namespace rez-system \
  --schedule="0 2 * * *" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Redis Backup

```bash
# Save Redis data
kubectl exec -n rez-system svc/rez-redis-master -- redis-cli SAVE

# Copy backup
kubectl cp rez-system/rez-redis-master-0:/data/dump.rdb ./dump.rdb
```

### Restore Procedures

```bash
# Restore PostgreSQL
kubectl exec -i -n rez-system svc/rez-postgresql -- psql -U postgres -d rezdb < backup.sql

# Restore Redis
kubectl cp ./dump.rdb rez-system/rez-redis-master-0:/data/dump.rdb
kubectl exec -n rez-system svc/rez-redis-master -- redis-cli BGSAVE
```

---

## Scaling

### Horizontal Pod Autoscaling

```bash
# View HPA
kubectl get hpa -n rez-system

# Manual scale
kubectl scale deployment rez-gateway --namespace rez-system --replicas=5

# Auto-scale based on CPU
kubectl autoscale deployment rez-gateway \
  --namespace rez-system \
  --min=2 \
  --max=10 \
  --cpu-percent=70
```

### Node Scaling (EKS)

```bash
# Update node group
aws eks update-nodegroup \
  --cluster-name rez-cluster \
  --nodegroup-name rez-workers \
  --scaling-config minSize=3,maxSize=20,desiredSize=5 \
  --region us-east-1
```

### Performance Tuning

```yaml
# values.yaml
gateway:
  resources:
    requests:
      cpu: 200m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 2Gi
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 20
    targetCPUUtilizationPercentage: 60
```

---

## Troubleshooting

### Common Issues

#### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n rez-system

# Describe pod
kubectl describe pod -n rez-system <pod-name>

# Check events
kubectl get events -n rez-system --sort-by=.lastTimestamp
```

#### Database Connection Issues

```bash
# Test database connection
kubectl run -n rez-system test-db --image=postgres:15 --restart=Never -- \
  psql -h rez-postgresql -U postgres -d rezdb -c "SELECT 1"

# Check DB logs
kubectl logs -n rez-system -l app=rez-postgresql

# Check connections
kubectl exec -n rez-system svc/rez-postgresql -- \
  psql -U postgres -d rezdb -c "SELECT count(*) FROM pg_stat_activity"
```

#### Redis Connection Issues

```bash
# Test Redis
kubectl run -n rez-system redis-test --image=redis:7 --restart=Never -- \
  redis-cli -h rez-redis-master ping

# Check Redis info
kubectl exec -n rez-system svc/rez-redis-master -- redis-cli INFO

# Check memory
kubectl exec -n rez-system svc/rez-redis-master -- redis-cli INFO MEMORY
```

#### High Memory Usage

```bash
# Check resource usage
kubectl top pods -n rez-system

# Check node resources
kubectl top nodes

# Analyze memory dumps
kubectl exec -n rez-system <pod> -- cat /proc/meminfo
```

### Health Checks

```bash
# Gateway health
curl http://localhost:8080/health

# Service health
curl http://localhost:8080/api/agents/health

# Metrics
curl http://localhost:8080/metrics
```

---

## Runbooks

### Runbook: High Error Rate

**Symptom**: Error rate > 5%

**Steps**:
1. Check error logs:
   ```bash
   kubectl logs -n rez-system -l app=rez-gateway | grep -i error
   ```

2. Check downstream services:
   ```bash
   kubectl get pods -n rez-system
   ```

3. Check database:
   ```bash
   kubectl exec -n rez-system svc/rez-postgresql -- \
     psql -U postgres -d rezdb -c "SELECT * FROM pg_stat_activity WHERE state != 'idle'"
   ```

4. Check Redis:
   ```bash
   kubectl exec -n rez-system svc/rez-redis-master -- redis-cli INFO
   ```

5. Restart affected pods:
   ```bash
   kubectl rollout restart deployment/rez-gateway -n rez-system
   ```

### Runbook: High Latency

**Symptom**: P99 latency > 500ms

**Steps**:
1. Check resource usage:
   ```bash
   kubectl top pods -n rez-system
   ```

2. Check database slow queries:
   ```bash
   kubectl exec -n rez-system svc/rez-postgresql -- \
     psql -U postgres -d rezdb -c "SELECT * FROM pg_stat_activity WHERE query_start < now() - interval '5 minutes'"
   ```

3. Check Redis slow commands:
   ```bash
   kubectl exec -n rez-system svc/rez-redis-master -- redis-cli SLOWLOG GET 10
   ```

4. Scale up if needed:
   ```bash
   kubectl scale deployment rez-gateway --replicas=10 -n rez-system
   ```

### Runbook: Service Outage

**Symptom**: Service unavailable

**Steps**:
1. Check pod status:
   ```bash
   kubectl get pods -n rez-system
   kubectl describe pod -n rez-system <pod>
   ```

2. Check events:
   ```bash
   kubectl get events -n rez-system --sort-by=.lastTimestamp | tail -20
   ```

3. Restart pods:
   ```bash
   kubectl delete pod -n rez-system -l app=rez-gateway --grace-period=0 --force
   ```

4. Check ingress:
   ```bash
   kubectl get ingress -n rez-system
   kubectl describe ingress -n rez-system
   ```

5. Check node health:
   ```bash
   kubectl get nodes
   kubectl describe node <node>
   ```

### Runbook: Database Corruption

**Symptom**: Database errors, data inconsistency

**Steps**:
1. Stop writes:
   ```bash
   kubectl scale deployment rez-gateway --replicas=0 -n rez-system
   ```

2. Check database:
   ```bash
   kubectl exec -n rez-system svc/rez-postgresql -- \
     psql -U postgres -d rezdb -c "CHECKPOINT"
   ```

3. Restore from backup:
   ```bash
   kubectl exec -i -n rez-system svc/rez-postgresql -- \
     psql -U postgres -d rezdb < backup.sql
   ```

4. Resume service:
   ```bash
   kubectl scale deployment rez-gateway --replicas=2 -n rez-system
   ```

### Runbook: Redis Memory Full

**Symptom**: Redis errors, cache misses

**Steps**:
1. Check memory:
   ```bash
   kubectl exec -n rez-system svc/rez-redis-master -- redis-cli INFO MEMORY
   ```

2. Check keys:
   ```bash
   kubectl exec -n rez-system svc/rez-redis-master -- redis-cli DBSIZE
   kubectl exec -n rez-system svc/rez-redis-master -- redis-cli --bigkeys
   ```

3. Flush old data:
   ```bash
   kubectl exec -n rez-system svc/rez-redis-master -- \
     redis-cli EVAL "return redis.call('FLUSHDB')" 0
   ```

4. Restart Redis:
   ```bash
   kubectl delete pod -n rez-system -l app=rez-redis-master --grace-period=0
   ```

---

## Support

- **Documentation**: https://docs.rez.io
- **Support**: support@rez.io
- **Status**: https://status.rez.io
- **GitHub Issues**: https://github.com/rez-io/rez/issues