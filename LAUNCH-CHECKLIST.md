# REZ Intelligence - Launch Checklist

**Step-by-step guide to deploy REZ Intelligence for production**

---

## Phase 1: Infrastructure Setup

### 1.1 Docker Environment
- [ ] Docker installed on server
- [ ] Docker Compose installed
- [ ] At least 8GB RAM allocated
- [ ] 50GB+ disk space
- [ ] Docker daemon running

### 1.2 Environment Variables
Create `.env` file:
```bash
# Core
NODE_ENV=production
INTERNAL_SERVICE_TOKEN=<generate-secure-token>

# CORS
ALLOWED_ORIGINS=https://rez.money,https://admin.rez.money

# RABTUL Services
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service-36vo.onrender.com

# Internal URLs (for docker network)
REZ_MEMORY_URL=http://rez-memory-layer:4201
REZ_FLOW_URL=http://rez-flow-runtime:4200
```

### 1.3 SSL/TLS
- [ ] SSL certificates obtained
- [ ] HTTPS configured on API Gateway
- [ ] Webhook URLs using HTTPS

---

## Phase 2: Core Services Deployment

### 2.1 Infrastructure
```bash
# Start infrastructure first
docker compose up -d mongodb redis
```

- [ ] MongoDB healthy
- [ ] Redis healthy
- [ ] Data volumes persisted

### 2.2 Gateway Services
```bash
docker compose up -d \
  rez-api-gateway \
  rez-tenant-adapter \
  rez-saas-runtime
```

- [ ] API Gateway responding at /health
- [ ] Tenant Adapter responding at /health
- [ ] SaaS Runtime responding at /health
- [ ] Rate limiting configured
- [ ] API keys working

### 2.3 AI Services
```bash
docker compose up -d \
  rez-intent-predictor \
  rez-predictive-engine \
  rez-knowledge-graph
```

- [ ] Intent predictor responding
- [ ] Predictive engine responding
- [ ] Knowledge graph responding
- [ ] Models loaded

### 2.4 Workflow & Memory
```bash
docker compose up -d \
  rez-flow-runtime \
  rez-memory-layer \
  rez-whatsapp
```

- [ ] Flow runtime responding
- [ ] Memory layer responding
- [ ] WhatsApp service responding
- [ ] BullMQ queues created

### 2.5 Monitoring
```bash
docker compose up -d rez-monitoring
```

- [ ] Monitoring dashboard accessible
- [ ] All services showing healthy
- [ ] Alerts configured

---

## Phase 3: Security Configuration

### 3.1 Authentication
- [ ] Internal service token set (strong, unique)
- [ ] API key format validated
- [ ] Tenant authentication working

### 3.2 Tenant Isolation
- [ ] REZ_ECOSYSTEM: Full access confirmed
- [ ] NON_REZ: Isolated access confirmed
- [ ] RABTUL_SAAS: White-label access confirmed
- [ ] Cross-tenant access blocked

### 3.3 Data Privacy
- [ ] PII fields filtered for external tenants
- [ ] Encryption at rest enabled
- [ ] Encryption in transit enabled
- [ ] Data retention policies set

---

## Phase 4: Integration Testing

### 4.1 API Endpoints
Test each endpoint:
```bash
# Health check
curl http://localhost:4300/health

# Create tenant
curl -X POST http://localhost:4210/api/tenants \
  -H "X-Internal-Token: $TOKEN" \
  -d '{"clientType":"REZ_ECOSYSTEM","displayName":"Test","industry":"retail","email":"test@example.com"}'

# Predict intent
curl -X POST http://localhost:4300/api/intent/predict \
  -H "X-API-Key: $API_KEY" \
  -d '{"userId":"test","context":{}}'
```

- [ ] All endpoints returning expected responses
- [ ] Error handling working
- [ ] Rate limiting working

### 4.2 SDK Integration
```bash
npm install @rez/intelligence-sdk
```

- [ ] SDK imports working
- [ ] Client initialization working
- [ ] All methods functional

### 4.3 Webhook Testing
- [ ] Webhook delivery working
- [ ] Signature verification working
- [ ] Retry mechanism working

