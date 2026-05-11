/**
 * REZ Intelligence Hub - Dormancy Detection Cron Job
 *
 * Runs daily to identify dormant users and trigger re-engagement
 * Usage: Schedule via cron or run manually
 *
 * Cron: 0 6 * * * (daily at 6 AM)
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_intent_graph';
const ACTION_ENGINE_URL = process.env.ACTION_ENGINE_URL || 'https://rez-action-engine.onrender.com';

// Intent Schema (same as in Intent Graph)
const IntentSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  merchantId: { type: String, index: true },
  category: { type: String },
  intentKey: { type: String },
  status: { type: String, enum: ['ACTIVE', 'DORMANT', 'FULFILLED', 'EXPIRED'], default: 'ACTIVE' },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now, index: true },
  signalCount: { type: Number, default: 1 },
}, { timestamps: true, collection: 'intents' });

// Dormancy Report Schema
const DormancyReportSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  category: { type: String },
  daysSinceActive: { type: Number, required: true },
  lastIntentType: { type: String },
  totalIntents: { type: Number },
  reEngagementSent: { type: Boolean, default: false },
  reEngagementType: { type: String },
  reEngagementSentAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true, collection: 'dormancy_reports' });

// Thresholds
const DORMANCY_THRESHOLDS = {
  MILD: 7,      // 7 days - gentle nudge
  MODERATE: 14,  // 14 days - offer/promo
  SEVERE: 30,    // 30 days - win-back campaign
};

interface DormantUser {
  userId: string;
  category: string;
  daysSinceActive: number;
  lastIntentType: string;
  totalIntents: number;
}

async function detectDormantUsers(thresholdDays: number): Promise<DormantUser[]> {
  const Intent = mongoose.models.Intent || mongoose.model('Intent', IntentSchema);

  const threshold = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

  // Find users who were active but haven't been seen recently
  const dormantUsers = await Intent.aggregate([
    {
      $match: {
        status: 'ACTIVE',
        lastSeenAt: { $lt: threshold },
      },
    },
    {
      $group: {
        _id: { userId: '$userId', category: '$category' },
        lastIntentType: { $last: '$intentKey' },
        lastSeenAt: { $max: '$lastSeenAt' },
        totalIntents: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        userId: '$_id.userId',
        category: '$_id.category',
        daysSinceActive: {
          $divide: [
            { $subtract: [new Date(), '$lastSeenAt'] },
            1000 * 60 * 60 * 24,
          ],
        },
        lastIntentType: 1,
        totalIntents: 1,
      },
    },
    {
      $match: {
        daysSinceActive: { $gte: thresholdDays },
      },
    },
    {
      $sort: { daysSinceActive: -1 },
    },
    {
      $limit: 100,
    },
  ]);

  return dormantUsers as unknown as DormantUser[];
}

async function saveDormancyReports(users: DormantUser[]): Promise<number> {
  const DormancyReport = mongoose.models.DormancyReport ||
    mongoose.model('DormancyReport', DormancyReportSchema);

  let saved = 0;
  for (const user of users) {
    try {
      await DormancyReport.findOneAndUpdate(
        { userId: user.userId },
        {
          userId: user.userId,
          category: user.category,
          daysSinceActive: Math.floor(user.daysSinceActive),
          lastIntentType: user.lastIntentType,
          totalIntents: user.totalIntents,
          reEngagementSent: false,
        },
        { upsert: true, new: true }
      );
      saved++;
    } catch (err) {
      console.error(`Failed to save report for user ${user.userId}:`, err);
    }
  }
  return saved;
}

async function triggerReEngagement(user: DormantUser): Promise<boolean> {
  try {
    // Determine re-engagement type based on dormancy severity
    let reEngagementType: string;
    if (user.daysSinceActive >= DORMANCY_THRESHOLDS.SEVERE) {
      reEngagementType = 'win_back';
    } else if (user.daysSinceActive >= DORMANCY_THRESHOLDS.MODERATE) {
      reEngagementType = 'promo_offer';
    } else {
      reEngagementType = 'gentle_nudge';
    }

    // Call Action Engine to trigger re-engagement
    const response = await fetch(`${ACTION_ENGINE_URL}/api/actions/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionType: 're_engagement',
        userId: user.userId,
        trigger: 'dormancy_detection',
        severity: user.daysSinceActive >= DORMANCY_THRESHOLDS.SEVERE ? 'high' :
                 user.daysSinceActive >= DORMANCY_THRESHOLDS.MODERATE ? 'medium' : 'low',
        metadata: {
          category: user.category,
          daysSinceActive: user.daysSinceActive,
          lastIntentType: user.lastIntentType,
          reEngagementType,
        },
      }),
    });

    if (response.ok) {
      // Update report
      const DormancyReport = mongoose.models.DormancyReport ||
        mongoose.model('DormancyReport', DormancyReportSchema);
      await DormancyReport.updateOne(
        { userId: user.userId },
        {
          reEngagementSent: true,
          reEngagementType,
          reEngagementSentAt: new Date(),
        }
      );
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Failed to trigger re-engagement for ${user.userId}:`, err);
    return false;
  }
}

async function runDormancyDetection(): Promise<void> {
  console.log('[Dormancy Detection] Starting...');

  await mongoose.connect(MONGODB_URI);
  console.log('[Dormancy Detection] Connected to MongoDB');

  const totalDetected: Record<string, number> = {};
  const totalTriggered: Record<string, number> = {};

  // Check each threshold level
  for (const [level, days] of Object.entries(DORMANCY_THRESHOLDS)) {
    console.log(`\n[${level}] Checking users inactive for ${days}+ days...`);

    const dormantUsers = await detectDormantUsers(days);
    console.log(`[${level}] Found ${dormantUsers.length} dormant users`);

    if (dormantUsers.length > 0) {
      // Save reports
      const saved = await saveDormancyReports(dormantUsers);
      console.log(`[${level}] Saved ${saved} dormancy reports`);

      // Trigger re-engagement (only for severe cases in production)
      if (level === 'SEVERE' || process.env.ENABLE_ALL_RE_ENGAGEMENT === 'true') {
        let triggered = 0;
        for (const user of dormantUsers.slice(0, 10)) { // Limit to 10 per run
          const success = await triggerReEngagement(user);
          if (success) triggered++;
        }
        console.log(`[${level}] Triggered ${triggered} re-engagement campaigns`);
        totalTriggered[level] = triggered;
      }
    }

    totalDetected[level] = dormantUsers.length;
  }

  console.log('\n[Dormancy Detection] Summary:');
  console.log('Detected:', totalDetected);
  console.log('Triggered:', totalTriggered);

  await mongoose.disconnect();
  console.log('[Dormancy Detection] Done!');
}

// Run if called directly
if (require.main === module) {
  runDormancyDetection()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Dormancy Detection] Error:', err);
      process.exit(1);
    });
}

export { runDormancyDetection, DORMANCY_THRESHOLDS };
