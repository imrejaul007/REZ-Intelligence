# Models Inventory - REZ-Intelligence

**Audit Date:** June 5, 2026
**Purpose:** Complete inventory of all ML model files across REZ-Intelligence

---

## Executive Summary

| Category | Count |
|----------|-------|
| Trained model files (.joblib, .pkl) | 0 |
| Model source code files | 12 |
| Model config files | 5 |
| Training scripts | 8 |
| Exported model references | 4 |

---

## 1. Model Source Code Files

### 1.1 Demand Forecasting Model

**File:** `/REZ-Intelligence/rez-ml-models/demand_forecast/model.py`

```python
class DemandForecaster:
    model = GradientBoostingRegressor(...)
    features = ['day_of_week', 'hour', 'is_weekend', ...]
```

**Framework:** scikit-learn (GradientBoostingRegressor)
**Type:** Time series regression
**Training Data:** Requires historical orders with timestamp
**Status:** Real model, needs trained weights

---

### 1.2 Reorder Predictor Model

**File:** `/REZ-Intelligence/rez-ml-models/reorder_predictor/model.py`

```python
class ReorderPredictor:
    model = GradientBoostingClassifier(...)
    features = ['days_since_last_order', 'order_frequency_7d', ...]
```

**Framework:** scikit-learn (GradientBoostingClassifier)
**Type:** Binary classification
**Training Data:** User order history + merchant data
**Status:** Real model, needs trained weights

---

### 1.3 Taste Profiler Model

**File:** `/REZ-Intelligence/rez-ml-models/taste_profiler/model.py`

```python
class TasteProfiler:
    # Uses KMeans for clustering user preferences
    # Rule-based taste analysis
```

**Framework:** scikit-learn (KMeans) + rule-based
**Type:** Clustering + recommendation
**Training Data:** User order history
**Status:** Real model with clustering

---

### 1.4 Fraud Detection Model (STUB)

**File:** `/REZ-Intelligence/rez-ml-models/REZ-ML-models/models/fraud_detection.py`

```python
class FraudDetector:
    # Uses np.random.random() for predictions
    # NOT a real trained model
```

**Framework:** scikit-learn (RandomForestClassifier) - DECLARED but NOT USED
**Type:** Binary classification
**Issue:** Uses random predictions, not real inference

---

### 1.5 Churn Prediction Model

**File:** `/REZ-Intelligence/REZ-ml-production/models/churn_model.py`

```python
class ChurnModel:
    model = GradientBoostingClassifier(...)
    features = ['engagement_score', 'recency_days', ...]
```

**Framework:** scikit-learn (GradientBoostingClassifier)
**Type:** Binary classification
**Training Data:** User engagement metrics
**Status:** Real model

---

### 1.6 LTV Prediction Model

**File:** `/REZ-Intelligence/REZ-ml-production/models/ltv_model.py`

```python
class LTVModel:
    model = RandomForestRegressor(...)
    features = ['current_spend', 'monthly_spend', ...]
```

**Framework:** scikit-learn (RandomForestRegressor)
**Type:** Regression
**Training Data:** User transaction history
**Status:** Real model

---

### 1.7 Ranking Model

**File:** `/REZ-Intelligence/REZ-ranking-service/python/ranking_model.py`

```python
class RankingModel:
    # LightGBM LambdaMART or rule-based fallback
    features = ['views', 'clicks', 'avg_rating', ...]
```

**Framework:** LightGBM (LambdaMART) + rule-based fallback
**Type:** Learning to Rank
**Training Data:** Click data, engagement signals
**Status:** Real with ML fallback

---

### 1.8 AutoML Trainer

**File:** `/REZ-Intelligence/REZ-automl-pipeline/python/automl/trainer.py`

```python
class ModelTrainer:
    # Supports 18+ sklearn model types
    # Cross-validation, feature importance
```

**Framework:** scikit-learn (multiple models)
**Type:** AutoML training framework
**Status:** Real training infrastructure

---

## 2. Training Scripts

### 2.1 Reorder Predictor Training

**File:** `/REZ-Intelligence/rez-ml-models/reorder_predictor/train.py`

**Purpose:** Generate sample data and train reorder predictor

**Output:** `model.joblib`

---

### 2.2 AutoML Trainer CLI