---

## Phase 5: Monitoring Setup

### 5.1 Health Checks
- [ ] All services have /health endpoints
- [ ] Health check interval: 30s
- [ ] Alert thresholds configured

### 5.2 Logging
- [ ] Centralized logging configured
- [ ] Log levels appropriate (info/production)
- [ ] Sensitive data masked in logs

### 5.3 Metrics
- [ ] Prometheus metrics exposed
- [ ] Grafana dashboards created
- [ ] Key metrics tracked:
  - API latency (P50, P95, P99)
  - Error rates
  - Active tenants
  - API calls per tenant

### 5.4 Alerting
- [ ] Alert rules configured
- [ ] Notification channels set (Slack/email)
- [ ] On-call rotation established

---

## Phase 6: Documentation

### 6.1 API Documentation
- [ ] OpenAPI spec generated
- [ ] Developer portal accessible
- [ ] Code examples provided

### 6.2 Internal Docs
- [ ] Architecture diagram updated
- [ ] Runbooks created
- [ ] Incident playbooks documented

### 6.3 User Guides
- [ ] Onboarding guide created
- [ ] SDK documentation complete
- [ ] FAQ available

---

## Phase 7: Performance Optimization

### 7.1 Load Testing
```bash
# Run load test
npm run load-test

# Check results
# Target: 1000 RPS, <100ms latency
```

- [ ] API Gateway handles target load
- [ ] No bottlenecks identified
- [ ] Horizontal scaling verified

### 7.2 Caching
- [ ] Redis caching enabled
- [ ] Cache invalidation working
- [ ] Cache hit rate >80%

### 7.3 Database
- [ ] Indexes created
- [ ] Query performance optimized
- [ ] Connection pooling configured

---

## Phase 8: Backup & Recovery

### 8.1 Backups
- [ ] MongoDB backups scheduled
- [ ] Redis RDB snapshots enabled
- [ ] Backup verification tested

### 8.2 Recovery Plan
- [ ] Recovery procedures documented
- [ ] RTO/RPO defined:
  - RTO: 4 hours
  - RPO: 1 hour
- [ ] DR site identified

### 8.3 Chaos Testing
- [ ] Kill one service - others unaffected
- [ ] Database failure handling works
- [ ] Redis failure handling works

---

## Phase 9: Compliance

### 9.1 Data Protection
- [ ] GDPR compliance verified
- [ ] Data residency configured
- [ ] Consent management working

### 9.2 Security Audit
- [ ] Penetration testing completed
- [ ] Vulnerabilities remediated
- [ ] Security headers configured

### 9.3 Access Control
- [ ] RBAC implemented
- [ ] Audit logging enabled
- [ ] Least privilege enforced

---

## Phase 10: Go-Live

### 10.1 Pre-Launch
- [ ] All checklist items complete
- [ ] Team trained on support
- [ ] Rollback plan ready
- [ ] Stakeholders informed

### 10.2 Launch
- [ ] Traffic shifted gradually
- [ ] Monitoring heightened
- [ ] Team on-call

### 10.3 Post-Launch
- [ ] Performance baseline established
- [ ] First week daily reviews
- [ ] Customer feedback collected
- [ ] Iterate on issues

---

## Service URLs (Production)

| Service | URL |
|---------|-----|
| API Gateway | https://api.rez.money |
| Dashboard | https://dashboard.rez.money |
| Docs | https://docs.rez.money |
| Status | https://status.rez.money |
| Monitoring | https://monitor.rez.money |

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| On-call Engineer | +91-XXX-XXXX-XXX |
| Engineering Lead | engineering@rez.money |
| Security | security@rez.money |

---

## Quick Commands

```bash
# Check all services
curl http://localhost:4250/api/health/summary

# View logs
docker compose logs -f rez-api-gateway

# Restart service
docker compose restart rez-intent-predictor

# Scale service
docker compose up -d --scale rez-flow-runtime=3

# Stop all
docker compose down

# Full restart
docker compose down && docker compose up -d
```

---

**Last Updated:** May 25, 2026
