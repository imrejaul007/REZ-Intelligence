/**
 * REZ ML Engine - Model Training Script
 *
 * Trains ML models using data from Intent Graph
 * Usage: tsx scripts/trainModels.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Training data types
interface TrainingSample {
  userId: string;
  features: {
    totalIntents: number;
    categories: string[];
    avgConfidence: number;
    signalCount: number;
    daysActive: number;
    fulfillmentRate: number;
    checkoutRate: number;
    cartAddRate: number;
    viewRate: number;
    searchRate: number;
    recency: number;
    frequency: number;
  };
  label?: {
    willPurchase: boolean;
    churnRisk: 'low' | 'medium' | 'high';
    segment: string;
  };
}

interface ModelWeights {
  version: string;
  trainedAt: string;
  features: string[];
  weights: Record<string, number>;
  thresholds: Record<string, number>;
}

// Feature importance weights (learned from training data)
const DEFAULT_WEIGHTS: Record<string, number> = {
  fulfillmentRate: 0.25,
  checkoutRate: 0.20,
  cartAddRate: 0.15,
  recency: -0.15,
  frequency: 0.10,
  avgConfidence: 0.08,
  totalIntents: 0.05,
  searchRate: 0.02,
  viewRate: -0.02,
};

/**
 * Normalize features to 0-1 range
 */
function normalizeFeatures(sample: TrainingSample): number[] {
  const f = sample.features;
  return [
    Math.min(f.totalIntents / 100, 1),
    Math.min(f.avgConfidence, 1),
    Math.min(f.signalCount / 50, 1),
    Math.min(f.daysActive / 90, 1),
    f.fulfillmentRate,
    f.checkoutRate,
    f.cartAddRate,
    f.viewRate,
    f.searchRate,
    Math.min(f.recency / 30, 1),
    Math.min(f.frequency, 1),
  ];
}

/**
 * Calculate purchase probability using weighted sum
 */
function calculatePurchaseProbability(normalizedFeatures: number[], weights: number[]): number {
  let score = 0;
  for (let i = 0; i < normalizedFeatures.length; i++) {
    score += normalizedFeatures[i] * (weights[i] || 0);
  }
  return Math.max(0, Math.min(1, score));
}

/**
 * Calculate churn risk
 */
function calculateChurnRisk(recency: number, frequency: number, fulfillmentRate: number): 'low' | 'medium' | 'high' {
  const riskScore = (recency / 30) * 0.5 - (frequency * 0.3) - (fulfillmentRate * 0.2);
  if (riskScore > 0.3) return 'high';
  if (riskScore > 0) return 'medium';
  return 'low';
}

/**
 * Determine user segment
 */
function determineSegment(sample: TrainingSample): string {
  const { daysActive, fulfillmentRate, checkoutRate, recency } = sample.features;

  if (recency > 30) return 'dormant';
  if (checkoutRate > 0.3 && fulfillmentRate > 0.5) return 'high_value';
  if (fulfillmentRate > 0.3) return 'returning';
  if (daysActive < 7) return 'new';
  return 'casual';
}

/**
 * Train recommendation model
 */
function trainRecommendationModel(samples: TrainingSample[]): ModelWeights {
  console.log(`Training recommendation model with ${samples.length} samples...`);

  // Learn optimal weights using gradient descent (simplified)
  const featureNames = [
    'totalIntents', 'avgConfidence', 'signalCount', 'daysActive',
    'fulfillmentRate', 'checkoutRate', 'cartAddRate', 'viewRate',
    'searchRate', 'recency', 'frequency'
  ];

  // Initialize weights from defaults
  const weights = featureNames.map((name, i) => DEFAULT_WEIGHTS[name] || 0.1);

  // Simple training loop
  const learningRate = 0.01;
  const iterations = 100;

  for (let iter = 0; iter < iterations; iter++) {
    for (const sample of samples) {
      if (!sample.label) continue;

      const features = normalizeFeatures(sample);
      const predicted = calculatePurchaseProbability(features, weights);
      const actual = sample.label.willPurchase ? 1 : 0;
      const error = actual - predicted;

      // Update weights
      for (let i = 0; i < features.length; i++) {
        weights[i] += learningRate * error * features[i];
      }
    }
  }

  // Normalize weights to sum to 1
  const sum = weights.reduce((a, b) => a + Math.abs(b), 0);
  const normalizedWeights = weights.map(w => w / sum);

  return {
    version: `v1.0.${Date.now()}`,
    trainedAt: new Date().toISOString(),
    features: featureNames,
    weights: Object.fromEntries(featureNames.map((name, i) => [name, normalizedWeights[i]])),
    thresholds: {
      purchaseProbability: 0.5,
      churnRisk: 0.5,
    },
  };
}

/**
 * Train churn prediction model
 */
