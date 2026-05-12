"""
REZ Demand Forecast API
FastAPI service for demand forecasting endpoints
"""
import os
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np

from model import DemandForecaster
from mongodb_loader import load_merchant_data, load_all_merchants

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="REZ Demand Forecast API",
    description="ML-powered demand forecasting for merchant inventory and staffing",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance
_model: Optional[DemandForecaster] = None
_model_loaded_at: Optional[datetime] = None


def get_model() -> DemandForecaster:
    """Dependency to get or initialize the forecasting model."""
    global _model, _model_loaded_at

    if _model is None:
        logger.info("Initializing new DemandForecaster model")
        _model = DemandForecaster()
        _model_loaded_at = datetime.now()

    # Check if model needs retraining (older than 24 hours)
    if _model_loaded_at and (datetime.now() - _model_loaded_at) > timedelta(hours=24):
        logger.info("Model is stale, consider retraining")

    return _model


# Request/Response Models
class ForecastRequest(BaseModel):
    """Request model for demand forecast."""
    merchant_id: Optional[str] = Field(None, description="Merchant ID for MongoDB data lookup")
    days: int = Field(7, ge=1, le=30, description="Number of days to forecast")
    historical_data: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Historical order data (alternative to merchant_id)"
    )
    last_date: Optional[str] = Field(None, description="Last date in history (ISO format)")


class StaffingRequest(BaseModel):
    """Request model for staffing recommendations."""
    merchant_id: Optional[str] = None
    days: int = Field(7, ge=1, le=30)
    historical_data: Optional[List[Dict[str, Any]]] = None
    last_date: Optional[str] = None


class TrendRequest(BaseModel):
    """Request model for trend analysis."""
    merchant_id: Optional[str] = None
    historical_data: Optional[List[Dict[str, Any]]] = None
    window: int = Field(7, ge=3, le=30)


class TrainingRequest(BaseModel):
    """Request model for model training."""
    merchant_ids: Optional[List[str]] = None
    days: int = Field(90, ge=30, le=365)


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    model_loaded: bool
    model_age_hours: Optional[float] = None
    version: str


class ForecastResponse(BaseModel):
    """Response model for forecast endpoint."""
    merchant_id: Optional[str]
    forecasts: List[Dict[str, Any]]
    generated_at: str
    model_version: str


class StaffingResponse(BaseModel):
    """Response model for staffing endpoint."""
    merchant_id: Optional[str]
    recommendations: List[Dict[str, Any]]
    generated_at: str


class TrendResponse(BaseModel):
    """Response model for trends endpoint."""
    merchant_id: Optional[str]
    trends: Dict[str, Any]
    generated_at: str


class TrainingResponse(BaseModel):
    """Response model for training endpoint."""
    status: str
    merchants_trained: int
    metrics: Dict[str, Any]
    trained_at: str


# Helper functions
def get_merchant_data(merchant_id: Optional[str], historical_data: Optional[List[Dict]], last_date: Optional[str]) -> Dict[str, Any]:
    """Load merchant data from MongoDB or use provided historical data."""
    if historical_data:
        return {
            'historical_orders': historical_data,
            'last_date': last_date or datetime.now().isoformat()
        }

    if merchant_id:
        try:
            raw_data = load_merchant_data(merchant_id, days=90)
            if not raw_data:
                raise HTTPException(status_code=404, detail=f"No data found for merchant {merchant_id}")

            # Convert to model format
            historical_orders = [
                {'timestamp': d['date'], 'orders': d['orders']}
                for d in raw_data
            ]
            last_date = raw_data[-1]['date'] if raw_data else None

            return {
                'historical_orders': historical_orders,
                'last_date': last_date
            }
        except Exception as e:
            logger.error(f"Error loading merchant data: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load merchant data: {str(e)}")

    raise HTTPException(status_code=400, detail="Either merchant_id or historical_data must be provided")


# API Endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    global _model, _model_loaded_at

    model_age_hours = None
    if _model_loaded_at:
        model_age_hours = (datetime.now() - _model_loaded_at).total_seconds() / 3600

    return HealthResponse(
        status="healthy",
        model_loaded=_model is not None,
        model_age_hours=round(model_age_hours, 2) if model_age_hours else None,
        version="1.0.0"
    )


@app.post("/forecast", response_model=ForecastResponse)
async def get_forecast(request: ForecastRequest):
    """Get demand forecast for a merchant.

    Returns predicted orders for the next N days with confidence intervals.
    """
    forecaster = get_model()
    merchant_data = get_merchant_data(request.merchant_id, request.historical_data, request.last_date)

    try:
        forecasts = forecaster.forecast(merchant_data, days=request.days)
    except Exception as e:
        logger.error(f"Forecast error: {e}")
        raise HTTPException(status_code=500, detail=f"Forecast generation failed: {str(e)}")

    return ForecastResponse(
        merchant_id=request.merchant_id,
        forecasts=forecasts,
        generated_at=datetime.now().isoformat(),
        model_version="1.0.0"
    )


