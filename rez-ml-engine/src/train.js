/**
 * ML Model Training Script
 * Trains all ML models and saves to Model Registry
 */

const FraudModel = require('./models/fraud-model');
const RecommendationModel = require('./models/recommendation-model');
const PriceModel = require('./models/price-model');

// Generate mock training data
function generateFraudTrainingData(count = 1000) {
  const data = [];
  for (let i = 0; i < count; i++) {
    const isFraud = Math.random() < 0.03;

    // Fraud indicators
    const velocity = isFraud ? Math.random() * 30 + 20 : Math.random() * 10;
    const deviceChanges = isFraud ? Math.random() * 10 + 5 : Math.random() * 2;
    const failedPayments = isFraud ? Math.random() * 4 + 2 : Math.random();
    const amount = isFraud ? Math.random() * 40000 + 5000 : Math.random() * 2000 + 100;
    const accountAge = isFraud ? Math.random() * 30 : Math.random() * 1825;
    const crossBorder = isFraud ? Math.random() * 0.5 + 0.5 : Math.random() * 0.3;
    const unusualHours = isFraud ? Math.random() * 8 + 5 : Math.random() * 3;

    data.push({
      label: isFraud ? 1 : 0,
      features: {
        transaction_amount: amount,
        transaction_velocity: velocity,
        account_age_days: accountAge,
        device_change_count: deviceChanges,
        location_change_count: isFraud ? Math.random() * 15 + 5 : Math.random() * 3,
        failed_payment_count: failedPayments,
        avg_transaction_amount: Math.random() * 3000 + 200,
        transaction_frequency: Math.random() * 20 + 0.5,
        unusual_hour_count: unusualHours,
        new_merchant_ratio: Math.random(),
        cross_border_ratio: crossBorder,
        max_transaction_24h: isFraud ? Math.random() * 80 + 20 : Math.random() * 10
      }
    });
  }
  return data;
}

function generateRecommendationTrainingData(count = 500) {
  const data = [];
  for (let i = 0; i < count; i++) {
    const userId = `user_${Math.floor(Math.random() * 100)}`;
    const itemId = `item_${Math.floor(Math.random() * 50)}`;
    const rating = Math.random() < 0.7 ? Math.floor(Math.random() * 3) + 3 : Math.random() < 0.2 ? 1 : 2;

    data.push({ userId, itemId, rating });
  }
  return data;
}

function generatePriceTrainingData(count = 500) {
  const data = [];
  for (let i = 0; i < count; i++) {
    const price = Math.random() * 900 + 100;
    // Higher price = lower demand (inverse relationship)
    const baseDemand = 1000;
    const elasticity = -1.2;
    const demand = Math.max(10, baseDemand * Math.pow(price / 500, elasticity) + Math.random() * 100);

    data.push({
      price,
      demand: Math.round(demand),
      margin: Math.random() * 0.3 + 0.2,
      segment: Math.random() < 0.3 ? 'premium' : 'general'
    });
  }
  return data;
}

// Main training function
async function trainModels(modelType = 'all') {
  console.log('\n========================================');
  console.log('   ReZ ML Model Training Pipeline');
  console.log('========================================\n');

  const results = {};

  // Train Fraud Detection Model
  if (modelType === 'all' || modelType === 'fraud') {
    console.log('📦 Training: Fraud Detection Model\n');
    const fraudModel = new FraudModel();
    const fraudData = generateFraudTrainingData(1000);
    fraudModel.train(fraudData, { epochs: 500 });

    // Test predictions
    const fraudTest = {
      transaction_amount: 25000,
      transaction_velocity: 35,
      account_age_days: 15,
      device_change_count: 8,
      location_change_count: 12,
      failed_payment_count: 3,
      avg_transaction_amount: 800,
      transaction_frequency: 15,
      unusual_hour_count: 8,
      new_merchant_ratio: 0.8,
      cross_border_ratio: 0.9,
      max_transaction_24h: 75
    };

    const fraudResult = fraudModel.predict(fraudTest);
    console.log('🔍 Fraud Detection Test:');
    console.log(`   Probability: ${(fraudResult.fraudProbability * 100).toFixed(1)}%`);
    console.log(`   Risk Level: ${fraudResult.riskLevel}`);
    console.log(`   Decision: ${fraudResult.isFraud ? 'BLOCK' : 'ALLOW'}\n`);

    results.fraud = {
      model: fraudModel.export(),
      testResult: fraudResult
    };
  }

  // Train Recommendation Model
  if (modelType === 'all' || modelType === 'recommendation') {
    console.log('📦 Training: Recommendation Model\n');
    const recModel = new RecommendationModel();
    const recData = generateRecommendationTrainingData(500);
    recModel.train(recData, { factors: 10, epochs: 100 });

    // Test recommendations
    const testUser = 'user_50';
    const testItems = Array.from({ length: 10 }, (_, i) => ({
      itemId: `item_${i}`,
      itemName: `Product ${i + 1}`,
      rating: Math.random() * 2 + 3
    }));

    const recResult = recModel.recommend(testUser, testItems, { limit: 5 });
    console.log('🔍 Recommendation Test (User: ' + testUser + '):');
    recResult.recommendations.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.itemName} - Score: ${(r.score * 100).toFixed(0)}%`);
    });
    console.log('');

    results.recommendation = {
      model: recModel.export(),
      testResult: recResult
    };
  }

  // Train Price Optimization Model
  if (modelType === 'all' || modelType === 'price') {
    console.log('📦 Training: Price Optimization Model\n');
    const priceModel = new PriceModel();
    const priceData = generatePriceTrainingData(500);
    priceModel.train(priceData);

    // Test pricing
    const priceResult = priceModel.recommendPrice({
      currentDemand: 800,
      inventoryLevel: 0.3,
      timeOfDay: 19,
      dayOfWeek: 6,
      seasonality: 1.2
    });

    console.log('🔍 Price Optimization Test:');
    console.log(`   Recommended Price: ₹${priceResult.recommendedPrice}`);
    console.log(`   Base Price: ₹${priceResult.basePrice}`);
    console.log(`   Expected Demand: ${Math.round(priceResult.expectedDemand)}`);
    console.log(`   Adjustment Reasons: ${priceResult.adjustmentReason.join(', ')}\n`);

    results.price = {
      model: priceModel.export(),
      testResult: priceResult
    };
  }

  // Save models to file (in production, save to Model Registry)
  const fs = require('fs');
  const modelsDir = './trained-models';

  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  if (results.fraud) {
    fs.writeFileSync(
      `${modelsDir}/fraud-model-v1.0.0.json`,
      JSON.stringify(results.fraud.model, null, 2)
    );
    console.log('✅ Saved: trained-models/fraud-model-v1.0.0.json');
  }

  if (results.recommendation) {
    fs.writeFileSync(
      `${modelsDir}/recommendation-model-v1.0.0.json`,
      JSON.stringify(results.recommendation.model, null, 2)
    );
    console.log('✅ Saved: trained-models/recommendation-model-v1.0.0.json');
  }

  if (results.price) {
    fs.writeFileSync(
      `${modelsDir}/price-model-v1.0.0.json`,
      JSON.stringify(results.price.model, null, 2)
    );
    console.log('✅ Saved: trained-models/price-model-v1.0.0.json');
  }

  console.log('\n========================================');
  console.log('   Training Complete!');
  console.log('========================================\n');

  return results;
}

// Parse CLI args
const args = process.argv.slice(2);
let modelType = 'all';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model' && args[i + 1]) {
    modelType = args[i + 1];
    i++;
  }
}

// Run
trainModels(modelType).catch(console.error);
