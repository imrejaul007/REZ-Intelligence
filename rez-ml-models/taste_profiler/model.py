"""
REZ Taste Profiler Model
Analyzes user preferences across categories
"""
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from collections import Counter
import joblib
from typing import Dict, List, Any, Optional


class TasteProfiler:
    """Analyzes user taste preferences from order history."""

    def __init__(self):
        self.user_preferences: Dict[str, Dict] = {}
        self.category_embeddings: Dict[str, np.ndarray] = {}
        self.scaler = StandardScaler()
        self.n_clusters = 5

    def analyze_user(self, order_history: List[Dict[str, Any]], user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze user's taste profile from order history.
        order_history: list of {category, cuisine, price_range, rating, name, order_hour}
        user_id: optional user identifier for caching
        """
        if not order_history:
            return self._default_profile()

        categories = [o.get('category') for o in order_history if o.get('category')]
        cuisines = [o.get('cuisine') for o in order_history if o.get('cuisine')]
        prices = [o.get('price_range', 2) for o in order_history]
        ratings = [o.get('rating', 3) for o in order_history]

        # Count frequencies
        cat_counts = Counter(categories)
        cuisine_counts = Counter(cuisines)

        # Calculate preferences
        profile = {
            'top_categories': cat_counts.most_common(5),
            'top_cuisines': cuisine_counts.most_common(5),
            'avg_price_range': float(np.mean(prices)),
            'avg_rating': float(np.mean(ratings)),
            'diversity_score': float(len(set(categories)) / max(len(categories), 1)),
            'order_count': len(order_history),
            'spice_preference': self._infer_spice(order_history),
            'time_preference': self._infer_time(order_history),
            'dietary_tags': self._extract_dietary(order_history),
            'user_id': user_id
        }

        # Cache if user_id provided
        if user_id:
            self.user_preferences[user_id] = profile

        return profile

    def _infer_spice(self, orders: List[Dict[str, Any]]) -> str:
        """Infer spice preference from orders."""
        spicy_keywords = ['spicy', 'hot', 'paneer tikka', 'biryani', 'tandoori', 'chili', 'curry']
        mild_keywords = ['mild', 'butter', 'cream', 'malai', 'pasta', 'white', 'cheese']

        spicy_count = sum(
            1 for o in orders
            if any(k in str(o.get('name', '')).lower() for k in spicy_keywords)
        )
        mild_count = sum(
            1 for o in orders
            if any(k in str(o.get('name', '')).lower() for k in mild_keywords)
        )

        total = spicy_count + mild_count
        if total == 0:
            return 'medium'
        if spicy_count / total > 0.6:
            return 'spicy'
        if mild_count / total > 0.6:
            return 'mild'
        return 'medium'

    def _infer_time(self, orders: List[Dict[str, Any]]) -> str:
        """Infer ordering time preference."""
        hours = [o.get('order_hour', 12) for o in orders]

        morning = sum(1 for h in hours if 6 <= h < 12)
        afternoon = sum(1 for h in hours if 12 <= h < 17)
        evening = sum(1 for h in hours if 17 <= h < 21)
        night = sum(1 for h in hours if h >= 21 or h < 6)

        counts = {'morning': morning, 'afternoon': afternoon, 'evening': evening, 'night': night}
        return max(counts, key=counts.get)

    def _extract_dietary(self, orders: List[Dict[str, Any]]) -> List[str]:
        """Extract dietary preferences from order names."""
        tags = set()
        tag_keywords = {
            'vegetarian': ['paneer', 'veg', 'salad', 'soup', 'vegetable', 'mushroom'],
            'non-veg': ['chicken', 'mutton', 'fish', 'egg', 'meat', 'prawn'],
            'healthy': ['salad', 'grilled', 'steamed', 'light', 'fresh', 'juice'],
            'indulgent': ['cheese', 'butter', 'cream', 'deep fried', 'loaded', 'loaded'],
            'dessert': ['ice cream', 'cake', 'pastry', 'sweet', 'chocolate', 'brownie']
        }

        for order in orders:
            name = str(order.get('name', '')).lower()
            for tag, keywords in tag_keywords.items():
                if any(k in name for k in keywords):
                    tags.add(tag)

        return list(tags)

    def _default_profile(self) -> Dict[str, Any]:
        """Return a default profile for users with no order history."""
        return {
            'top_categories': [],
            'top_cuisines': [],
            'avg_price_range': 2.0,
            'avg_rating': 4.0,
            'diversity_score': 0.0,
            'order_count': 0,
            'spice_preference': 'medium',
            'time_preference': 'evening',
            'dietary_tags': [],
            'user_id': None
        }

    def get_similar_users(
        self,
        profile: Dict[str, Any],
        all_profiles: Dict[str, Dict[str, Any]],
        n: int = 10
    ) -> List[tuple]:
        """Find similar users based on taste profile."""
        similarities = []

        for user_id, other_profile in all_profiles.items():
            if user_id == profile.get('user_id'):
                continue

            sim = self._calculate_similarity(profile, other_profile)
            similarities.append((user_id, float(sim)))

        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:n]

    def _calculate_similarity(
        self,
        profile1: Dict[str, Any],
        profile2: Dict[str, Any]
    ) -> float:
        """Calculate taste similarity between two profiles (0-1 score)."""
        score = 0.0

        # Category overlap (30% weight)
        cats1 = set(c for c, _ in profile1.get('top_categories', []))
        cats2 = set(c for c, _ in profile2.get('top_categories', []))
        if cats1 and cats2:
            score += len(cats1 & cats2) / len(cats1 | cats2) * 0.3

        # Cuisine overlap (30% weight)
        cuisines1 = set(c for c, _ in profile1.get('top_cuisines', []))
        cuisines2 = set(c for c, _ in profile2.get('top_cuisines', []))
        if cuisines1 and cuisines2:
            score += len(cuisines1 & cuisines2) / len(cuisines1 | cuisines2) * 0.3

        # Price range similarity (20% weight)
        price_diff = abs(
            profile1.get('avg_price_range', 2) - profile2.get('avg_price_range', 2)
        )
        score += max(0, 1 - price_diff / 3) * 0.2

        # Spice preference match (10% weight)
        if profile1.get('spice_preference') == profile2.get('spice_preference'):
            score += 0.1

        # Dietary overlap (10% weight)
        diet1 = set(profile1.get('dietary_tags', []))
        diet2 = set(profile2.get('dietary_tags', []))
        if diet1 and diet2:
            score += len(diet1 & diet2) / len(diet1 | diet2) * 0.1

        return min(score, 1.0)

    def recommend_items(
        self,
        profile: Dict[str, Any],
        available_items: List[Dict[str, Any]],
        n: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Recommend items based on taste profile.
        available_items: list of {id, name, category, cuisine, price_range, rating}
        """
        scored_items = []

        top_cats = [c for c, _ in profile.get('top_categories', [])]
        top_cuisines = [c for c, _ in profile.get('top_cuisines', [])]
        preferred_price = profile.get('avg_price_range', 2)
        preferred_spice = profile.get('spice_preference', 'medium')
        dietary_tags = set(profile.get('dietary_tags', []))

        for item in available_items:
            score = 0.0

            # Category match
            if item.get('category') in top_cats:
                score += 0.25

            # Cuisine match
            if item.get('cuisine') in top_cuisines:
                score += 0.25

            # Price proximity
            item_price = item.get('price_range', 2)
            price_diff = abs(preferred_price - item_price)
            score += max(0, 1 - price_diff / 3) * 0.2

            # Rating bonus
            item_rating = item.get('rating', 3)
            score += (item_rating / 5.0) * 0.15

            # Spice preference
            item_name = str(item.get('name', '')).lower()
            if preferred_spice == 'spicy' and any(k in item_name for k in ['spicy', 'hot', 'chili']):
                score += 0.1
            elif preferred_spice == 'mild' and any(k in item_name for k in ['mild', 'butter', 'cream']):
                score += 0.1

            # Dietary match
            item_tags = set(item.get('tags', []))
            if dietary_tags and item_tags:
                score += len(dietary_tags & item_tags) / len(dietary_tags | item_tags) * 0.05

            scored_items.append({**item, 'taste_score': round(score, 3)})

        # Sort by taste score descending
        scored_items.sort(key=lambda x: x['taste_score'], reverse=True)
        return scored_items[:n]

    def save(self, path: str = 'taste_model.joblib') -> None:
        """Save model state to file."""
        joblib.dump({
            'preferences': self.user_preferences,
            'scaler': self.scaler,
            'n_clusters': self.n_clusters
        }, path)

    @classmethod
    def load(cls, path: str = 'taste_model.joblib') -> 'TasteProfiler':
        """Load model state from file."""
        data = joblib.load(path)
        profiler = cls()
        profiler.user_preferences = data['preferences']
        profiler.scaler = data['scaler']
        profiler.n_clusters = data.get('n_clusters', 5)
        return profiler
