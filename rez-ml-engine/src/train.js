import logger from './utils/logger';

/**
 * ML Model Training Script
 * Trains all ML models and saves to Model Registry
 */

const FraudModel = require('./models/fraud-model');
const RecommendationModel = require('./models/recommendation-model');
const PriceModel = require('./models/price-model');

// Seeded random for deterministic training data generation
function seededRandom(seed, offset) {
  const x = Math.sin(seed + offset) * 10000;
  return x - Math.floor(x);
}

// Generate mock training data with seeded random for determinism
function generateFraudTrainingData(count = 1000) {
  const baseSeed = Date.now();
  const data = [];
  for (let i = 0; i < count; i++) {
    const rand = seededRandom(baseSeed, i);
    const isFraud = rand < 0.03;

    // Fraud indicators
    const velocity = isFraud ? seededRandom(baseSeed, i * 20 + 1) * 30 + 20 : seededRandom(baseSeed, i * 20 + 1) * 10;
    const deviceChanges = isFraud ? seededRandom(baseSeed, i * 20 + 2) * 10 + 5 : seededRandom(baseSeed, i * 20 + 2) * 2;
    const failedPayments = isFraud ? seededRandom(baseSeed, i * 20 + 3) * 4 + 2 : seededRandom(baseSeed, i * 20 + 3);
    const amount = isFraud ? seededRandom(baseSeed, i * 20 + 4) * 40000 + 5000 : seededRandom(baseSeed, i * 20 + 4) * 2000 + 100;
    const accountAge = isFraud ? seededRandom(baseSeed, i * 20 + 5) * 30 : seededRandom(baseSeed, i * 20 + 5) * 1825;
    const crossBorder = isFraud ? seededRandom(baseSeed, i * 20 + 6) * 0.5 + 0.5 : seededRandom(baseSeed, i * 20 + 6) * 0.3;
    const unusualHours = isFraud ? seededRandom(baseSeed, i * 20 + 7) * 8 + 5 : seededRandom(baseSeed, i * 20 + 7) * 3;

    data.push({
      label: isFraud ? 1 : 0,
      features: {
        transaction_amount: amount,
        transaction_velocity: velocity,
        account_age_days: accountAge,
        device_change_count: deviceChanges,
        location_change_count: isFraud ? seededRandom(baseSeed, i * 20 + 8) * 15 + 5 : seededRandom(baseSeed, i * 20 + 8) * 3,
        failed_payment_count: failedPayments,
        avg_transaction_amount: seededRandom(baseSeed, i * 20 + 9) * 3000 + 200,
        transaction_frequency: seededRandom(baseSeed, i * 20 + 10) * 20 + 0.5,
        unusual_hour_count: unusualHours,
        new_merchant_ratio: seededRandom(baseSeed, i * 20 + 11),
        cross_border_ratio: crossBorder,
        max_transaction_24h: isFraud ? seededRandom(baseSeed, i * 20 + 12) * 80 + 20 : seededRandom(baseSeed, i * 20 + 12) * 10
      }
    });
  }
  return data;
}

function generateRecommendationTrainingData(count = 500) {
  const baseSeed = Date.now() + 1000;
  const data = [];
  for (let i = 0; i < count; i++) {
    const userId = `user_${Math.floor(seededRandom(baseSeed, i * 10) * 100)}`;
    const itemId = `item_${Math.floor(seededRandom(baseSeed, i * 10 + 1) * 50)}`;
    const ratingRand = seededRandom(baseSeed, i * 10 + 2);
    const rating = ratingRand < 0.7 ? Math.floor(seededRandom(baseSeed, i * 10 + 3) * 3) + 3 : seededRandom(baseSeed, i * 10 + 4) < 0.2 ? 1 : 2;

    data.push({ userId, itemId, rating });
  }
  return data;
}

