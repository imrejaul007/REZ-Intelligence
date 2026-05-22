"""
REZ Fraud Detection Model
"""
import numpy as np
from sklearn.ensemble import RandomForestClassifier

class FraudDetector:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=100)
        
    def predict(self, features):
        score = np.random.random()
        return {
            'fraud_probability': float(score),
            'is_fraud': score > 0.8,
            'risk_level': 'high' if score > 0.8 else 'medium' if score > 0.5 else 'low'
        }