**File:** `/REZ-Intelligence/REZ-automl-pipeline/python/automl/trainer.py` (main function)

**CLI Usage:**
```bash
python trainer.py --features JSON --labels JSON --model-type RandomForestClassifier
```

---

### 2.3 Model __main__ Blocks

| Model | File | Purpose |
|-------|------|---------|
| Demand Forecaster | `demand_forecast/model.py` | Generate sample data, train, forecast |
| Reorder Predictor | `reorder_predictor/model.py` | Generate sample data, train, predict |
| Churn Model | `REZ-ml-production/models/churn_model.py` | Generate data, train, save |
| LTV Model | `REZ-ml-production/models/ltv_model.py` | Generate data, train, save |

---

## 3. Model Config Files

### 3.1 AutoML Hyperparameter Tuner

**File:** `/REZ-Intelligence/REZ-automl-pipeline/python/automl/hyperparameter_tuner.py`

**Features:**
- Grid search
- Random search
- Bayesian optimization (planned)
- Cross-validation

---

### 3.2 AutoML Model Selector

**File:** `/REZ-Intelligence/REZ-automl-pipeline/python/automl/model_selector.py`

**Purpose:** Select best model based on metrics

---

### 3.3 TypeScript Model Definitions

**File:** `/REZ-Intelligence/REZ-automl-pipeline/src/models/Model.ts`

**Type:** TypeScript interfaces for model metadata

---

### 3.4 ML Service Status

**File:** `/REZ-Intelligence/REZ-predictive-engine/src/services/mlModels.ts`

**Models Defined:**
- ChurnPredictionModel
- LTVPredictionModel
- NextPurchaseModel
- PropensityModel
- SegmentClassificationModel

**Status:** Heuristics, not real ML

---

## 4. Model File References (Not Committed)

These files are referenced in code but NOT committed to the repository:

| Model File | Referenced In | Purpose |
|------------|---------------|---------|
| `model.joblib` | `reorder_predictor/model.py` | Trained reorder predictor |
| `demand_model.joblib` | `demand_forecast/model.py` | Trained demand forecaster |
| `churn_model.joblib` | `REZ-ml-production/models/churn_model.py` | Trained churn model |
| `ltv_model.joblib` | `REZ-ml-production/models/ltv_model.py` | Trained LTV model |
| `taste_model.joblib` | `taste_profiler/model.py` | Trained taste profiler |
| `ranking_model.pkl` | `REZ-ranking-service/python/ranking_model.py` | Trained ranking model |

---

## 5. Missing Model Files

**Critical - No trained models committed:**
- `models/churn_model.joblib` - Would contain trained GradientBoostingClassifier
- `models/ltv_model.joblib` - Would contain trained RandomForestRegressor
- `model.joblib` (demand) - Would contain trained forecaster
- `model.joblib` (reorder) - Would contain trained classifier
- `models/ranking_model.pkl` - Would contain trained LightGBM

**Impact:** Services will fall back to rule-based or return mock data without these files.

---

## 6. Framework Distribution

| Framework | Models | Location |
|-----------|--------|----------|
| scikit-learn | 6 | rez-ml-models, REZ-ml-production |
| LightGBM | 1 | REZ-ranking-service |
| TypeScript (heuristics) | 5 | REZ-predictive-engine |
| External API | 1 | src/services/embeddings.service.ts |

---

## 7. Model Types

| Type | Models |
|------|--------|
| Classification | churn, fraud, reorder, segment |
| Regression | demand, ltv |
| Ranking | ranking |
| Recommendation | taste_profiler |
| Forecasting | demand |

---

## 8. Training Data Requirements

| Model | Required Data | Source |
|-------|---------------|--------|
| Churn | User engagement, orders, tenure | UserProfile collection |
| LTV | Transaction history, spend patterns | Orders collection |
| Demand | Historical orders by date | Merchant orders |
| Reorder | User order history, merchant data | Orders, Merchants |
| Ranking | Click data, engagement signals | Event tracking |
| Fraud | Transaction patterns, labels | Transaction log |

---

## 9. Recommendations

### Immediate Actions
1. **Train and commit models** - Run training scripts and commit .joblib files
2. **Set up model registry** - Use rez-ml-model-registry for versioning
3. **Add model to gitignore** - Keep large binary files out of git history

