"""
REZ Taste Profiler API
FastAPI server for taste profile analysis and recommendations.
"""
import os
import json
from typing import Dict, List, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

from model import TasteProfiler
from redis_cache import TasteCache


# Configuration
MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017')
MONGODB_DB = os.environ.get('MONGODB_DB', 'rez')
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')

# Global instances
profiler = TasteProfiler()
cache = TasteCache(redis_url=REDIS_URL)

# MongoDB client (lazy initialization)
mongo_client = None


def get_mongo_db():
    """Get MongoDB database connection."""
    global mongo_client
    if mongo_client is None:
        try:
            from pymongo import MongoClient
            mongo_client = MongoClient(MONGODB_URI)
        except Exception as e:
            print(f"MongoDB connection error: {e}")
            return None
    return mongo_client[MONGODB_DB]


# Pydantic models
class OrderItem(BaseModel):
    category: Optional[str] = None
    cuisine: Optional[str] = None
    price_range: Optional[int] = Field(default=2, ge=1, le=4)
    rating: Optional[float] = Field(default=3.0, ge=1, le=5)
    name: Optional[str] = None
    order_hour: Optional[int] = Field(default=12, ge=0, le=23)
    tags: Optional[List[str]] = []


class ProfileRequest(BaseModel):
    user_id: str
    order_history: List[OrderItem] = []
    use_cache: bool = True


class ProfileResponse(BaseModel):
    user_id: str
    profile: Dict[str, Any]
    cached: bool = False


class RecommendRequest(BaseModel):
    user_id: str
    available_items: List[Dict[str, Any]] = []
    n: int = Field(default=10, ge=1, le=50)
    use_cache: bool = True


class RecommendResponse(BaseModel):
    user_id: str
    recommendations: List[Dict[str, Any]]


class SimilarRequest(BaseModel):
    user_id: str
    all_profiles: Dict[str, Dict[str, Any]] = {}
    n: int = Field(default=10, ge=1, le=50)


class SimilarResponse(BaseModel):
    user_id: str
    similar_users: List[Dict[str, Any]]


class HealthResponse(BaseModel):
    status: str
    cache: Dict[str, Any]
    mongodb: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    print("Starting REZ Taste Profiler API...")
    print(f"Redis: {REDIS_URL}")
    print(f"MongoDB: {MONGODB_URI}")
    yield
    # Shutdown
    print("Shutting down...")
    if mongo_client:
        mongo_client.close()


