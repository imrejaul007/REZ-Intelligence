#!/usr/bin/env python3
"""
Taste Profiler Training
Uses KMeans for customer segmentation
"""
import pandas as pd
from sklearn.cluster import KMeans
import joblib
import argparse

def train_taste_profiler(data_path: str, output_path: str):
    """Train taste profiling model"""
    df = pd.read_csv(data_path)

    features = ['sweet_preference', 'spicy_preference', 'healthy_choice_ratio',
                'organic_preference', 'price_range', 'category_diversity']
    X = df[features]

    # Cluster into 5 taste profiles
    model = KMeans(n_clusters=5, random_state=42)
    model.fit(X)

    joblib.dump(model, output_path)
    print(f"Model saved to {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    train_taste_profiler(args.data, args.output)
