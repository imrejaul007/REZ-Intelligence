FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY . .

# Train models on startup
RUN python -c "import sys; sys.path.insert(0, '.'); from models.churn_model import generate_sample_data, ChurnModel; df = generate_sample_data(5000); X = df.drop(['user_id', 'churn'], axis=1); y = df['churn']; m = ChurnModel(); m.train(X, y); m.save('models/churn_model.joblib')"
RUN python -c "import sys; sys.path.insert(0, '.'); from models.ltv_model import generate_sample_data, LTVModel; df = generate_sample_data(5000); X = df.drop(['user_id', 'ltv'], axis=1); y = df['ltv']; m = LTVModel(); m.train(X, y); m.save('models/ltv_model.joblib')"

EXPOSE 4080

CMD ["python", "api/service.py"]
