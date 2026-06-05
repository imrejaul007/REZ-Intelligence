#!/usr/bin/env python3
"""
Churn Model Training
Uses GradientBoostingClassifier to predict customer churn
"""
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib
import argparse

def train_churn_model(data_path: str, output_path: str):
    """Train customer churn prediction model"""
    print(f"Loading data from {data_path}...")
    df = pd.read_csv(data_path)

    # Features: tenure, engagement_score, support_tickets, plan_type, etc.
    features = ['tenure_days', 'avg_monthly_spend', 'support_tickets',
                'login_frequency', 'plan_type', 'complaints']
    X = df[features]
    y = df['churned']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

    print("Training GradientBoostingClassifier...")
    model = GradientBoostingClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        random_state=42
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print(classification_report(y_test, y_pred))

    joblib.dump(model, output_path)
    print(f"Model saved to {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    train_churn_model(args.data, args.output)
