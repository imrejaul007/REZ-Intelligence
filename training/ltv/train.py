#!/usr/bin/env python3
"""
LTV Model Training
Uses RandomForestRegressor to predict customer lifetime value
"""
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib
import argparse

def train_ltv_model(data_path: str, output_path: str):
    """Train LTV prediction model"""
    print(f"Loading data from {data_path}...")
    df = pd.read_csv(data_path)

    features = ['tenure_days', 'avg_order_value', 'order_frequency',
                'product_categories', 'discount_rate', 'referral_count']
    X = df[features]
    y = df['ltv']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

    print("Training RandomForestRegressor...")
    model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_train, y_train)

    print(f"Train R²: {model.score(X_train, y_train):.4f}")
    print(f"Test R²: {model.score(X_test, y_test):.4f}")

    joblib.dump(model, output_path)
    print(f"Model saved to {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    train_ltv_model(args.data, args.output)
