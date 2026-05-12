"""
Load historical data from MongoDB for training
"""
import os
from typing import List, Dict, Any, Optional
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import pandas as pd
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# MongoDB configuration
MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017')
MONGODB_TIMEOUT = int(os.environ.get('MONGODB_TIMEOUT_MS', '5000'))


def get_mongo_client() -> MongoClient:
    """Create and return a MongoDB client with error handling."""
    try:
        client = MongoClient(
            MONGODB_URI,
            serverSelectionTimeoutMS=MONGODB_TIMEOUT,
            connectTimeoutMS=MONGODB_TIMEOUT
        )
        # Test connection
        client.admin.command('ping')
        return client
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise


def load_merchant_data(
    merchant_id: str,
    days: int = 90,
    db_name: str = 'rez_orders',
    collection_name: str = 'orders'
) -> List[Dict[str, Any]]:
    """Load historical order data for a specific merchant.

    Aggregates orders by day and returns daily order counts with revenue.

    Args:
        merchant_id: The merchant's unique identifier
        days: Number of days of historical data to load (default 90)
        db_name: MongoDB database name (default 'rez_orders')
        collection_name: MongoDB collection name (default 'orders')

    Returns:
        List of dicts with 'date', 'orders', 'revenue' keys

    Raises:
        ConnectionFailure: If MongoDB connection fails
        ValueError: If merchant_id is empty or days is invalid
    """
    if not merchant_id:
        raise ValueError("merchant_id is required")
    if days < 1:
        raise ValueError("days must be at least 1")

    client = get_mongo_client()
    db = client[db_name]

    start_date = datetime.now() - timedelta(days=days)

    # Aggregation pipeline to get daily order counts
    pipeline = [
        # Match orders for this merchant in the date range
        {
            '$match': {
                'merchant_id': merchant_id,
                'created_at': {'$gte': start_date},
                'status': {'$in': ['completed', 'delivered', 'paid']}
            }
        },
        # Group by date
        {
            '$group': {
                '_id': {
                    'date': {
                        '$dateToString': {
                            'format': '%Y-%m-%d',
                            'date': '$created_at'
                        }
                    }
                },
                'orders': {'$sum': 1},
                'revenue': {'$sum': {'$ifNull': ['$total', '$amount', 0]}}
            }
        },
        # Sort by date ascending
        {'$sort': {'_id.date': 1}}
    ]

    try:
        results = list(db[collection_name].aggregate(pipeline))
    except Exception as e:
        logger.error(f"Aggregation failed for merchant {merchant_id}: {e}")
        raise

    return [
        {
            'date': r['_id']['date'],
            'orders': r['orders'],
            'revenue': r.get('revenue', 0)
        }
        for r in results
    ]


def load_all_merchants(
    min_orders: int = 30,
    db_name: str = 'rez_orders',
    collection_name: str = 'orders'
) -> List[str]:
    """Load all merchant IDs that have sufficient order history.

    Args:
        min_orders: Minimum number of completed orders required (default 30)
        db_name: MongoDB database name
        collection_name: MongoDB collection name

    Returns:
        List of merchant IDs with sufficient order history
    """
    client = get_mongo_client()
    db = client[db_name]

    # Aggregate to find merchants with min_orders or more
    pipeline = [
        {
            '$match': {
                'status': {'$in': ['completed', 'delivered', 'paid']}
            }
        },
        {
            '$group': {
                '_id': '$merchant_id',
                'count': {'$sum': 1}
            }
        },
        {
            '$match': {
                'count': {'$gte': min_orders}
            }
        }
    ]

    try:
        merchants = list(db[collection_name].aggregate(pipeline))
    except Exception as e:
        logger.error(f"Failed to load merchants: {e}")
        raise

    return [m['_id'] for m in merchants]


def load_merchant_with_features(
    merchant_id: str,
    days: int = 90
) -> Dict[str, Any]:
    """Load merchant data with additional features for model training.

    Args:
        merchant_id: The merchant's unique identifier
        days: Number of days of historical data

    Returns:
        Dict with historical_orders, merchant_info, and derived features
    """
    # Load basic data
    daily_data = load_merchant_data(merchant_id, days)

    if not daily_data:
        return {
            'merchant_id': merchant_id,
            'historical_orders': [],
            'total_orders': 0,
            'avg_daily_orders': 0,
            'total_revenue': 0
        }

    df = pd.DataFrame(daily_data)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')

    # Calculate additional features
    df['orders_ma_7d'] = df['orders'].rolling(7, min_periods=1).mean()
    df['revenue_ma_7d'] = df['revenue'].rolling(7, min_periods=1).mean()

    # Calculate trend (simple linear regression slope)
    if len(df) > 1:
        x = np.arange(len(df))
        y = df['orders'].values
        slope = np.polyfit(x, y, 1)[0]
    else:
        slope = 0

    # Get merchant metadata
    client = get_mongo_client()
    db = client['rez_orders']

    merchant_info = db.merchants.find_one(
        {'merchant_id': merchant_id},
        {'_id': 0, 'name': 1, 'category': 1, 'created_at': 1}
    ) or {}

    return {
        'merchant_id': merchant_id,
        'merchant_name': merchant_info.get('name', 'Unknown'),
        'category': merchant_info.get('category'),
        'historical_orders': [
            {
                'timestamp': row['date'].isoformat(),
                'orders': int(row['orders']),
                'revenue': float(row['revenue']),
                'orders_ma_7d': float(row['orders_ma_7d']),
                'revenue_ma_7d': float(row['revenue_ma_7d'])
            }
            for _, row in df.iterrows()
        ],
        'total_orders': int(df['orders'].sum()),
        'avg_daily_orders': round(df['orders'].mean(), 1),
        'total_revenue': float(df['revenue'].sum()),
        'avg_daily_revenue': round(df['revenue'].mean(), 2),
        'trend': round(slope, 3),
        'last_date': df['date'].max().isoformat()[:10]
    }