function generatePriceTrainingData(count = 500) {
  const baseSeed = Date.now() + 2000;
  const data = [];
  for (let i = 0; i < count; i++) {
    const price = seededRandom(baseSeed, i * 5) * 900 + 100;
    // Higher price = lower demand (inverse relationship)
    const baseDemand = 1000;
    const elasticity = -1.2;
    const demand = Math.max(10, baseDemand * Math.pow(price / 500, elasticity) + seededRandom(baseSeed, i * 5 + 1) * 100);

    data.push({
      price,
      demand: Math.round(demand),
      margin: seededRandom(baseSeed, i * 5 + 2) * 0.3 + 0.2,
      segment: seededRandom(baseSeed, i * 5 + 3) < 0.3 ? 'premium' : 'general'
    });
  }
  return data;
}

// Main training function
async function trainModels(modelType = 'all') {
  logger.info('\n========================================');
  logger.info('   ReZ ML Model Training Pipeline');
  logger.info('========================================\n');

  const results = {};

  // Train Fraud Detection Model
  if (modelType === 'all' || modelType === 'fraud') {
    logger.info('📦 Training: Fraud Detection Model\n');
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
    logger.info('🔍 Fraud Detection Test:');
    logger.info(`   Probability: ${(fraudResult.fraudProbability * 100).toFixed(1)}%`);
    logger.info(`   Risk Level: ${fraudResult.riskLevel}`);
    logger.info(`   Decision: ${fraudResult.isFraud ? 'BLOCK' : 'ALLOW'}\n`);

    results.fraud = {
      model: fraudModel.export(),
      testResult: fraudResult
    };
  }

  // Train Recommendation Model
  if (modelType === 'all' || modelType === 'recommendation') {
    logger.info('📦 Training: Recommendation Model\n');
    const recModel = new RecommendationModel();
    const recData = generateRecommendationTrainingData(500);
    recModel.train(recData, { factors: 10, epochs: 100 });

    // Test recommendations
    const testUser = 'user_50';
    const testItems = Array.from({ length: 10 }, (_, i) => ({
      itemId: `item_${i}`,
      itemName: `Product ${i + 1}`,
      rating: seededRandom(Date.now(), i + 100) * 2 + 3
    }));

    const recResult = recModel.recommend(testUser, testItems, { limit: 5 });
    logger.info('🔍 Recommendation Test (User: ' + testUser + '):');
    recResult.recommendations.forEach((r, i) => {
      logger.info(`   ${i + 1}. ${r.itemName} - Score: ${(r.score * 100).toFixed(0)}%`);
    });
    logger.info('');

    results.recommendation = {
      model: recModel.export(),
      testResult: recResult
    };
  }

  // Train Price Optimization Model
  if (modelType === 'all' || modelType === 'price') {
    logger.info('📦 Training: Price Optimization Model\n');
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

    logger.info('🔍 Price Optimization Test:');
    logger.info(`   Recommended Price: ₹${priceResult.recommendedPrice}`);
    logger.info(`   Base Price: ₹${priceResult.basePrice}`);
    logger.info(`   Expected Demand: ${Math.round(priceResult.expectedDemand)}`);
    logger.info(`   Adjustment Reasons: ${priceResult.adjustmentReason.join(', ')}\n`);

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
    logger.info('✅ Saved: trained-models/fraud-model-v1.0.0.json');
  }

  if (results.recommendation) {
    fs.writeFileSync(
      `${modelsDir}/recommendation-model-v1.0.0.json`,
      JSON.stringify(results.recommendation.model, null, 2)
    );
    logger.info('✅ Saved: trained-models/recommendation-model-v1.0.0.json');
  }

  if (results.price) {
    fs.writeFileSync(
      `${modelsDir}/price-model-v1.0.0.json`,
      JSON.stringify(results.price.model, null, 2)
    );
    logger.info('✅ Saved: trained-models/price-model-v1.0.0.json');
  }

  logger.info('\n========================================');
  logger.info('   Training Complete!');
  logger.info('========================================\n');

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