# Create FastAPI app
app = FastAPI(
    title="REZ Taste Profiler API",
    description="ML-powered taste profiling and recommendations",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def cache_profile(user_id: str, profile: Dict[str, Any]) -> None:
    """Background task to cache profile."""
    cache.set(user_id, profile)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check API and service health."""
    cache_health = cache.health_check()
    try:
        db = get_mongo_db()
        mongo_status = "connected" if db is not None else "disconnected"
    except Exception:
        mongo_status = "error"

    return HealthResponse(
        status="healthy" if cache_health['connected'] else "degraded",
        cache=cache_health,
        mongodb=mongo_status
    )


@app.post("/profile", response_model=ProfileResponse)
async def analyze_profile(
    request: ProfileRequest,
    background_tasks: BackgroundTasks
):
    """
    Analyze user taste profile from order history.
    Creates or updates the user's taste profile.
    """
    user_id = request.user_id

    # Check cache first
    if request.use_cache:
        cached_profile = cache.get(user_id)
        if cached_profile:
            return ProfileResponse(
                user_id=user_id,
                profile=cached_profile,
                cached=True
            )

    # Analyze order history
    order_dicts = [order.model_dump() for order in request.order_history]
    profile = profiler.analyze_user(order_dicts, user_id=user_id)

    # Cache in background
    if request.use_cache:
        background_tasks.add_task(cache_profile, user_id, profile)

    return ProfileResponse(
        user_id=user_id,
        profile=profile,
        cached=False
    )


@app.get("/profile/{user_id}", response_model=ProfileResponse)
async def get_profile(user_id: str, use_cache: bool = True):
    """
    Retrieve existing user taste profile.
    Falls back to default profile if not found.
    """
    # Check cache first
    if use_cache:
        cached_profile = cache.get(user_id)
        if cached_profile:
            return ProfileResponse(
                user_id=user_id,
                profile=cached_profile,
                cached=True
            )

    # Try MongoDB
    db = get_mongo_db()
    if db is not None:
        try:
            profile_doc = db.taste_profiles.find_one({'user_id': user_id})
            if profile_doc:
                profile = profile_doc.copy()
                profile.pop('_id', None)
                # Cache for next time
                cache.set(user_id, profile)
                return ProfileResponse(
                    user_id=user_id,
                    profile=profile,
                    cached=False
                )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    # Return default profile
    default_profile = profiler._default_profile()
    default_profile['user_id'] = user_id
    return ProfileResponse(
        user_id=user_id,
        profile=default_profile,
        cached=False
    )


@app.delete("/profile/{user_id}")
async def delete_profile(user_id: str):
    """Delete user taste profile from cache and database."""
    # Clear cache
    cache.delete(user_id)

    # Clear MongoDB
    db = get_mongo_db()
    if db is not None:
        try:
            db.taste_profiles.delete_one({'user_id': user_id})
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {"status": "deleted", "user_id": user_id}


@app.post("/recommend", response_model=RecommendResponse)
async def get_recommendations(request: RecommendRequest):
    """
    Get taste-based item recommendations for a user.
    Requires available_items list with item details.
    """
    user_id = request.user_id
    profile = None

    # Get profile from cache
    if request.use_cache:
        profile = cache.get(user_id)

    # Get from MongoDB if not cached
    if profile is None:
        db = get_mongo_db()
        if db is not None:
            try:
                profile_doc = db.taste_profiles.find_one({'user_id': user_id})
                if profile_doc:
                    profile = profile_doc.copy()
                    profile.pop('_id', None)
            except Exception:
                pass

    # Use default profile if not found
    if profile is None:
        profile = profiler._default_profile()
        profile['user_id'] = user_id

    # Generate recommendations
    recommendations = profiler.recommend_items(
        profile=profile,
        available_items=request.available_items,
        n=request.n
    )

    return RecommendResponse(
        user_id=user_id,
        recommendations=recommendations
    )


@app.post("/similar", response_model=SimilarResponse)
async def find_similar_users(request: SimilarRequest):
    """
    Find users with similar taste profiles.
    Can provide all_profiles for comparison or uses cached profiles.
    """
    user_id = request.user_id
    profile = None

    # Get user's profile
    if request.all_profiles and user_id in request.all_profiles:
        profile = request.all_profiles[user_id]
    else:
        profile = cache.get(user_id)

    if profile is None:
        db = get_mongo_db()
        if db is not None:
            try:
                profile_doc = db.taste_profiles.find_one({'user_id': user_id})
                if profile_doc:
                    profile = profile_doc.copy()
                    profile.pop('_id', None)
            except Exception:
                pass

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail=f"Profile not found for user: {user_id}"
        )

    # Get all profiles for comparison
    all_profiles = request.all_profiles
    if not all_profiles:
        # Try to load from cache/database
        db = get_mongo_db()
        if db is not None:
            try:
                cursor = db.taste_profiles.find({})
                for doc in cursor:
                    uid = doc.get('user_id')
                    if uid and uid != user_id:
                        profile_copy = doc.copy()
                        profile_copy.pop('_id', None)
                        all_profiles[uid] = profile_copy
            except Exception:
                pass

    # Find similar users
    similar = profiler.get_similar_users(profile, all_profiles, n=request.n)

    similar_users = [
        {"user_id": uid, "similarity_score": score}
        for uid, score in similar
    ]

    return SimilarResponse(
        user_id=user_id,
        similar_users=similar_users
    )


@app.post("/batch/profile")
async def batch_analyze_profiles(
    profiles: Dict[str, List[OrderItem]]
):
    """
    Analyze multiple user profiles in batch.
    profiles: dict of user_id -> order_history
    """
    results = {}
    profiles_to_cache = {}

    for user_id, orders in profiles.items():
        order_dicts = [order.model_dump() for order in orders]
        profile = profiler.analyze_user(order_dicts, user_id=user_id)
        results[user_id] = profile
        profiles_to_cache[user_id] = profile

    # Batch cache
    cache.set_batch(profiles_to_cache)

    return {"profiles": results}


@app.get("/cache/stats")
async def cache_stats():
    """Get cache statistics."""
    health = cache.health_check()
    try:
        info = cache.redis.info('keyspace')
        return {
            "health": health,
            "keyspace": info
        }
    except Exception:
        return {"health": health}


def main():
    """Run the API server."""
    port = int(os.environ.get('PORT', 8000))
    host = os.environ.get('HOST', '0.0.0.0')

    uvicorn.run(
        "api:app",
        host=host,
        port=port,
        reload=os.environ.get('DEBUG', 'false').lower() == 'true'
    )


if __name__ == "__main__":
    main()