def bulk_load_merchants(
    merchant_ids: List[str],
    days: int = 90
) -> List[Dict[str, Any]]:
    """Load data for multiple merchants efficiently.

    Args:
        merchant_ids: List of merchant IDs to load
        days: Number of days of history

    Returns:
        List of merchant data dicts
    """
    results = []

    for mid in merchant_ids:
        try:
            data = load_merchant_with_features(mid, days)
            if data['total_orders'] > 0:
                results.append(data)
        except Exception as e:
            logger.warning(f"Failed to load data for merchant {mid}: {e}")
            continue

    return results


def save_training_data(
    merchant_data: List[Dict[str, Any]],
    output_path: str = 'training_data.csv'
) -> str:
    """Save merchant training data to CSV for backup or analysis.

    Args:
        merchant_data: List of merchant data dicts from bulk_load_merchants
        output_path: Path to save the CSV file

    Returns:
        Path to the saved file
    """
    all_records = []

    for merchant in merchant_data:
        mid = merchant['merchant_id']
        for order_day in merchant['historical_orders']:
            all_records.append({
                'merchant_id': mid,
                'timestamp': order_day['timestamp'],
                'orders': order_day['orders'],
                'revenue': order_day['revenue'],
                'orders_ma_7d': order_day.get('orders_ma_7d'),
                'revenue_ma_7d': order_day.get('revenue_ma_7d')
            })

    df = pd.DataFrame(all_records)
    df.to_csv(output_path, index=False)
    logger.info(f"Saved {len(df)} records to {output_path}")

    return output_path


def get_merchant_stats(
    merchant_id: str,
    db_name: str = 'rez_orders',
    collection_name: str = 'orders'
) -> Dict[str, Any]:
    """Get comprehensive statistics for a merchant.

    Args:
        merchant_id: The merchant's unique identifier
        db_name: Database name
        collection_name: Collection name

    Returns:
        Dict with various merchant statistics
    """
    client = get_mongo_client()
    db = client[db_name]

    # Date range
    date_range = list(db[collection_name].aggregate([
        {'$match': {'merchant_id': merchant_id}},
        {
            '$group': {
                '_id': None,
                'first_order': {'$min': '$created_at'},
                'last_order': {'$max': '$created_at'}
            }
        }
    ]))

    # Order status breakdown
    status_breakdown = list(db[collection_name].aggregate([
        {'$match': {'merchant_id': merchant_id}},
        {'$group': {'_id': '$status', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ]))

    # Hourly pattern
    hourly_pattern = list(db[collection_name].aggregate([
        {'$match': {
            'merchant_id': merchant_id,
            'status': {'$in': ['completed', 'delivered', 'paid']}
        }},
        {
            '$group': {
                '_id': {'$hour': '$created_at'},
                'count': {'$sum': 1}
            }
        },
        {'$sort': {'_id': 1}}
    ]))

    # Day of week pattern
    dow_pattern = list(db[collection_name].aggregate([
        {'$match': {
            'merchant_id': merchant_id,
            'status': {'$in': ['completed', 'delivered', 'paid']}
        }},
        {
            '$group': {
                '_id': {'$dayOfWeek': '$created_at'},
                'count': {'$sum': 1}
            }
        },
        {'$sort': {'_id': 1}}
    ]))

    return {
        'merchant_id': merchant_id,
        'date_range': {
            'first_order': date_range[0]['first_order'].isoformat() if date_range else None,
            'last_order': date_range[0]['last_order'].isoformat() if date_range else None
        } if date_range else None,
        'status_breakdown': {item['_id']: item['count'] for item in status_breakdown},
        'hourly_pattern': {item['_id']: item['count'] for item in hourly_pattern},
        'day_of_week_pattern': {item['_id']: item['count'] for item in dow_pattern}
    }


if __name__ == '__main__':
    # Example usage
    print("Loading merchant data...")

    # Try to load sample data
    try:
        # Get list of merchants
        merchants = load_all_merchants(min_orders=10)
        print(f"Found {len(merchants)} merchants with sufficient orders")

        if merchants:
            # Load data for first merchant
            sample_merchant = merchants[0]
            data = load_merchant_data(sample_merchant, days=30)
            print(f"\nMerchant: {sample_merchant}")
            print(f"Records: {len(data)}")
            if data:
                print(f"Latest: {data[-1]}")

            # Get stats
            stats = get_merchant_stats(sample_merchant)
            print(f"\nStats: {stats}")

    except Exception as e:
        print(f"MongoDB not available: {e}")
        print("This is expected if MongoDB is not running.")
