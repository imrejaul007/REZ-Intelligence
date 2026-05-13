"""
REZ ML Production API

Serves ML predictions via REST API.

Endpoints:
- POST /api/predict/churn - Churn prediction
- POST /api/predict/ltv - LTV prediction
- POST /api/predict/reorder - Reorder prediction
- POST /api/batch/churn - Batch churn prediction
- POST /api/batch/ltv - Batch LTV prediction
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.churn_model import ChurnModel
from models.ltv_model import LTVModel

app = Flask(__name__)
CORS(app)

# Load models at startup
print("Loading models...")
churn_model = ChurnModel()
ltv_model = LTVModel()

# Try to load saved models, fall back to training
try:
    if os.path.exists('models/churn_model.joblib'):
        churn_model.load('models/churn_model.joblib')
    else:
        # Train with sample data
        from models.churn_model import generate_sample_data
        df = generate_sample_data(10000)
        X = df.drop(['user_id', 'churn'], axis=1)
        y = df['churn']
        churn_model.train(X, y)
        churn_model.save('models/churn_model.joblib')

    if os.path.exists('models/ltv_model.joblib'):
        ltv_model.load('models/ltv_model.joblib')
    else:
        # Train with sample data
        from models.ltv_model import generate_sample_data
        df = generate_sample_data(10000)
        X = df.drop(['user_id', 'ltv'], axis=1)
        y = df['ltv']
        ltv_model.train(X, y)
        ltv_model.save('models/ltv_model.joblib')

    print("Models loaded successfully!")
except Exception as e:
    print(f"Error loading models: {e}")
    print("Will use untrained models for demo")

# =========================================================================
# HEALTH
# =========================================================================

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'service': 'rez-ml-production',
        'version': '1.0.0',
        'models': {
            'churn': 'loaded' if churn_model.model else 'not_loaded',
            'ltv': 'loaded' if ltv_model.model else 'not_loaded'
        }
    })

# =========================================================================
# CHURN PREDICTION
# =========================================================================

@app.route('/api/predict/churn', methods=['POST'])
def predict_churn():
    """
    Predict churn for a single user.

    Body:
    {
        "user_id": "user_123",
        "engagement_score": 1.5,
        "recency_days": 5,
        "frequency_score": 8,
        "monetary_score": 2000,
        "tenure_days": 90,
        "support_tickets": 0,
        "session_duration": 600,
        "app_opens": 30,
        "searches": 15,
        "bookings": 5
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        result = churn_model.predict(data)

        return jsonify({
            'success': True,
            'user_id': data.get('user_id', 'unknown'),
            'prediction': result
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/batch/churn', methods=['POST'])
def batch_churn():
    """
    Predict churn for multiple users.

    Body:
    {
        "users": [
            {"user_id": "user_1", ...},
            {"user_id": "user_2", ...}
        ]
    }
    """
    try:
        data = request.get_json()

        if not data or 'users' not in data:
            return jsonify({'error': 'No users provided'}), 400

        users = data['users']
        results = churn_model.predict_batch(users)

        # Get high-risk users
        high_risk = [r for r in results if r['churn_risk'] == 'high']
        medium_risk = [r for r in results if r['churn_risk'] == 'medium']
        low_risk = [r for r in results if r['churn_risk'] == 'low']

        return jsonify({
            'success': True,
            'total': len(results),
            'high_risk_count': len(high_risk),
            'medium_risk_count': len(medium_risk),
            'low_risk_count': len(low_risk),
            'predictions': results,
            'high_risk_users': high_risk
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# =========================================================================
# LTV PREDICTION
# =========================================================================

@app.route('/api/predict/ltv', methods=['POST'])
def predict_ltv():
    """
    Predict LTV for a single user.

    Body:
    {
        "user_id": "user_123",
        "current_spend": 10000,
        "monthly_spend": 1000,
        "order_count": 15,
        "avg_order_value": 666,
        "tenure_months": 12,
        "category_diversity": 5,
        "app_adoption": 3,
        "engagement_score": 2.5,
        "recency_days": 10,
        "frequency_score": 8
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        result = ltv_model.predict(data)

        return jsonify({
            'success': True,
            'user_id': data.get('user_id', 'unknown'),
            'prediction': result
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/batch/ltv', methods=['POST'])
def batch_ltv():
    """
    Predict LTV for multiple users.
    """
    try:
        data = request.get_json()

        if not data or 'users' not in data:
            return jsonify({'error': 'No users provided'}), 400

        users = data['users']
        results = ltv_model.predict_batch(users)

        # Segment analysis
        segments = {
            'premium': 0,
            'high': 0,
            'medium': 0,
            'low': 0
        }

        total_ltv = 0
        for r in results:
            segments[r['ltv_segment']] = segments.get(r['ltv_segment'], 0) + 1
            total_ltv += r['ltv']

        return jsonify({
            'success': True,
            'total_users': len(results),
            'segments': segments,
            'total_ltv': total_ltv,
            'avg_ltv': total_ltv / len(results) if results else 0,
            'predictions': results
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# =========================================================================
# COMBINED PREDICTION
# =========================================================================

@app.route('/api/predict/user', methods=['POST'])
def predict_user():
    """
    Get complete user prediction (churn + LTV + recommendations).
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        churn = churn_model.predict(data)
        ltv = ltv_model.predict(data)

        # Determine priority based on LTV and churn risk
        priority = 'high'
        if churn['churn_risk'] == 'high' and ltv['ltv_segment'] in ['premium', 'high']:
            priority = 'critical'
        elif churn['churn_risk'] == 'high':
            priority = 'high'
        elif ltv['ltv_segment'] in ['premium', 'high']:
            priority = 'medium'

        return jsonify({
            'success': True,
            'user_id': data.get('user_id', 'unknown'),
            'churn': churn,
            'ltv': ltv,
            'priority': priority,
            'recommendations': generate_recommendations(churn, ltv)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def generate_recommendations(churn, ltv):
    """Generate recommendations based on predictions"""
    recs = []

    if churn['churn_risk'] == 'high':
        recs.append({
            'type': 'retention',
            'priority': 'high',
            'action': 'Send retention offer immediately',
            'offer': '20% off next order'
        })

    if ltv['ltv_segment'] == 'premium':
        recs.append({
            'type': 'upsell',
            'priority': 'medium',
            'action': 'Offer premium membership',
            'benefit': 'Exclusive access, priority support'
        })

    if ltv['ltv_segment'] in ['low', 'medium']:
        recs.append({
            'type': 'engagement',
            'priority': 'low',
            'action': 'Send engagement campaigns',
            'frequency': '3x per week'
        })

    return recs

# =========================================================================
# STATS
# =========================================================================

@app.route('/api/stats', methods=['GET'])
def stats():
    """Get model statistics"""
    return jsonify({
        'success': True,
        'models': {
            'churn': {
                'type': 'GradientBoostingClassifier',
                'features': churn_model.feature_names
            },
            'ltv': {
                'type': 'RandomForestRegressor',
                'features': ltv_model.feature_names
            }
        },
        'endpoints': [
            'POST /api/predict/churn',
            'POST /api/predict/ltv',
            'POST /api/predict/user',
            'POST /api/batch/churn',
            'POST /api/batch/ltv'
        ]
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 4080))
    app.run(host='0.0.0.0', port=port, debug=True)
