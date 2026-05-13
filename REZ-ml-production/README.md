# REZ ML Production

**Real ML models for production predictions.**

---

## MODELS

| Model | Type | Purpose |
|-------|------|---------|
| Churn | GradientBoosting | Predict user churn |
| LTV | RandomForest | Predict lifetime value |

---

## INSTALL

```bash
pip install -r requirements.txt
```

---

## TRAIN MODELS

```bash
# Train all models
npm run train

# Train specific model
npm run train:churn
npm run train:ltv
```

---

## START API

```bash
npm start
# Port: 4080
```

---

## API ENDPOINTS

### Churn Prediction
```bash
POST /api/predict/churn

{
  "user_id": "user_123",
  "engagement_score": 1.5,
  "recency_days": 5,
  "frequency_score": 8,
  "monetary_score": 2000,
  "tenure_days": 90,
  "support_tickets": 0,
  "session_duration": 600,
  "app_opens": 30,
  "searches": 15,
  "bookings": 5
}
```

Response:
```json
{
  "success": true,
  "prediction": {
    "churn_probability": 0.15,
    "churn_risk": "low",
    "will_churn": false
  }
}
```

### LTV Prediction
```bash
POST /api/predict/ltv

{
  "user_id": "user_123",
  "current_spend": 10000,
  "monthly_spend": 1000,
  "order_count": 15,
  "avg_order_value": 666,
  "tenure_months": 12
}
```

Response:
```json
{
  "success": true,
  "prediction": {
    "ltv": 45000,
    "ltv_segment": "high",
    "confidence": "high",
    "currency": "INR"
  }
}
```

### Complete User Prediction
```bash
POST /api/predict/user

# Combines churn + LTV + recommendations
```

### Batch Predictions
```bash
POST /api/batch/churn
POST /api/batch/ltv
```

---

## FEATURES

### Churn Model Features
- engagement_score
- recency_days
- frequency_score
- monetary_score
- tenure_days
- support_tickets
- session_duration
- app_opens
- searches
- bookings

### LTV Model Features
- current_spend
- monthly_spend
- order_count
- avg_order_value
- tenure_months
- category_diversity
- app_adoption
- engagement_score
- recency_days
- frequency_score

---

## CONNECTED TO

- Intent Graph
- Memory Engine
- CDP Service
- Agent OS

---

## FILES

```
REZ-ml-production/
├── models/
│ ├── churn_model.py
│ └── ltv_model.py
├── api/
│ └── service.py
├── requirements.txt
├── package.json
├── Dockerfile
└── README.md
```
