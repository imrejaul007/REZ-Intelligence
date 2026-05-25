"""
REZ Churn Prediction - ML Client

Real ML-powered churn prediction using the REZ ML Production service.
"""

import os
import requests
from typing import Dict, Any, Optional

# ML Production service URL
ML_SERVICE_URL = os.environ.get('ML_SERVICE_URL', 'http://localhost:4080')


class ChurnPredictor:
    """
    Production churn predictor that calls the real ML service.
    Falls back to RFM-based rules if ML service is unavailable.
    """

    def __init__(self, service_url: str = ML_SERVICE_URL):
        self.service_url = service_url.rstrip('/')
        self.fallback_enabled = True

    def predict(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict churn probability using real ML model.

        Args:
            user_data: User features including:
                - engagement_score: User engagement score (0-100)
                - recency_days: Days since last activity
                - frequency_score: Activity frequency (0-10)
                - monetary_score: Spending score
                - tenure_days: Days as customer
                - support_tickets: Number of support tickets
                - session_duration: Average session length
                - app_opens: Number of app opens
                - searches: Number of searches
                - bookings: Number of bookings

        Returns:
            Dict with churn_probability, churn_risk, will_churn
        """
        try:
            # Call ML service
            response = requests.post(
                f'{self.service_url}/api/predict/churn',
                json=user_data,
                timeout=5
            )

            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    return {
                        'churn_probability': result['prediction']['churn_probability'],
                        'will_churn': result['prediction']['will_churn'],
                        'risk': result['prediction']['churn_risk']
                    }

            # Fallback to RFM if ML fails
            return self._fallback_predict(user_data)

        except requests.exceptions.ConnectionError:
            # ML service unavailable, use fallback
            return self._fallback_predict(user_data)
        except Exception as e:
            print(f"Churn prediction error: {e}")
            return self._fallback_predict(user_data)

    def _fallback_predict(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        RFM-based fallback when ML service is unavailable.
        """
        # Extract RFM features
        recency = user_data.get('recency_days', 999)
        frequency = user_data.get('frequency_score', 0)
        engagement = user_data.get('engagement_score', 0)
        tenure = user_data.get('tenure_days', 0)

        # Simple RFM scoring (higher = more likely to churn)
        score = 0

        # Recency: more days = higher churn risk
        if recency > 60:
            score += 0.5
        elif recency > 30:
            score += 0.3
        elif recency > 14:
            score += 0.15

        # Frequency: low frequency = higher churn risk
        if frequency < 2:
            score += 0.25
        elif frequency < 5:
            score += 0.1

        # Engagement: low engagement = higher churn risk
        if engagement < 30:
            score += 0.15
        elif engagement < 60:
            score += 0.05

        # Tenure: newer users have higher churn
        if tenure < 30:
            score += 0.1

        return {
            'churn_probability': min(1.0, max(0.0, score)),
            'will_churn': score > 0.5,
            'risk': 'high' if score > 0.5 else 'medium' if score > 0.3 else 'low',
            'method': 'rfm_fallback'
        }

    def predict_batch(self, users_data: list) -> list:
        """
        Predict churn for multiple users.

        Args:
            users_data: List of user feature dictionaries

        Returns:
            List of predictions
        """
        try:
            response = requests.post(
                f'{self.service_url}/api/batch/churn',
                json={'users': users_data},
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    return result.get('predictions', [])

            # Fallback
            return [self._fallback_predict(u) for u in users_data]

        except Exception:
            return [self._fallback_predict(u) for u in users_data]


# Convenience function
def predict_churn(user_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Predict churn for a single user.

    Example:
        >>> predict_churn({
        ...     'user_id': 'user_123',
        ...     'engagement_score': 75,
        ...     'recency_days': 5,
        ...     'frequency_score': 8,
        ...     'monetary_score': 2000,
        ...     'tenure_days': 90
        ... })
        {'churn_probability': 0.12, 'will_churn': False, 'risk': 'low'}
    """
    predictor = ChurnPredictor()
    return predictor.predict(user_data)
