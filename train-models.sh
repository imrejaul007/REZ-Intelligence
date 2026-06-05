#!/bin/bash
# Train all ML models for REZ Ecosystem
# Run this script to train and store model weights

set -e

MODEL_DIR="./models"
TRAIN_DIR="./training"

echo "=== REZ ML Training Pipeline ==="
echo "Training date: $(date)"
echo ""

# 1. Demand Forecaster
echo ">>> Training DemandForecaster..."
python3 "$TRAIN_DIR/demand_forecaster/train.py" \
  --data "$TRAIN_DIR/data/sales_data.csv" \
  --output "$MODEL_DIR/demand_forecast/demand_forecaster.joblib"

# 2. Reorder Predictor
echo ">>> Training ReorderPredictor..."
python3 "$TRAIN_DIR/reorder_predictor/train.py" \
  --data "$TRAIN_DIR/data/order_history.csv" \
  --output "$MODEL_DIR/reorder_predictor/reorder_model.joblib"

# 3. Churn Model
echo ">>> Training ChurnModel..."
python3 "$TRAIN_DIR/churn/train.py" \
  --data "$TRAIN_DIR/data/customer_activity.csv" \
  --output "$MODEL_DIR/churn/churn_model.joblib"

# 4. LTV Model
echo ">>> Training LTVModel..."
python3 "$TRAIN_DIR/ltv/train.py" \
  --data "$TRAIN_DIR/data/customer_transactions.csv" \
  --output "$MODEL_DIR/ltv/ltv_model.joblib"

# 5. Taste Profiler
echo ">>> Training TasteProfiler..."
python3 "$TRAIN_DIR/taste_profiler/train.py" \
  --data "$TRAIN_DIR/data/user_preferences.csv" \
  --output "$MODEL_DIR/taste_profiler/taste_model.joblib"

# 6. Ranking Model
echo ">>> Training RankingModel..."
python3 "$TRAIN_DIR/ranking/train.py" \
  --data "$TRAIN_DIR/data/user_interactions.csv" \
  --output "$MODEL_DIR/ranking/ranking_model.joblib"

echo ""
echo "=== Training Complete! ==="
echo "Models saved to: $MODEL_DIR"
