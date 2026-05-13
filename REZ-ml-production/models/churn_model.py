"""
REZ Churn Prediction Model

Predicts which users are likely to churn (stop using the platform).

Features:
- engagement_score: How active is the user
- recency: Days since last activity
- frequency: How often do they use the app
- monetary: How much do they spend
- tenure: How long have they been a user
- support_tickets: Number of complaints
- session_duration: Average session length
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, roc_auc_score
import joblib
import os

class ChurnModel:
    def __init__(self):
        self.model = GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=5,
            random_state=42
        )
        self.scaler = StandardScaler()
        self.feature_names = [
            'engagement_score',
            'recency_days',
            'frequency_score',
            'monetary_score',
            'tenure_days',
            'support_tickets',
            'session_duration',
            'app_opens',
            'searches',
            'bookings'
        ]

    def prepare_features(self, user_data):
        """Extract features from user data"""
        features = pd.DataFrame([{
            'engagement_score': user_data.get('engagement_score', 0),
            'recency_days': user_data.get('recency_days', 999),
            'frequency_score': user_data.get('frequency_score', 0),
            'monetary_score': user_data.get('monetary_score', 0),
            'tenure_days': user_data.get('tenure_days', 0),
            'support_tickets': user_data.get('support_tickets', 0),
            'session_duration': user_data.get('session_duration', 0),
            'app_opens': user_data.get('app_opens', 0),
            'searches': user_data.get('searches', 0),
            'bookings': user_data.get('bookings', 0)
        }])
        return features[self.feature_names]

    def train(self, X, y):
        """Train the model"""
        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42, stratify=y
        )

        # Train
        self.model.fit(X_train, y_train)

        # Evaluate
        y_pred = self.model.predict(X_test)
        y_proba = self.model.predict_proba(X_test)[:, 1]

        print("=== Churn Model Training ===")
        print(classification_report(y_test, y_pred))
        print(f"ROC-AUC: {roc_auc_score(y_test, y_proba):.4f}")

        return {
            'accuracy': (y_pred == y_test).mean(),
            'roc_auc': roc_auc_score(y_test, y_proba)
        }

    def predict(self, user_data):
        """Predict churn probability"""
        features = self.prepare_features(user_data)
        features_scaled = self.scaler.transform(features)

        probability = self.model.predict_proba(features_scaled)[0][1]

        return {
            'churn_probability': float(probability),
            'churn_risk': 'high' if probability > 0.7 else 'medium' if probability > 0.4 else 'low',
            'will_churn': probability > 0.5
        }

    def predict_batch(self, users_data):
        """Predict churn for multiple users"""
        features = pd.DataFrame([self.prepare_features(u).iloc[0] for u in users_data])
        features_scaled = self.scaler.transform(features)

        probabilities = self.model.predict_proba(features_scaled)[:, 1]

        results = []
        for i, prob in enumerate(probabilities):
            results.append({
                'user_id': users_data[i].get('user_id', f'user_{i}'),
                'churn_probability': float(prob),
                'churn_risk': 'high' if prob > 0.7 else 'medium' if prob > 0.4 else 'low'
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
    """Generate sample user data with churn labels"""
    np.random.seed(42)

    data = []

    for i in range(n_samples):
        # Generate features
        engagement = np.random.exponential(2)
        recency = np.random.exponential(30) + 1
        frequency = np.random.exponential(5)
        monetary = np.random.exponential(1000)
        tenure = np.random.exponential(180) + 1
        tickets = np.random.poisson(0.5)
        session = np.random.exponential(300)
        app_opens = np.random.poisson(20)
        searches = np.random.poisson(10)
        bookings = np.random.poisson(3)

        # Generate churn label based on features
        churn_score = (
            -0.3 * engagement +
            0.5 * (recency / 30) +
            -0.2 * frequency +
            -0.1 * (tenure / 180) +
            0.4 * tickets +
            -0.1 * app_opens
        )

        churn = 1 if churn_score > 0.5 else 0

        data.append({
            'user_id': f'user_{i}',
            'engagement_score': engagement,
            'recency_days': recency,
            'frequency_score': frequency,
            'monetary_score': monetary,
            'tenure_days': tenure,
            'support_tickets': tickets,
            'session_duration': session,
            'app_opens': app_opens,
            'searches': searches,
            'bookings': bookings,
            'churn': churn
        })

    return pd.DataFrame(data)


if __name__ == '__main__':
    # Generate sample data
    print("Generating sample data...")
    df = generate_sample_data(10000)

    # Prepare features and labels
    X = df.drop(['user_id', 'churn'], axis=1)
    y = df['churn']

    # Train model
    model = ChurnModel()
    metrics = model.train(X, y)

    # Save model
    os.makedirs('models', exist_ok=True)
    model.save('models/churn_model.joblib')

    # Test prediction
    test_user = {
        'user_id': 'test_user',
        'engagement_score': 1.5,
        'recency_days': 5,
        'frequency_score': 8,
        'monetary_score': 2000,
        'tenure_days': 90,
        'support_tickets': 0,
        'session_duration': 600,
        'app_opens': 30,
        'searches': 15,
        'bookings': 5
    }

    prediction = model.predict(test_user)
    print(f"\nTest prediction: {prediction}")
