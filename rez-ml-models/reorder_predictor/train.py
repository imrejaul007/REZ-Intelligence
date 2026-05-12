"""
Train model on real data from MongoDB
"""
import os
from pymongo import MongoClient
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
import joblib
import pandas as pd

MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017')


def load_training_data():
    """Load historical order data for training"""
    client = MongoClient(MONGODB_URI)
    db = client['rez_training']

    # Load orders
    orders = list(db.orders.find({
        'status': 'completed'
    }).limit(100000))

    # Load reorder labels (orders within 7 days of previous)
    labels = list(db.reorder_labels.find())
    label_map = {l['order_id']: l['reordered'] for l in labels}

    # Prepare features
    df = pd.DataFrame(orders)
    df['reordered'] = df['order_id'].map(label_map).fillna(False).astype(int)

    return df


def main():
    print("Loading training data...")
    df = load_training_data()

    # Extract features
    feature_cols = [
        'days_since_last_order',
        'orders_7d',
        'orders_30d',
        'avg_order_value',
        'order_count',
        'category_diversity',
        'device_mobile'
    ]

    X = df[feature_cols].fillna(0).values
    y = df['reordered'].values

    print(f"Training on {len(X)} samples...")

    # Train
    model = GradientBoostingClassifier(n_estimators=100, max_depth=5)
    scaler = StandardScaler()

    X_scaled = scaler.fit_transform(X)
    model.fit(X_scaled, y)

    # Save
    joblib.dump({
        'model': model,
        'scaler': scaler,
        'features': feature_cols
    }, 'model.joblib')

    print("Model trained and saved!")


if __name__ == '__main__':
    main()
