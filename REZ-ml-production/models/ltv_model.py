"""
REZ Lifetime Value (LTV) Prediction Model

Predicts how much a user will spend over their lifetime.

Features:
- current_spend: Total spend so far
- monthly_spend: Average monthly spend
- order_count: Total orders
- avg_order_value: Average order value
- tenure_months: How long they've been active
- category_diversity: Number of categories
- app_adoption: How many apps they use
- engagement: Engagement score
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import os

class LTVModel:
    def __init__(self):
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
        self.scaler = StandardScaler()
        self.feature_names = [
            'current_spend',
            'monthly_spend',
            'order_count',
            'avg_order_value',
            'tenure_months',
            'category_diversity',
            'app_adoption',
            'engagement_score',
            'recency_days',
            'frequency_score'
        ]

    def prepare_features(self, user_data):
        """Extract features from user data"""
        features = pd.DataFrame([{
            'current_spend': user_data.get('current_spend', 0),
            'monthly_spend': user_data.get('monthly_spend', 0),
            'order_count': user_data.get('order_count', 0),
            'avg_order_value': user_data.get('avg_order_value', 0),
            'tenure_months': user_data.get('tenure_months', 1),
            'category_diversity': user_data.get('category_diversity', 0),
            'app_adoption': user_data.get('app_adoption', 1),
            'engagement_score': user_data.get('engagement_score', 0),
            'recency_days': user_data.get('recency_days', 0),
            'frequency_score': user_data.get('frequency_score', 0)
        }])
        return features[self.feature_names]

    def train(self, X, y):
        """Train the model"""
        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42
        )

        # Train
        self.model.fit(X_train, y_train)

        # Predict
        y_pred = self.model.predict(X_test)

        # Evaluate
        print("=== LTV Model Training ===")
        print(f"MAE: ₹{mean_absolute_error(y_test, y_pred):.2f}")
        print(f"RMSE: ₹{np.sqrt(mean_squared_error(y_test, y_pred)):.2f}")
        print(f"R² Score: {r2_score(y_test, y_pred):.4f}")

        # Feature importance
        importance = pd.DataFrame({
            'feature': self.feature_names,
            'importance': self.model.feature_importances_
        }).sort_values('importance', ascending=False)

        print("\nTop features:")
        print(importance.head(5))

        return {
            'mae': mean_absolute_error(y_test, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_test, y_pred)),
            'r2': r2_score(y_test, y_pred)
        }

    def predict(self, user_data):
        """Predict LTV"""
        features = self.prepare_features(user_data)
        features_scaled = self.scaler.transform(features)

        ltv = self.model.predict(features_scaled)[0]

        # Segment based on LTV
        segment = 'premium' if ltv > 50000 else 'high' if ltv > 20000 else 'medium' if ltv > 5000 else 'low'

        return {
            'ltv': float(max(0, ltv)),
            'ltv_segment': segment,
            'confidence': 'high' if ltv > 20000 or ltv < 5000 else 'medium',
            'currency': 'INR'
        }

    def predict_batch(self, users_data):
        """Predict LTV for multiple users"""
        features = pd.DataFrame([self.prepare_features(u).iloc[0] for u in users_data])
        features_scaled = self.scaler.transform(features)

        predictions = self.model.predict(features_scaled)

        results = []
        for i, pred in enumerate(predictions):
            ltv = max(0, pred)
            results.append({
                'user_id': users_data[i].get('user_id', f'user_{i}'),
                'ltv': float(ltv),
                'ltv_segment': 'premium' if ltv > 50000 else 'high' if ltv > 20000 else 'medium' if ltv > 5000 else 'low'
            })

        return results

    def save(self, path):
        """Save model"""
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names
        }, path)
        print(f"Model saved to {path}")

    def load(self, path):
        """Load model"""
        data = joblib.load(path)
        self.model = data['model']
        self.scaler = data['scaler']
        self.feature_names = data['feature_names']
        print(f"Model loaded from {path}")


# Generate sample data for training
def generate_sample_data(n_samples=10000):
    """Generate sample user data with LTV labels"""
    np.random.seed(42)

    data = []

    for i in range(n_samples):
        # Generate features
        current_spend = np.random.exponential(5000)
        monthly_spend = np.random.exponential(500)
        order_count = np.random.poisson(10)
        avg_order_value = current_spend / max(1, order_count)
        tenure_months = np.random.exponential(12) + 1
        category_diversity = np.random.poisson(3)
        app_adoption = np.random.randint(1, 6)
        engagement_score = np.random.exponential(2)
        recency_days = np.random.exponential(30)
        frequency_score = np.random.exponential(5)

        # LTV is correlated with current spend, tenure, and engagement
        ltv = (
            current_spend * 2 +
            monthly_spend * tenure_months * 1.5 +
            engagement_score * 1000 +
            category_diversity * 500
        ) + np.random.normal(0, 5000)

        data.append({
            'user_id': f'user_{i}',
            'current_spend': current_spend,
            'monthly_spend': monthly_spend,
            'order_count': order_count,
            'avg_order_value': avg_order_value,
            'tenure_months': tenure_months,
            'category_diversity': category_diversity,
            'app_adoption': app_adoption,
            'engagement_score': engagement_score,
            'recency_days': recency_days,
            'frequency_score': frequency_score,
            'ltv': max(0, ltv)
        })

    return pd.DataFrame(data)


if __name__ == '__main__':
    # Generate sample data
    print("Generating sample data...")
    df = generate_sample_data(10000)

    # Prepare features and labels
    X = df.drop(['user_id', 'ltv'], axis=1)
    y = df['ltv']

    # Train model
    model = LTVModel()
    metrics = model.train(X, y)

    # Save model
    os.makedirs('models', exist_ok=True)
    model.save('models/ltv_model.joblib')

    # Test prediction
    test_user = {
        'user_id': 'test_user',
        'current_spend': 10000,
        'monthly_spend': 1000,
        'order_count': 15,
        'avg_order_value': 666,
        'tenure_months': 12,
        'category_diversity': 5,
        'app_adoption': 3,
        'engagement_score': 2.5,
        'recency_days': 10,
        'frequency_score': 8
    }

    prediction = model.predict(test_user)
    print(f"\nTest prediction: {prediction}")
