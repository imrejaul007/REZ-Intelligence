/**
 * REZ Care Service - Database Indexes
 *
 * Optimized indexes for fast queries.
 * Run this on service startup or separately.
 */

import mongoose from 'mongoose';
import { logger } from '../utils/logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-care';

export async function createIndexes() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error('Database connection not established');
    }

    logger.info('Creating database indexes...');

    // CSAT Surveys
    await db.collection('csatsurveys').createIndexes([
      { key: { ticketId: 1 }, unique: true },
      { key: { customerId: 1 } },
      { key: { status: 1, expiresAt: 1 } },
      { key: { sentAt: 1 } },
    ]);
    logger.info('✓ CSAT Surveys indexes created');

    // CSAT Responses
    await db.collection('csatresponses').createIndexes([
      { key: { ticketId: 1 } },
      { key: { customerId: 1 } },
      { key: { createdAt: 1 } },
      { key: { agentId: 1 } },
    ]);
    logger.info('✓ CSAT Responses indexes created');

    // Sentiment History
    await db.collection('sentimenthistories').createIndexes([
      { key: { customerId: 1, createdAt: -1 } },
      { key: { source: 1 } },
    ]);
    logger.info('✓ Sentiment History indexes created');

    // Proactive Alerts
    await db.collection('proactivealerts').createIndexes([
      { key: { type: 1, severity: 1, status: 1 } },
      { key: { status: 1, detectedAt: -1 } },
      { key: { affectedUsers: 1 } },
      { key: { affectedMerchants: 1 } },
      { key: { 'affectedUsers': 1, 'detectedAt': -1 } },
    ]);
    logger.info('✓ Proactive Alerts indexes created');

    // Auto Tickets
    await db.collection('autotickets').createIndexes([
      { key: { ticketId: 1 }, unique: true },
      { key: { type: 1, severity: 1, status: 1 } },
      { key: { status: 1, detectedAt: -1 } },
      { key: { customerId: 1 } },
      { key: { merchantId: 1 } },
      { key: { assignedTo: 1 } },
    ]);
    logger.info('✓ Auto Tickets indexes created');

    logger.info('All database indexes created successfully!');

  } catch (error) {
    logger.error('Failed to create indexes', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  createIndexes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default createIndexes;
