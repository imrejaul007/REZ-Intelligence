# REZ ML MODELS

## TensorFlow.js Models

| Model | Framework | Status |
|-------|------------|---------|
| Fraud Detection | TensorFlow.js | Build |
| Churn Prediction | XGBoost | Build |
| Recommendation Engine | TensorFlow.js | Build |

## Python Models (sklearn, XGBoost, LightFM)

| Model | Framework | Status |
|-------|------------|---------|
| LTV Prediction | sklearn | Build |
| Demand Forecasting | Prophet | Build |
| Price Optimization | sklearn | Build |

## Quick Start

```javascript
// Load TensorFlow.js model
const model = await tf.loadLayersModel('/model/fraud/model.json');
const prediction = model.predict(userFeatures);
```
