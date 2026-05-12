"""
Redis caching for taste profiles.
Provides fast access to user taste profiles with automatic expiration.
"""
import redis
import json
import os
from typing import Dict, List, Any, Optional


REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')


class TasteCache:
    """Redis-backed cache for user taste profiles."""

    def __init__(self, redis_url: str = REDIS_URL):
        self.redis = redis.from_url(redis_url, decode_responses=True)
        self.prefix = 'taste:'
        self.ttl = 3600 * 24 * 7  # 7 days

    def get(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get cached profile for a user."""
        key = f"{self.prefix}{user_id}"
        try:
            data = self.redis.get(key)
            return json.loads(data) if data else None
        except (redis.RedisError, json.JSONDecodeError) as e:
            print(f"Cache get error for {user_id}: {e}")
            return None

    def set(self, user_id: str, profile: Dict[str, Any]) -> bool:
        """Cache user profile with TTL."""
        key = f"{self.prefix}{user_id}"
        try:
            self.redis.setex(key, self.ttl, json.dumps(profile, default=str))
            return True
        except redis.RedisError as e:
            print(f"Cache set error for {user_id}: {e}")
            return False

    def delete(self, user_id: str) -> bool:
        """Delete cached profile for a user."""
        key = f"{self.prefix}{user_id}"
        try:
            self.redis.delete(key)
            return True
        except redis.RedisError as e:
            print(f"Cache delete error for {user_id}: {e}")
            return False

    def get_batch(self, user_ids: List[str]) -> Dict[str, Optional[Dict[str, Any]]]:
        """Get multiple profiles in a single round-trip."""
        if not user_ids:
            return {}

        keys = [f"{self.prefix}{uid}" for uid in user_ids]
        try:
            values = self.redis.mget(keys)
            return {
                uid: json.loads(v) if v else None
                for uid, v in zip(user_ids, values)
            }
        except (redis.RedisError, json.JSONDecodeError) as e:
            print(f"Cache batch get error: {e}")
            return {uid: None for uid in user_ids}

    def set_batch(self, profiles: Dict[str, Dict[str, Any]]) -> int:
        """Cache multiple profiles in a single round-trip."""
        if not profiles:
            return 0

        pipe = self.redis.pipeline()
        for user_id, profile in profiles.items():
            key = f"{self.prefix}{user_id}"
            pipe.setex(key, self.ttl, json.dumps(profile, default=str))
        try:
            results = pipe.execute()
            return sum(1 for r in results if r)
        except redis.RedisError as e:
            print(f"Cache batch set error: {e}")
            return 0

    def exists(self, user_id: str) -> bool:
        """Check if a profile is cached."""
        key = f"{self.prefix}{user_id}"
        try:
            return bool(self.redis.exists(key))
        except redis.RedisError as e:
            print(f"Cache exists error for {user_id}: {e}")
            return False

    def get_ttl(self, user_id: str) -> int:
        """Get remaining TTL for a cached profile."""
        key = f"{self.prefix}{user_id}"
        try:
            return self.redis.ttl(key)
        except redis.RedisError as e:
            print(f"Cache TTL error for {user_id}: {e}")
            return -1

    def refresh(self, user_id: str) -> bool:
        """Refresh TTL for an existing profile."""
        key = f"{self.prefix}{user_id}"
        try:
            return bool(self.redis.expire(key, self.ttl))
        except redis.RedisError as e:
            print(f"Cache refresh error for {user_id}: {e}")
            return False

    def clear_all(self) -> int:
        """Clear all taste profiles from cache."""
        try:
            keys = self.redis.keys(f"{self.prefix}*")
            if keys:
                return self.redis.delete(*keys)
            return 0
        except redis.RedisError as e:
            print(f"Cache clear error: {e}")
            return 0

    def health_check(self) -> Dict[str, Any]:
        """Check Redis connection health."""
        try:
            self.redis.ping()
            info = self.redis.info('memory')
            return {
                'status': 'healthy',
                'memory_used': info.get('used_memory_human', 'unknown'),
                'connected': True
            }
        except redis.RedisError as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'connected': False
            }
