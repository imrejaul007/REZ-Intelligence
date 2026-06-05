# REZ Agent OS - Helm Chart

Enterprise-grade Kubernetes deployment for the REZ Agent OS ecosystem.

## Features

- **API Gateway** with rate limiting, JWT auth, and automatic service discovery
- **Agent Registry** with horizontal scaling
- **AutoML Service** with GPU support
- **Invoice, Contracts, Legal, Twin, Ranking** microservices
- **PostgreSQL** with read replicas and automated backups
- **Redis** for caching and rate limiting
- **Prometheus & Grafana** monitoring stack
- **Horizontal Pod Autoscaling** for all services
- **Network Policies** for security
- **Pod Disruption Budgets** for high availability

## Prerequisites

- Kubernetes 1.24+
- Helm 3.8+
- PV provisioner support (for persistent volumes)
- Minimum 4GB RAM available for the cluster

## Quick Start

### Install

```bash
# Add REZ Helm repository
helm repo add rez https://charts.rez.io
helm repo update

# Install with default values
helm install rez ./deploy/helm/rez -n rez-system --create-namespace

# Or use the official chart
helm install rez rez/rez -n rez-system --create-namespace
```

### Verify Installation

```bash
# Check pod status
kubectl get pods -n rez-system

# Check services
kubectl get svc -n rez-system

# View logs
kubectl logs -n rez-system -l app=rez-gateway -f
```

### Access the API

```bash
# Port-forward to gateway
kubectl port-forward -n rez-system svc/rez-gateway 8080:8080

# Test health endpoint
curl http://localhost:8080/health
```

## Configuration

### Basic Configuration

```bash
helm install rez ./deploy/helm/rez \
  --namespace rez-system \
  --set gateway.service.type=LoadBalancer \
  --set gateway.ingress.enabled=true \
  --set gateway.ingress.hosts[0].host=api.rez.io
```

### Production Configuration

Create a `values-production.yaml`:

```yaml
gateway:
  replicaCount: 3
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10

postgresql:
  auth:
    postgresPassword: "your-secure-password"

redis:
  auth:
    password: "your-secure-password"

grafana:
  adminPassword: "your-secure-password"

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
```

Install with custom values:

```bash
helm install rez ./deploy/helm/rez \
  --namespace rez-system \
  -f values-production.yaml
```

### Disable Default Dependencies

```bash
helm install rez ./deploy/helm/rez \
  --set postgresql.enabled=false \
  --set redis.enabled=false \
  --set prometheus.enabled=false \
  --set grafana.enabled=false
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Gateway | 8080 | API Gateway with auth |
| Agent Registry | 3001 | AI Agent management |
| AutoML | 3002 | ML model training |
| Invoice | 3003 | Invoice generation |
| Contracts | 3004 | Contract management |
| Legal | 3005 | Legal research |
| Twin | 3006 | Digital twins |
| Ranking | 3007 | Ranking algorithms |
| MCP Server | 3010 | Model Context Protocol |
| Event Bus | 3011 | Event processing |

## Monitoring

### Prometheus Metrics

All services expose Prometheus metrics at `/metrics`:

```bash
# View metrics
kubectl port-forward -n rez-system svc/rez-gateway 9090:9090
curl http://localhost:9090/metrics
```

### Grafana Dashboards

Access Grafana at `http://localhost:3000`:

```bash
kubectl port-forward -n rez-system svc/grafana 3000:80
```

Default credentials: `admin` / (check secret `grafana`)

Pre-configured dashboards:
- REZ Overview
- Service Performance
- Agent Metrics
- MCP Status

## Upgrading

```bash
# Update Helm repo
helm repo update

# Upgrade release
helm upgrade rez ./deploy/helm/rez -n rez-system

# Or upgrade with custom values
helm upgrade rez ./deploy/helm/rez -n rez-system -f values-production.yaml
```

## Uninstall

```bash
# Uninstall release
helm uninstall rez -n rez-system

# Delete namespace (optional)
kubectl delete namespace rez-system
```

## Troubleshooting

### Pods Not Starting

```bash
# Describe pod to see events
kubectl describe pod -n rez-system -l app=rez-gateway

# Check logs
kubectl logs -n rez-system -l app=rez-gateway --previous
```

### Database Connection Issues

```bash
# Check PostgreSQL status
kubectl exec -n rez-system -it svc/rez-postgresql -- psql -U postgres

# Test connection from pod
kubectl run -n rez-system psql-test --image=postgres:15 --restart=Never --rm -it -- \
  psql -h rez-postgresql -U postgres -d rez -c "SELECT 1"
```

### High Memory Usage

```bash
# Check resource usage
kubectl top pods -n rez-system

# Increase limits in values
helm upgrade rez ./deploy/helm/rez -n rez-system \
  --set gateway.resources.limits.memory=2Gi
```

## Development

### Local Development

```bash
# Install with local image
helm install rez ./deploy/helm/rez \
  --namespace rez-system \
  --set gateway.image.repository=localhost:5000/rez-gateway \
  --set gateway.image.pullPolicy=Never
```

### Run Tests

```bash
# Lint chart
helm lint ./deploy/helm/rez

# Template check
helm template rez ./deploy/helm/rez --debug

# Dry run install
helm install rez ./deploy/helm/rez --dry-run --debug -n rez-system
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](../../LICENSE)