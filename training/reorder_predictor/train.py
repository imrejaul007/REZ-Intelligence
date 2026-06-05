#!/usr/bin/env python3
"""
Reorder Predictor Training
"""
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
import joblib
import argparse

def train_reorder_model(data_path: str, output_path: str):
    """Train reorder prediction model"""
    df = pd.read_csv(data_path)

    features = ['purchase_interval', 'product_affinity', 'seasonality',
                'price_sensitivity', 'category_count']
    X = df[features]
    y = df['will_reorder']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

    model = GradientBoostingClassifier(n_estimators=100, max_depth=5, random_state=42)
    model.fit(X_train, y_train)

    joblib.dump(model, output_path)
    print(f"Model saved to {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    train_reorder_model(args.data, args.output)
