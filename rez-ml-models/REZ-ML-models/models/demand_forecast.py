"""
REZ Demand Forecasting Model
"""
import numpy as np

class DemandForecaster:
    def __init__(self):
        pass
        
    def predict(self, product_id, days=7):
        forecast = [np.random.uniform(50, 200) for _ in range(days)]
        return {
            'product_id': product_id,
            'forecast': forecast,
            'trend': 'increasing' if forecast[-1] > forecast[0] else 'decreasing'
        }
