#!/usr/bin/env python3
"""
Demand Forecaster Training
Uses GradientBoostingRegressor to predict product demand
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
import joblib
import argparse
from datetime import datetime

def train_demand_forecaster(data_path: str, output_path: str):
    """Train demand forecasting model"""
    print(f"Loading data from {data_path}...")
    df = pd.read_csv(data_path)

    # Feature engineering
    features = ['price', 'historical_sales', 'seasonality', 'day_of_week', 'month']
    X = df[features]
    y = df['demand']

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

    # Train model
    print("Training GradientBoostingRegressor...")
    model = GradientBoostingRegressor(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        random_state=42
    )
    model.fit(X_train, y_train)

    # Evaluate
    train_score = model.score(X_train, y_train)
    test_score = model.score(X_test, y_test)
    print(f"Train R²: {train_score:.4f}")
    print(f"Test R²: {test_score:.4f}")

    # Save model
    joblib.dump(model, output_path)
    print(f"Model saved to {output_path}")

    return model

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    train_demand_forecaster(args.data, args.output)
