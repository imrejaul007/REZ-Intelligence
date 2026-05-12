"""
REZ Demand Forecast Model
Predicts merchant demand for inventory/staffing
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error
import joblib
from datetime import datetime, timedelta


class DemandForecaster:
    """Gradient boosting based demand forecasting model for merchants."""

    def __init__(self):
        self.model = GradientBoostingRegressor(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
        self.scaler = StandardScaler()
        self.feature_cols = [
            'day_of_week',
            'hour',
            'is_weekend',
            'is_holiday',
            'is_rainy',
            'temperature',
            'orders_lag_1d',
            'orders_lag_7d',
            'orders_ma_7d',
            'orders_ma_30d',
            'trend',
            'seasonal'
        ]
        self._is_trained = False

    def prepare_data(self, historical_data):
        """Prepare training data from historical orders.

        Args:
            historical_data: List of dicts with 'timestamp' and 'orders' keys

        Returns:
            pd.DataFrame with engineered features
        """
        df = pd.DataFrame(historical_data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp').reset_index(drop=True)

        # Create time-based features
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['hour'] = df['timestamp'].dt.hour
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)

        # Lag features (previous periods)
        df['orders_lag_1d'] = df['orders'].shift(1)
        df['orders_lag_7d'] = df['orders'].shift(7)

        # Moving averages
        df['orders_ma_7d'] = df['orders'].rolling(window=7, min_periods=1).mean()
        df['orders_ma_30d'] = df['orders'].rolling(window=30, min_periods=1).mean()

        # Linear trend
        df['trend'] = np.arange(len(df))

        # Seasonal component (weekly pattern)
        df['seasonal'] = np.sin(2 * np.pi * df['day_of_week'] / 7)

        # Fill NaN values created by lag/rolling operations
        df = df.fillna(method='bfill').fillna(method='ffill')

        return df

    def train(self, historical_data, eval_split=0.2):
        """Train the forecasting model.

        Args:
            historical_data: List of dicts with 'timestamp' and 'orders' keys
            eval_split: Fraction of data to use for evaluation (default 20%)

        Returns:
            self for method chaining
        """
        df = self.prepare_data(historical_data)

        X = df[self.feature_cols].values
        y = df['orders'].values

        # Time-based train/eval split (last eval_split% for evaluation)
        split_idx = int(len(df) * (1 - eval_split))
        X_train, X_eval = X[:split_idx], X[split_idx:]
        y_train, y_eval = y[:split_idx], y[split_idx:]

        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_eval_scaled = self.scaler.transform(X_eval)

        # Train model
        self.model.fit(X_train_scaled, y_train)

        # Evaluate
        train_predictions = self.model.predict(X_train_scaled)
        eval_predictions = self.model.predict(X_eval_scaled)

        train_mae = mean_absolute_error(y_train, train_predictions)
        train_rmse = np.sqrt(mean_squared_error(y_train, train_predictions))
        eval_mae = mean_absolute_error(y_eval, eval_predictions)
        eval_rmse = np.sqrt(mean_squared_error(y_eval, eval_predictions))

        print(f"Training MAE: {train_mae:.2f}")
        print(f"Training RMSE: {train_rmse:.2f}")
        print(f"Eval MAE: {eval_mae:.2f}")
        print(f"Eval RMSE: {eval_rmse:.2f}")

        # Retrain on full data for production
        X_full_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_full_scaled, y)
        self._is_trained = True

        return self

    def forecast(self, merchant_data, days=7):
        """Forecast demand for next N days.

        Args:
            merchant_data: Dict with 'historical_orders', 'last_date', 'trend'
            days: Number of days to forecast

        Returns:
            List of forecast dicts with date, predicted_orders, confidence, low, high
        """
        forecasts = []
        last_date = merchant_data.get('last_date', datetime.now())
        if isinstance(last_date, str):
            last_date = datetime.fromisoformat(last_date)

        # Get historical data
        historical = merchant_data.get('historical_orders', [])

        # Not enough data - use simple average fallback
        if len(historical) < 7:
            avg_orders = np.mean([h['orders'] for h in historical]) if historical else 10
            for i in range(days):
                forecasts.append({
                    'date': (last_date + timedelta(days=i + 1)).isoformat(),
                    'predicted_orders': round(avg_orders, 1),
                    'confidence': 0.5,
                    'low': round(avg_orders * 0.8, 1),
                    'high': round(avg_orders * 1.2, 1)
                })
            return forecasts

        # Use model for forecasting
        recent_history = historical[-14:]  # Keep last 14 days for context

        for i in range(days):
            future_date = last_date + timedelta(days=i + 1)

            features = self._prepare_features(future_date, recent_history, merchant_data)
            X = np.array([features])

            try:
                X_scaled = self.scaler.transform(X)
                prediction = self.model.predict(X_scaled)[0]
            except Exception:
                # Fallback if scaling fails
                prediction = np.mean([h['orders'] for h in historical])

            prediction = max(0, round(prediction, 1))

            # Calculate confidence interval (wider for longer forecasts)
            uncertainty = 0.2 * (1 + i / 7)
            low = max(0, round(prediction * (1 - uncertainty), 1))
            high = round(prediction * (1 + uncertainty), 1)

            # Confidence decreases with forecast horizon
            confidence = max(0.5, 0.9 - i * 0.05)

            forecasts.append({
                'date': future_date.isoformat(),
                'predicted_orders': prediction,
                'confidence': round(confidence, 2),
                'low': low,
                'high': high
            })

        return forecasts

    def _prepare_features(self, date, recent_history, merchant_data):
        """Prepare features for a future date prediction.

        Args:
            date: datetime for prediction
            recent_history: List of recent order dicts
            merchant_data: Dict with merchant metadata

        Returns:
            List of feature values in correct order
        """
        orders_lag_1d = recent_history[-1]['orders'] if recent_history else 10
        orders_lag_7d = recent_history[-7]['orders'] if len(recent_history) >= 7 else orders_lag_1d

        ma_7 = np.mean([h['orders'] for h in recent_history[-7:]]) if len(recent_history) >= 7 else orders_lag_1d
        ma_30 = np.mean([h['orders'] for h in recent_history]) if recent_history else orders_lag_1d

        features = {
            'day_of_week': date.weekday(),
            'hour': 12,  # Midday estimate for daily aggregation
            'is_weekend': 1 if date.weekday() in [5, 6] else 0,
            'is_holiday': 0,  # Would integrate with holiday calendar API
            'is_rainy': 0,  # Would integrate with weather API
            'temperature': 25,  # Would integrate with weather API
            'orders_lag_1d': orders_lag_1d,
            'orders_lag_7d': orders_lag_7d,
            'orders_ma_7d': ma_7,
            'orders_ma_30d': ma_30,
            'trend': merchant_data.get('trend', 0),
            'seasonal': np.sin(2 * np.pi * date.weekday() / 7)
        }

        return [features[f] for f in self.feature_cols]

    def get_staffing_recommendation(self, forecasts):
        """Convert order forecasts to staffing recommendations.

        Args:
            forecasts: List of forecast dicts from forecast() method

        Returns:
            List of staffing recommendations
        """
        recommendations = []

        for forecast in forecasts:
            orders = forecast['predicted_orders']

            # Tiered staffing based on order volume
            if orders < 20:
                staff_needed = 2
            elif orders < 50:
                staff_needed = 4
            elif orders < 100:
                staff_needed = 6
            elif orders < 200:
                staff_needed = 8
            else:
                staff_needed = int(orders / 20) + 2

            # Staff recommendation with confidence weighting
            recommended_staff = max(1, int(staff_needed * forecast['confidence']))

            recommendations.append({
                'date': forecast['date'],
                'predicted_orders': orders,
                'staff_needed': staff_needed,
                'recommended_staff': recommended_staff,
                'confidence': forecast['confidence'],
                'low_estimate': forecast['low'],
                'high_estimate': forecast['high']
            })

        return recommendations

    def get_inventory_recommendation(self, forecasts, avg_item_value=50):
        """Generate inventory recommendations based on forecasts.

        Args:
            forecasts: List of forecast dicts
            avg_item_value: Average value per order for inventory planning

        Returns:
            List of inventory recommendations
        """
        recommendations = []

        total_predicted = sum(f['predicted_orders'] for f in forecasts)
        total_low = sum(f['low'] for f in forecasts)
        total_high = sum(f['high'] for f in forecasts)

        # Buffer for safety stock (20% above predicted)
        safety_stock = int(total_predicted * 0.2)

        recommendations.append({
            'period_start': forecasts[0]['date'] if forecasts else None,
            'period_end': forecasts[-1]['date'] if forecasts else None,
            'total_predicted_orders': round(total_predicted, 1),
            'inventory_needed': int(total_predicted) + safety_stock,
            'low_estimate': int(total_low),
            'high_estimate': int(total_high),
            'safety_stock': safety_stock,
            'estimated_value': round(total_predicted * avg_item_value, 2)
        })

        return recommendations

    def get_trends(self, historical_data, window=7):
        """Analyze demand trends from historical data.

        Args:
            historical_data: List of dicts with 'timestamp' and 'orders'
            window: Rolling window size for trend calculation

        Returns:
            Dict with trend analysis
        """
        df = pd.DataFrame(historical_data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')

        if len(df) < window:
            return {
                'trend': 'insufficient_data',
                'slope': 0,
                'avg_daily_orders': round(df['orders'].mean(), 1) if len(df) > 0 else 0
            }

        orders = df['orders'].values
        x = np.arange(len(orders))

        # Linear regression for trend
        slope, intercept = np.polyfit(x, orders, 1)

        # Weekly pattern analysis
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        weekly_pattern = df.groupby('day_of_week')['orders'].mean().to_dict()

        # Determine trend direction
        if slope > 0.5:
            trend = 'increasing'
        elif slope < -0.5:
            trend = 'decreasing'
        else:
            trend = 'stable'

        # Volatility (coefficient of variation)
        volatility = round(df['orders'].std() / df['orders'].mean(), 2) if df['orders'].mean() > 0 else 0

        return {
            'trend': trend,
            'slope': round(slope, 3),
            'avg_daily_orders': round(df['orders'].mean(), 1),
            'weekly_pattern': {int(k): round(v, 1) for k, v in weekly_pattern.items()},
            'volatility': volatility,
            'peak_day': int(df.groupby('day_of_week')['orders'].mean().idxmax()),
            'low_day': int(df.groupby('day_of_week')['orders'].mean().idxmin())
        }

    def save(self, path='demand_model.joblib'):
        """Save model to disk.

        Args:
            path: File path for saved model
        """
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'features': self.feature_cols,
            'is_trained': self._is_trained
        }, path)
        print(f"Model saved to {path}")

    @classmethod
    def load(cls, path='demand_model.joblib'):
        """Load model from disk.

        Args:
            path: File path to load model from

        Returns:
            DemandForecaster instance with loaded model
        """
        data = joblib.load(path)
        forecaster = cls()
        forecaster.model = data['model']
        forecaster.scaler = data['scaler']
        forecaster.feature_cols = data['features']
        forecaster._is_trained = data.get('is_trained', True)
        print(f"Model loaded from {path}")
        return forecaster

    def cross_validate(self, historical_data, n_splits=5):
        """Perform time series cross-validation.

        Args:
            historical_data: List of dicts with 'timestamp' and 'orders'
            n_splits: Number of CV splits

        Returns:
            Dict with CV metrics
        """
        df = self.prepare_data(historical_data)

        if len(df) < n_splits * 2:
            return {'error': 'Insufficient data for cross-validation'}

        X = df[self.feature_cols].values
        y = df['orders'].values

        tscv = TimeSeriesSplit(n_splits=n_splits)

        mae_scores = []
        rmse_scores = []

        for train_idx, test_idx in tscv.split(X):
            X_train, X_test = X[train_idx], X[test_idx]
            y_train, y_test = y[train_idx], y[test_idx]

            # Fit scaler on training data only
            scaler_cv = StandardScaler()
            X_train_scaled = scaler_cv.fit_transform(X_train)
            X_test_scaled = scaler_cv.transform(X_test)

            # Clone model for each fold
            model_cv = GradientBoostingRegressor(
                n_estimators=100,
                max_depth=5,
                learning_rate=0.1,
                random_state=42
            )
            model_cv.fit(X_train_scaled, y_train)

            predictions = model_cv.predict(X_test_scaled)

            mae_scores.append(mean_absolute_error(y_test, predictions))
            rmse_scores.append(np.sqrt(mean_squared_error(y_test, predictions)))

        return {
            'mean_mae': round(np.mean(mae_scores), 2),
            'mean_rmse': round(np.mean(rmse_scores), 2),
            'mae_std': round(np.std(mae_scores), 2),
            'rmse_std': round(np.std(rmse_scores), 2),
            'fold_scores': [
                {'fold': i + 1, 'mae': round(m, 2), 'rmse': round(r, 2)}
                for i, (m, r) in enumerate(zip(mae_scores, rmse_scores))
            ]
        }


if __name__ == '__main__':
    # Example usage with synthetic data
    dates = pd.date_range(start='2025-01-01', periods=90, freq='D')
    base_orders = 50 + 20 * np.sin(np.arange(90) * 2 * np.pi / 7)  # Weekly pattern
    orders = base_orders + np.random.normal(0, 10, 90)  # Add noise
    orders = np.maximum(orders, 10)  # Minimum 10 orders

    sample_data = [
        {'timestamp': str(dates[i]), 'orders': int(orders[i])}
        for i in range(len(dates))
    ]

    # Train model
    forecaster = DemandForecaster()
    forecaster.train(sample_data)

    # Cross-validate
    cv_results = forecaster.cross_validate(sample_data)
    print(f"\nCross-validation results: {cv_results}")

    # Get trends
    trends = forecaster.get_trends(sample_data)
    print(f"\nTrend analysis: {trends}")

    # Forecast
    merchant_data = {
        'historical_orders': sample_data[-14:],
        'last_date': dates[-1],
        'trend': 0
    }
    forecasts = forecaster.forecast(merchant_data, days=7)
    print(f"\nForecasts: {forecasts}")

    # Staffing recommendations
    staffing = forecaster.get_staffing_recommendation(forecasts)
    print(f"\nStaffing: {staffing}")

    # Inventory recommendations
    inventory = forecaster.get_inventory_recommendation(forecasts)
    print(f"\nInventory: {inventory}")

    # Save model
    forecaster.save('/tmp/demand_model.joblib')

    # Load and verify
    loaded = DemandForecaster.load('/tmp/demand_model.joblib')
    verify_forecast = loaded.forecast(merchant_data, days=3)
    print(f"\nVerified forecast from loaded model: {verify_forecast}")