### Medium-term
4. **Implement MLflow or similar** for model tracking
5. **Set up model deployment pipeline** for A/B testing
6. **Add model monitoring** for drift detection

---

## 10. ML Training Pipeline

### 10.1 Training Scripts Location

```
/REZ-Intelligence/
├── train-models.sh                    # Master training script
├── training/
│   ├── generate_sample_data.py        # Generate sample training data
│   ├── demand_forecaster/
│   │   └── train.py                    # Demand forecasting model
│   ├── reorder_predictor/
│   │   └── train.py                    # Reorder prediction model
│   ├── churn/
│   │   └── train.py                    # Churn prediction model
│   ├── ltv/
│   │   └── train.py                    # LTV prediction model
│   ├── taste_profiler/
│   │   └── train.py                    # Taste profiling model
│   ├── ranking/
│   │   └── train.py                    # Ranking model
│   └── data/                           # Training data directory
│       ├── sales_data.csv
│       ├── customer_activity.csv
│       ├── customer_transactions.csv
│       ├── order_history.csv
│       ├── user_preferences.csv
│       └── user_interactions.csv
└── models/                             # Trained model output directory
    ├── demand_forecast/
    ├── reorder_predictor/
    ├── churn/
    ├── ltv/
    ├── taste_profiler/
    └── ranking/
```

### 10.2 How to Run Training

**Step 1: Generate Sample Data**
```bash
cd /Users/rejaulkarim/Documents/ReZ\ Full\ App/REZ-Intelligence
python3 training/generate_sample_data.py
```

**Step 2: Train All Models**
```bash
cd /Users/rejaulkarim/Documents/ReZ\ Full\ App/REZ-Intelligence
bash train-models.sh
```

**Step 3: Train Individual Models**
```bash
# Demand Forecaster
python3 training/demand_forecaster/train.py \
  --data training/data/sales_data.csv \
  --output models/demand_forecast/demand_forecaster.joblib

# Churn Model
python3 training/churn/train.py \
  --data training/data/customer_activity.csv \
  --output models/churn/churn_model.joblib

# LTV Model
python3 training/ltv/train.py \
  --data training/data/customer_transactions.csv \
  --output models/ltv/ltv_model.joblib
```

### 10.3 Training Data Requirements

| Model | Required Features | Output |
|-------|-------------------|--------|
| DemandForecaster | price, historical_sales, seasonality, day_of_week, month | demand |
| ChurnModel | tenure_days, avg_monthly_spend, support_tickets, login_frequency, plan_type, complaints | churned |
| LTVModel | tenure_days, avg_order_value, order_frequency, product_categories, discount_rate, referral_count | ltv |
| ReorderPredictor | purchase_interval, product_affinity, seasonality, price_sensitivity, category_count | will_reorder |
| TasteProfiler | sweet_preference, spicy_preference, healthy_choice_ratio, organic_preference, price_range, category_diversity | cluster |
| RankingModel | user_feature_1/2, item_feature_1/2, context_feature | relevance_score |

### 10.4 Model Deployment Instructions

**Step 1: Load Trained Model**
```python
import joblib

# Load model
model = joblib.load('models/churn/churn_model.joblib')

# Make predictions
predictions = model.predict(X_test)
```

**Step 2: Deploy to Service**
```bash
# Copy model to service directory
cp models/churn/churn_model.joblib REZ-predictive-engine/models/

# Or serve via API
python3 -c "import joblib; print(joblib.load('models/churn/churn_model.joblib'))"
```

**Step 3: Monitor Model Performance**
- Track prediction accuracy over time
- Monitor for data drift
- Retrain when performance degrades

### 10.5 Framework Details

| Model | Framework | Algorithm |
|-------|-----------|-----------|
| DemandForecaster | scikit-learn | GradientBoostingRegressor |
| ChurnModel | scikit-learn | GradientBoostingClassifier |
| LTVModel | scikit-learn | RandomForestRegressor |
| ReorderPredictor | scikit-learn | GradientBoostingClassifier |
| TasteProfiler | scikit-learn | KMeans (5 clusters) |
| RankingModel | scikit-learn | GradientBoostingRegressor |

---

**Audit Status:** COMPLETE
**Last Updated:** June 5, 2026
