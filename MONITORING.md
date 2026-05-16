# REZ-Intelligence Monitoring Guide

**Last Updated:** 2026-05-16

---

## AI Services Monitored

| Service | Purpose | Port |
|---------|---------|------|
| rez-intent-graph | Intent tracking | 3001 |
| REZ-lead-intelligence | Lead scoring | 3002 |
| REZ-feedback-collector | Feedback analysis | 3003 |
| REZ-rfm-service | Customer segmentation | 4055 |
| REZ-research-opportunity-agent | Research agent | 4058 |

---

## AI Model Metrics

### Model Performance

| Metric | Target | Alert |
|--------|--------|-------|
| Accuracy | > 85% | < 80% |
| Latency | < 500ms | > 2s |
| Throughput | > 100 req/s | < 10 req/s |

### Training Metrics

| Metric | Target |
|--------|--------|
| Loss | < 0.1 |
| Validation Accuracy | > 90% |
| Training Time | < 1h |

---

## Data Quality

### Intent Graph

- Node coverage
- Edge density
- Update frequency

### Lead Scoring

- Score distribution
- Prediction accuracy
- Model drift

---

## Alerts

| Alert | Condition |
|-------|-----------|
| Model Degradation | Accuracy drop > 5% |
| High Latency | P99 > 2s |
| Low Throughput | < 50 req/s |
| Data Staleness | No updates > 24h |