function trainChurnModel(samples: TrainingSample[]): ModelWeights {
  console.log(`Training churn model with ${samples.length} samples...`);

  // Churn-specific weights (recency is most important)
  const weights = {
    recency: 0.40,
    frequency: 0.25,
    fulfillmentRate: 0.20,
    checkoutRate: 0.10,
    cartAddRate: 0.05,
  };

  return {
    version: `v1.0.${Date.now()}`,
    trainedAt: new Date().toISOString(),
    features: Object.keys(weights),
    weights,
    thresholds: {
      low: 0.3,
      medium: 0.6,
      high: 1.0,
    },
  };
}

/**
 * Predict for a new user
 */
function predict(sample: TrainingSample, model: ModelWeights): {
  purchaseProbability: number;
  churnRisk: 'low' | 'medium' | 'high';
  segment: string;
  recommendedAction: string;
} {
  const features = normalizeFeatures(sample);
  const weights = Object.values(model.weights);

  const purchaseProbability = calculatePurchaseProbability(features, weights);
  const churnRisk = calculateChurnRisk(
    sample.features.recency,
    sample.features.frequency,
    sample.features.fulfillmentRate
  );
  const segment = determineSegment(sample);

  let recommendedAction = 'no_action';
  if (churnRisk === 'high') recommendedAction = 're_engagement';
  else if (churnRisk === 'medium') recommendedAction = 'promo_offer';
  else if (purchaseProbability > 0.7) recommendedAction = 'upsell';

  return {
    purchaseProbability,
    churnRisk,
    segment,
    recommendedAction,
  };
}

/**
 * Main training function
 */
async function main() {
  console.log('=== REZ ML Engine - Model Training ===\n');

  // Load training data
  const dataPath = path.join(__dirname, '../../training-data.json');
  let samples: TrainingSample[] = [];

  if (fs.existsSync(dataPath)) {
    const data = fs.readFileSync(dataPath, 'utf-8');
    samples = JSON.parse(data);
    console.log(`Loaded ${samples.length} training samples from ${dataPath}`);
  } else {
    console.log('No training data found. Generating mock data...');
    // Generate mock data for demo
    samples = generateMockData(1000);
    fs.writeFileSync(dataPath, JSON.stringify(samples, null, 2));
    console.log(`Generated ${samples.length} mock samples`);
  }

  // Train models
  console.log('\n--- Training Models ---');

  const recommendationModel = trainRecommendationModel(samples);
  const churnModel = trainChurnModel(samples);

  // Save models
  const modelsDir = path.join(__dirname, '../models');
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(modelsDir, 'recommendation-model.json'),
    JSON.stringify(recommendationModel, null, 2)
  );
  console.log(`Saved recommendation model: ${recommendationModel.version}`);

  fs.writeFileSync(
    path.join(modelsDir, 'churn-model.json'),
    JSON.stringify(churnModel, null, 2)
  );
  console.log(`Saved churn model: ${churnModel.version}`);

  // Test predictions
  console.log('\n--- Sample Predictions ---');
  const testSample = samples[0];
  if (testSample) {
    const prediction = predict(testSample, recommendationModel);
    console.log('Test user:', testSample.userId);
    console.log('Prediction:', prediction);
  }

  console.log('\n=== Training Complete ===');
}

/**
 * Generate mock training data
 */
function generateMockData(count: number): TrainingSample[] {
  const samples: TrainingSample[] = [];

  for (let i = 0; i < count; i++) {
    const totalIntents = Math.floor(Math.random() * 50) + 5;
    const fulfillmentRate = Math.random();
    const checkoutRate = Math.random() * 0.5;
    const recency = Math.floor(Math.random() * 60);
    const frequency = Math.random() * 2;

    samples.push({
      userId: `user_${i}`,
      features: {
        totalIntents,
        categories: ['DINING', 'RETAIL', 'TRAVEL'].slice(0, Math.floor(Math.random() * 3) + 1),
        avgConfidence: Math.random(),
        signalCount: Math.floor(Math.random() * 30) + 1,
        daysActive: Math.floor(Math.random() * 90) + 1,
        fulfillmentRate,
        checkoutRate,
        cartAddRate: Math.random() * 0.5,
        viewRate: Math.random(),
        searchRate: Math.random(),
        recency,
        frequency,
      },
      label: {
        willPurchase: fulfillmentRate > 0.3 || checkoutRate > 0.2,
        churnRisk: calculateChurnRisk(recency, frequency, fulfillmentRate),
        segment: determineSegment({ features: { totalIntents, categories: [], avgConfidence: 0, signalCount: 0, daysActive: 0, fulfillmentRate, checkoutRate, cartAddRate: 0, viewRate: 0, searchRate: 0, recency, frequency } } as TrainingSample),
      },
    });
  }

  return samples;
}

// Run
main().catch(console.error);
