"""
REZ Reorder Predictor Model
Predicts probability of user reordering from merchant
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
import joblib
import os


class ReorderPredictor:
    def __init__(self):
        self.model = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
        self.scaler = StandardScaler()
        self.features = [
            'days_since_last_order',
            'order_frequency_7d',
            'order_frequency_30d',
            'avg_order_value',
            'order_count',
            'category_diversity',
            'days_since_last_visit',
            'has_cached_payment',
            'device_type_mobile',
            'time_of_day',
            'day_of_week',
            'merchant_popularity',
            'item_popularity',
            'seasonal_factor'
        ]

    def prepare_features(self, user_data, merchant_data):
        """Prepare feature vector from user and merchant data"""
        features = {}

        # Recency
        features['days_since_last_order'] = user_data.get('days_since_last_order', 30)
        features['days_since_last_visit'] = user_data.get('days_since_last_visit', 30)

        # Frequency
        features['order_frequency_7d'] = user_data.get('orders_7d', 0)
        features['order_frequency_30d'] = user_data.get('orders_30d', 0)
        features['order_count'] = user_data.get('total_orders', 0)

        # Monetary
        features['avg_order_value'] = user_data.get('avg_order_value', 0)

        # Category
        features['category_diversity'] = user_data.get('unique_categories', 1)

        # Context
        features['has_cached_payment'] = 1 if user_data.get('cached_payment') else 0
        features['device_type_mobile'] = 1 if user_data.get('device') == 'mobile' else 0
        features['time_of_day'] = user_data.get('time_of_day', 12)
        features['day_of_week'] = user_data.get('day_of_week', 0)

        # Merchant signals
        features['merchant_popularity'] = merchant_data.get('popularity_score', 0.5)
        features['item_popularity'] = merchant_data.get('item_popularity', 0.5)

        # Seasonal
        features['seasonal_factor'] = self._get_seasonal_factor()

        return np.array([[features[f] for f in self.features]])

    def _get_seasonal_factor(self):
        """Calculate seasonal adjustment"""
        month = pd.Timestamp.now().month
        # Peak months: Oct-Dec, Apr-May
        if month in [10, 11, 12, 4, 5]:
            return 1.2
        # Low months: Jan-Feb, Jul-Aug
        elif month in [1, 2, 7, 8]:
            return 0.8
        return 1.0

    def train(self, X, y):
        """Train the model"""
        X_scaled = self.scaler.fit_transform(X)
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42
        )

        self.model.fit(X_train, y_train)

        y_pred = self.model.predict(X_test)
        y_prob = self.model.predict_proba(X_test)[:, 1]

        print(classification_report(y_test, y_pred))
        print(f"ROC-AUC: {roc_auc_score(y_test, y_prob):.4f}")

        return self

    def predict(self, user_data, merchant_data):
        """Predict reorder probability"""
        X = self.prepare_features(user_data, merchant_data)
        X_scaled = self.scaler.transform(X)

        probability = self.model.predict_proba(X_scaled)[0, 1]
        risk_factors = self._explain_prediction(X_scaled)

        return {
            'probability': float(probability),
            'risk_level': 'high' if probability > 0.7 else 'medium' if probability > 0.4 else 'low',
            'risk_factors': risk_factors,
            'recommended_action': self._get_action(probability)
        }

    def _explain_prediction(self, X):
        """Explain prediction using feature importance"""
        importance = self.model.feature_importances_
        feature_importance = dict(zip(self.features, importance))

        # Sort by importance
        sorted_features = sorted(
            feature_importance.items(),
            key=lambda x: abs(x[1]),
            reverse=True
        )[:5]

        return [
            {'feature': f, 'importance': float(i)}
            for f, i in sorted_features
        ]

    def _get_action(self, probability):
        """Get recommended action based on probability"""
        if probability > 0.8:
            return 'send_nudge'
        elif probability > 0.6:
            return 'send_offer'
        elif probability > 0.4:
            return 'show_recommendation'
        else:
            return 'no_action'

    def save(self, path='model.joblib'):
        """Save model"""
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'features': self.features
        }, path)
        print(f"Model saved to {path}")

    @classmethod
    def load(cls, path='model.joblib'):
        """Load model"""
        data = joblib.load(path)
        predictor = cls()
        predictor.model = data['model']
        predictor.scaler = data['scaler']
        predictor.features = data['features']
        return predictor


if __name__ == '__main__':
    # Generate sample data
    np.random.seed(42)
    n_samples = 10000

    X = np.random.rand(n_samples, 14)
    X[:, 0] = np.random.randint(0, 60, n_samples)  # days_since_last_order
    X[:, 1] = np.random.randint(0, 15, n_samples)  # order_frequency_7d
    X[:, 2] = np.random.randint(0, 50, n_samples)  # order_frequency_30d

    # Generate target (higher values = higher probability)
    y = (X[:, 0] < 14).astype(int) * 0.3 + \
        (X[:, 1] > 3).astype(int) * 0.3 + \
        (X[:, 2] > 10).astype(int) * 0.2 + \
        np.random.rand(n_samples) * 0.2
    y = (y > 0.5).astype(int)

    # Train
    predictor = ReorderPredictor()
    predictor.train(X, y)
    predictor.save()

    # Test prediction
    test_user = {
        'days_since_last_order': 5,
        'orders_7d': 4,
        'orders_30d': 15,
        'avg_order_value': 450,
        'total_orders': 45,
        'unique_categories': 3,
        'days_since_last_visit': 2,
        'cached_payment': True,
        'device': 'mobile',
        'time_of_day': 19,
        'day_of_week': 5
    }

    test_merchant = {
        'popularity_score': 0.8,
        'item_popularity': 0.7
    }

    result = predictor.predict(test_user, test_merchant)
    print("\nPrediction:", result)
