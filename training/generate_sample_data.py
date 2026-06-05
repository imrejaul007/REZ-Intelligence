#!/usr/bin/env python3
"""
Generate sample training data for REZ ML models
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

def generate_sales_data(n=10000):
    """Generate sample sales data for demand forecasting"""
    np.random.seed(42)

    data = {
        'date': [datetime.now() - timedelta(days=i) for i in range(n)],
        'product_id': np.random.randint(1, 100, n),
        'price': np.random.uniform(10, 1000, n),
        'historical_sales': np.random.randint(1, 500, n),
        'seasonality': np.random.uniform(0.5, 1.5, n),
        'day_of_week': np.random.randint(0, 7, n),
        'month': np.random.randint(1, 13, n),
        'demand': np.random.randint(10, 200, n)
    }

    df = pd.DataFrame(data)
    df.to_csv('training/data/sales_data.csv', index=False)
    print(f"Generated sales_data.csv: {len(df)} rows")
    return df

def generate_customer_activity(n=5000):
    """Generate sample customer data for churn prediction"""
    np.random.seed(42)

    data = {
        'customer_id': range(1, n+1),
        'tenure_days': np.random.randint(1, 1000, n),
        'avg_monthly_spend': np.random.uniform(100, 10000, n),
        'support_tickets': np.random.randint(0, 20, n),
        'login_frequency': np.random.randint(1, 100, n),
        'plan_type': np.random.randint(1, 5, n),
        'complaints': np.random.randint(0, 5, n),
        'churned': np.random.randint(0, 2, n)
    }

    df = pd.DataFrame(data)
    df.to_csv('training/data/customer_activity.csv', index=False)
    print(f"Generated customer_activity.csv: {len(df)} rows")
    return df

def generate_customer_transactions(n=5000):
    """Generate sample customer data for LTV prediction"""
    np.random.seed(42)

    data = {
        'customer_id': range(1, n+1),
        'tenure_days': np.random.randint(1, 1000, n),
        'avg_order_value': np.random.uniform(20, 500, n),
        'order_frequency': np.random.randint(1, 50, n),
        'product_categories': np.random.randint(1, 10, n),
        'discount_rate': np.random.uniform(0, 0.3, n),
        'referral_count': np.random.randint(0, 20, n),
        'ltv': np.random.uniform(100, 50000, n)
    }

    df = pd.DataFrame(data)
    df.to_csv('training/data/customer_transactions.csv', index=False)
    print(f"Generated customer_transactions.csv: {len(df)} rows")
    return df

def generate_order_history(n=10000):
    """Generate sample order history for reorder prediction"""
    np.random.seed(42)

    data = {
        'order_id': range(1, n+1),
        'customer_id': np.random.randint(1, 5000, n),
        'purchase_interval': np.random.randint(1, 90, n),
        'product_affinity': np.random.uniform(0, 1, n),
        'seasonality': np.random.uniform(0.5, 1.5, n),
        'price_sensitivity': np.random.uniform(0, 1, n),
        'category_count': np.random.randint(1, 8, n),
        'will_reorder': np.random.randint(0, 2, n)
    }

    df = pd.DataFrame(data)
    df.to_csv('training/data/order_history.csv', index=False)
    print(f"Generated order_history.csv: {len(df)} rows")
    return df

def generate_user_preferences(n=5000):
    """Generate sample user preferences for taste profiling"""
    np.random.seed(42)

    data = {
        'user_id': range(1, n+1),
        'sweet_preference': np.random.uniform(0, 1, n),
        'spicy_preference': np.random.uniform(0, 1, n),
        'healthy_choice_ratio': np.random.uniform(0, 1, n),
        'organic_preference': np.random.uniform(0, 1, n),
        'price_range': np.random.randint(1, 5, n),
        'category_diversity': np.random.randint(1, 10, n)
    }

    df = pd.DataFrame(data)
    df.to_csv('training/data/user_preferences.csv', index=False)
    print(f"Generated user_preferences.csv: {len(df)} rows")
    return df

def generate_user_interactions(n=20000):
    """Generate sample user interactions for ranking model"""
    np.random.seed(42)

    data = {
        'interaction_id': range(1, n+1),
        'user_id': np.random.randint(1, 5000, n),
        'item_id': np.random.randint(1, 1000, n),
        'user_feature_1': np.random.uniform(0, 1, n),
        'user_feature_2': np.random.uniform(0, 1, n),
        'item_feature_1': np.random.uniform(0, 1, n),
        'item_feature_2': np.random.uniform(0, 1, n),
        'context_feature': np.random.uniform(0, 1, n),
        'relevance_score': np.random.randint(0, 5, n)
    }

    df = pd.DataFrame(data)
    df.to_csv('training/data/user_interactions.csv', index=False)
    print(f"Generated user_interactions.csv: {len(df)} rows")
    return df

if __name__ == "__main__":
    os.makedirs('training/data', exist_ok=True)

    print("=== REZ ML Sample Data Generator ===")
    print(f"Generating sample training data...")
    print()

    generate_sales_data()
    generate_customer_activity()
    generate_customer_transactions()
    generate_order_history()
    generate_user_preferences()
    generate_user_interactions()

    print()
    print("Sample data generation complete!")
    print("Files saved to: training/data/")
