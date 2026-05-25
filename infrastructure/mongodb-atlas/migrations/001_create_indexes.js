import logger from './utils/logger';

/**
 * MongoDB Index Migrations
 * Run these to create indexes for performance
 */

module.exports = {
  async up(db) {
    // Events collection indexes
    await db.collection('events').createIndex(
      { userId: 1, timestamp: -1 },
      { name: 'idx_user_timestamp' }
    );
    await db.collection('events').createIndex(
      { merchantId: 1, timestamp: -1 },
      { name: 'idx_merchant_timestamp' }
    );
    await db.collection('events').createIndex(
      { eventType: 1, timestamp: -1 },
      { name: 'idx_type_timestamp' }
    );
    await db.collection('events').createIndex(
      { sessionId: 1 },
      { name: 'idx_session' }
    );

    // Orders collection indexes
    await db.collection('orders').createIndex(
      { userId: 1, createdAt: -1 },
      { name: 'idx_user_orders' }
    );
    await db.collection('orders').createIndex(
      { merchantId: 1, createdAt: -1 },
      { name: 'idx_merchant_orders' }
    );
    await db.collection('orders').createIndex(
      { status: 1, createdAt: -1 },
      { name: 'idx_status_date' }
    );

    // User profiles indexes
    await db.collection('profiles').createIndex(
      { unifiedId: 1 },
      { name: 'idx_unified_id', unique: true }
    );
    await db.collection('profiles').createIndex(
      { 'identifiers.phone': 1 },
      { name: 'idx_phone' }
    );
    await db.collection('profiles').createIndex(
      { 'identifiers.email': 1 },
      { name: 'idx_email' }
    );

    // Recommendations indexes
    await db.collection('recommendations').createIndex(
      { userId: 1, type: 1, createdAt: -1 },
      { name: 'idx_user_type_date' }
    );
    await db.collection('recommendations').createIndex(
      { 'tracking.shown': 1, createdAt: -1 },
      { name: 'idx_shown_date' }
    );

    logger.info('Indexes created successfully');
  },

  async down(db) {
    // Drop indexes if needed
    await db.collection('events').dropIndex('idx_user_timestamp');
    await db.collection('events').dropIndex('idx_merchant_timestamp');
    logger.info('Indexes dropped');
  }
};
