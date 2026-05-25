import logger from './utils/logger';

/**
 * MongoDB Atlas Connection Manager
 * Handles connection pooling, retry logic, and failover
 */
const mongoose = require('mongoose');

class MongoAtlasConnection {
  constructor(config) {
    this.config = {
      // Required: Your Atlas connection string
      uri: process.env.MONGODB_URI || 'mongodb+srv://<user>:<password>@cluster.mongodb.net/rez_intelligence',

      // Optional: Per-database connections
      databases: {
        events: 'rez_events',
        orders: 'rez_orders',
        users: 'rez_users',
        intelligence: 'rez_intelligence',
        ml: 'rez_ml',
        logs: 'rez_logs'
      },

      // Connection options
      maxPoolSize: 100,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,

      // Retry options
      retryWrites: true,
      retryReads: true,
      w: 'majority',

      // Atlas-specific
      authSource: 'admin',
      replicaSet: process.env.MONGODB_REPLICA_SET || null, // Optional: 'rs0'
      directConnection: false
    };

    this.connections = new Map();
  }

  async connect(database = 'intelligence') {
    const dbName = this.config.databases[database] || database;

    // Build connection URI with database
    let uri = this.config.uri;
    if (!uri.includes('/')) {
      uri = `${uri}/${dbName}`;
    } else if (uri.split('/').length === 3) {
      uri = uri.replace(/\/[^\/]+$/, `/${dbName}`);
    }

    const options = {
      maxPoolSize: this.config.maxPoolSize,
      minPoolSize: this.config.minPoolSize,
      serverSelectionTimeoutMS: this.config.serverSelectionTimeoutMS,
      socketTimeoutMS: this.config.socketTimeoutMS,
      retryWrites: this.config.retryWrites,
      retryReads: this.config.retryReads,
      w: this.config.w,
      authSource: this.config.authSource
    };

    if (this.config.replicaSet) {
      options.replicaSet = this.config.replicaSet;
    }

    try {
      await mongoose.connect(uri, options);
      logger.info(`Connected to MongoDB Atlas: ${dbName}`);

      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });

      return mongoose.connection;
    } catch (err) {
      console.error('Failed to connect to MongoDB Atlas:', err.message);
      throw err;
    }
  }

  async connectAll() {
    // Connect to all databases in parallel
    const promises = Object.keys(this.config.databases).map(
      db => this.connect(db).catch(err => {
        console.error(`Failed to connect to ${db}:`, err.message);
        return null;
      })
    );

    return Promise.all(promises);
  }

  async disconnect() {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB Atlas');
  }

  getConnection(database = 'intelligence') {
    return mongoose.connections.find(
      c => c.name.includes(this.config.databases[database])
    );
  }
}

module.exports = new MongoAtlasConnection();
