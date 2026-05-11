/**
 * REZ ML Engine - Training Data Generator
 *
 * Generates training data from Intent Graph events
 * Usage: tsx scripts/generateTrainingData.ts
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_intent_graph';
const OUTPUT_FILE = process.env.OUTPUT_FILE || './training-data.json';

interface IntentEvent {
  _id: mongoose.Types.ObjectId;
  userId: string;
  merchantId?: string;
  appType: string;
  category: string;
  intentKey: string;
  intentQuery?: string;
  confidence: number;
  status: 'ACTIVE' | 'DORMANT' | 'FULFILLED' | 'EXPIRED';
  firstSeenAt: Date;
  lastSeenAt: Date;
  signalCount: number;
  metadata?: Record<string, any>;
}

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
    recency: number; // days since last activity
    frequency: number; // intents per day
  };
  label?: {
    willPurchase: boolean;
    churnRisk: 'low' | 'medium' | 'high';
    segment: string;
  };
}

// Intent Graph Schema
const IntentSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  merchantId: { type: String, index: true },
  appType: { type: String, enum: ['hotel_ota', 'restaurant', 'retail', 'hotel_guest', 'consumer'] },
  category: { type: String, enum: ['TRAVEL', 'DINING', 'RETAIL', 'HOTEL_SERVICE', 'GENERAL'] },
  intentKey: { type: String, required: true },
  intentQuery: { type: String },
  confidence: { type: Number, default: 0.3 },
  status: { type: String, enum: ['ACTIVE', 'DORMANT', 'FULFILLED', 'EXPIRED'], default: 'ACTIVE' },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  signalCount: { type: Number, default: 1 },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true, collection: 'intents' });

async function generateTrainingData(): Promise<TrainingSample[]> {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  const Intent = mongoose.models.Intent || mongoose.model('Intent', IntentSchema);

  console.log('Fetching all intents...');
  const intents = await Intent.find({}).lean() as unknown as IntentEvent[];

  console.log(`Found ${intents.length} intents`);

  // Group by user
  const userIntents = new Map<string, IntentEvent[]>();
  for (const intent of intents) {
    const userId = intent.userId;
    if (!userIntents.has(userId)) {
      userIntents.set(userId, []);
    }
    userIntents.get(userId)!.push(intent);
  }

  console.log(`Processing ${userIntents.size} unique users...`);

  const trainingData: TrainingSample[] = [];

  for (const [userId, userEvents] of userIntents) {
    if (userEvents.length < 3) continue; // Skip users with too few events

    const categories = [...new Set(userEvents.map(e => e.category))];
    const confidences = userEvents.map(e => e.confidence);
    const signalCounts = userEvents.map(e => e.signalCount);

    const now = new Date();
    const firstSeen = new Date(Math.min(...userEvents.map(e => new Date(e.firstSeenAt).getTime())));
    const lastSeen = new Date(Math.max(...userEvents.map(e => new Date(e.lastSeenAt).getTime())));

    const daysActive = Math.ceil((now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24));
    const recency = Math.ceil((now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24));

    const fulfilled = userEvents.filter(e => e.status === 'FULFILLED').length;
    const checkout = userEvents.filter(e => e.intentKey.includes('checkout')).length;
    const cartAdd = userEvents.filter(e => e.intentKey.includes('cart') || e.intentKey.includes('add')).length;
    const views = userEvents.filter(e => e.status === 'ACTIVE' && e.confidence < 0.3).length;
    const searches = userEvents.filter(e => e.intentKey.length > 3).length;

    const total = userEvents.length;

    // Generate label based on behavior
    const willPurchase = fulfilled > 0 || checkout > 0;
    const churnRisk: 'low' | 'medium' | 'high' =
      recency > 30 ? 'high' : recency > 14 ? 'medium' : 'low';

    let segment = 'new_user';
    if (daysActive > 30 && fulfilled > 5) segment = 'loyal';
    else if (daysActive > 7 && fulfilled > 0) segment = 'returning';
    else if (checkout > 0 && fulfilled === 0) segment = 'at_risk';
    else if (recency > 14) segment = 'dormant';

    const sample: TrainingSample = {
      userId,
      features: {
        totalIntents: total,
        categories,
        avgConfidence: confidences.reduce((a, b) => a + b, 0) / confidences.length,
        signalCount: signalCounts.reduce((a, b) => a + b, 0),
        daysActive,
        fulfillmentRate: fulfilled / total,
        checkoutRate: checkout / total,
        cartAddRate: cartAdd / total,
        viewRate: views / total,
        searchRate: searches / total,
        recency,
        frequency: total / Math.max(daysActive, 1),
      },
      label: {
        willPurchase,
        churnRisk,
        segment,
      },
    };

    trainingData.push(sample);
  }

  console.log(`Generated ${trainingData.length} training samples`);

  // Save to file
  const fs = await import('fs');
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(trainingData, null, 2));
  console.log(`Saved to ${OUTPUT_FILE}`);

  // Print statistics
  const segments = new Map<string, number>();
  for (const sample of trainingData) {
    const seg = sample.label!.segment;
    segments.set(seg, (segments.get(seg) || 0) + 1);
  }

  console.log('\nSegment distribution:');
  for (const [segment, count] of segments) {
    console.log(`  ${segment}: ${count} (${((count / trainingData.length) * 100).toFixed(1)}%)`);
  }

  await mongoose.disconnect();
  return trainingData;
}

// Run if called directly
if (require.main === module) {
  generateTrainingData()
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

export { generateTrainingData, TrainingSample };
