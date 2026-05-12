"""
FastAPI server for reorder predictor
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import joblib
import numpy as np

app = FastAPI(title="REZ Reorder Predictor")

# Load model
try:
    model_data = joblib.load('model.joblib')
    model = model_data['model']
    scaler = model_data['scaler']
except:
    model = None
    scaler = None


class UserData(BaseModel):
    days_since_last_order: int
    orders_7d: int
    orders_30d: int
    avg_order_value: float
    total_orders: int
    unique_categories: int
    days_since_last_visit: int
    cached_payment: bool
    device: str
    time_of_day: int
    day_of_week: int


class MerchantData(BaseModel):
    popularity_score: float
    item_popularity: float


class PredictionRequest(BaseModel):
    user: UserData
    merchant: MerchantData


@app.post("/predict")
async def predict(request: PredictionRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Prepare features
    features = [
        request.user.days_since_last_order,
        request.user.orders_7d,
        request.user.orders_30d,
        request.user.avg_order_value,
        request.user.total_orders,
        request.user.unique_categories,
        request.user.days_since_last_visit,
        1 if request.user.cached_payment else 0,
        1 if request.user.device == 'mobile' else 0,
        request.user.time_of_day,
        request.user.day_of_week,
        request.merchant.popularity_score,
        request.merchant.item_popularity,
        1.0  # seasonal_factor
    ]

    X = np.array(features).reshape(1, -1)
    X_scaled = scaler.transform(X)

    probability = model.predict_proba(X_scaled)[0, 1]
    importance = model.feature_importances_

    return {
        'probability': float(probability),
        'risk_level': 'high' if probability > 0.7 else 'medium' if probability > 0.4 else 'low',
        'recommended_action': 'send_nudge' if probability > 0.6 else 'show_recommendation',
        'confidence': float(max(probability, 1 - probability))
    }


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": model is not None}
