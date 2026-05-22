"""
REZ ML API Service
"""
from flask import Flask, request, jsonify
from models.fraud_detection import FraudDetector
from models.churn_prediction import ChurnPredictor
from models.ltv_prediction import LTVPredictor
from models.demand_forecast import DemandForecaster

app = Flask(__name__)

fraud = FraudDetector()
churn = ChurnPredictor()
ltv = LTVPredictor()
demand = DemandForecaster()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'ml-api'})

@app.route('/api/predict/fraud', methods=['POST'])
def predict_fraud():
    data = request.get_json()
    return jsonify(fraud.predict(data))

@app.route('/api/predict/churn', methods=['POST'])
def predict_churn():
    data = request.get_json()
    return jsonify(churn.predict(data))

@app.route('/api/predict/ltv', methods=['POST'])
def predict_ltv():
    data = request.get_json()
    return jsonify(ltv.predict(data))

@app.route('/api/predict/demand', methods=['POST'])
def predict_demand():
    data = request.get_json()
    return jsonify(demand.predict(data.get('product_id')))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4080)