@app.post("/staffing", response_model=StaffingResponse)
async def get_staffing_recommendations(request: StaffingRequest):
    """Get staffing recommendations based on demand forecasts.

    Returns recommended staff levels for each day based on predicted orders.
    """
    forecaster = get_model()
    merchant_data = get_merchant_data(request.merchant_id, request.historical_data, request.last_date)

    try:
        forecasts = forecaster.forecast(merchant_data, days=request.days)
        recommendations = forecaster.get_staffing_recommendation(forecasts)
    except Exception as e:
        logger.error(f"Staffing error: {e}")
        raise HTTPException(status_code=500, detail=f"Staffing recommendation failed: {str(e)}")

    return StaffingResponse(
        merchant_id=request.merchant_id,
        recommendations=recommendations,
        generated_at=datetime.now().isoformat()
    )


@app.post("/trends", response_model=TrendResponse)
async def get_trends(request: TrendRequest):
    """Get demand trends analysis.

    Returns trend direction, weekly patterns, and volatility metrics.
    """
    forecaster = get_model()
    merchant_data = get_merchant_data(request.merchant_id, request.historical_data, None)

    try:
        historical_data = [
            {'timestamp': d['timestamp'], 'orders': d['orders']}
            for d in merchant_data['historical_orders']
        ]
        trends = forecaster.get_trends(historical_data, window=request.window)
    except Exception as e:
        logger.error(f"Trends error: {e}")
        raise HTTPException(status_code=500, detail=f"Trend analysis failed: {str(e)}")

    return TrendResponse(
        merchant_id=request.merchant_id,
        trends=trends,
        generated_at=datetime.now().isoformat()
    )


@app.post("/train", response_model=TrainingResponse)
async def train_model(request: TrainingRequest, background_tasks: BackgroundTasks):
    """Train the forecasting model on merchant data.

    Can train on a single merchant or multiple merchants.
    """
    global _model, _model_loaded_at

    merchant_ids = request.merchant_ids or load_all_merchants()

    if not merchant_ids:
        raise HTTPException(status_code=400, detail="No merchants found for training")

    all_metrics = []

    def background_training():
        global _model, _model_loaded_at
        model = DemandForecaster()

        for mid in merchant_ids:
            try:
                raw_data = load_merchant_data(mid, days=request.days)
                if len(raw_data) < 14:
                    continue

                historical = [
                    {'timestamp': d['date'], 'orders': d['orders']}
                    for d in raw_data
                ]
                model.train(historical)
                cv = model.cross_validate(historical)
                all_metrics.append({'merchant_id': mid, 'cv_metrics': cv})
            except Exception as e:
                logger.warning(f"Training failed for merchant {mid}: {e}")

        _model = model
        _model_loaded_at = datetime.now()
        logger.info(f"Training complete. Trained on {len(all_metrics)} merchants")

    background_tasks.add_task(background_training)

    return TrainingResponse(
        status="training_started",
        merchants_trained=0,
        metrics={},
        trained_at=datetime.now().isoformat()
    )


@app.post("/inventory")
async def get_inventory_recommendations(
    merchant_id: Optional[str] = None,
    historical_data: Optional[List[Dict]] = None,
    last_date: Optional[str] = None,
    days: int = 7,
    avg_item_value: float = 50.0
):
    """Get inventory recommendations based on demand forecasts.

    Returns inventory levels needed to meet forecasted demand with safety stock.
    """
    forecaster = get_model()
    merchant_data = get_merchant_data(merchant_id, historical_data, last_date)

    try:
        forecasts = forecaster.forecast(merchant_data, days=days)
        inventory = forecaster.get_inventory_recommendation(forecasts, avg_item_value)
    except Exception as e:
        logger.error(f"Inventory error: {e}")
        raise HTTPException(status_code=500, detail=f"Inventory recommendation failed: {str(e)}")

    return {
        "merchant_id": merchant_id,
        "inventory": inventory,
        "generated_at": datetime.now().isoformat()
    }


@app.post("/batch-forecast")
async def batch_forecast(
    merchants: List[Dict[str, Any]],
    days: int = 7
):
    """Get forecasts for multiple merchants in a single request.

    Args:
        merchants: List of dicts with 'merchant_id' and optional 'last_date'
        days: Number of days to forecast

    Returns:
        Dict mapping merchant_id to their forecasts
    """
    forecaster = get_model()
    results = {}

    for merchant in merchants:
        mid = merchant.get('merchant_id')
        if not mid:
            continue

        try:
            merchant_data = get_merchant_data(mid, None, merchant.get('last_date'))
            forecasts = forecaster.forecast(merchant_data, days=days)
            results[mid] = {
                'forecasts': forecasts,
                'trends': forecaster.get_trends(merchant_data.get('historical_orders', []))
            }
        except Exception as e:
            logger.warning(f"Batch forecast failed for {mid}: {e}")
            results[mid] = {'error': str(e)}

    return {
        'results': results,
        'generated_at': datetime.now().isoformat(),
        'merchant_count': len(results)
    }


@app.get("/merchants")
async def list_merchants():
    """List all merchants with sufficient data for forecasting."""
    try:
        merchant_ids = load_all_merchants()
        return {
            'merchants': merchant_ids,
            'count': len(merchant_ids)
        }
    except Exception as e:
        logger.error(f"List merchants error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list merchants: {str(e)}")


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return {
        "error": exc.detail,
        "status_code": exc.status_code
    }


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return {
        "error": "Internal server error",
        "status_code": 500
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
