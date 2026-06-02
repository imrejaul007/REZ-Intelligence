/**
 * @rez/shared-config - MongoDB Connection Module
 *
 * Centralized MongoDB connection with authentication support.
 * Use this module across all ReZ services to avoid code duplication.
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Authentication support (Atlas, replica sets)
 * - Connection pooling
 * - Event logging
 * - URI credential masking for security
 *
 * Usage:
 * ```typescript
 * import { connectMongoDB, disconnectMongoDB, isMongoConnected } from '@rez/shared-config/mongodb';
 *
 * async function main() {
 *   await connectMongoDB();
 *   // Your code here
 *   await disconnectMongoDB();
 * }
 * ```
 */

import mongoose, { ConnectOptions } from 'mongoose';

// ============================================================================
// Configuration
// ============================================================================

export const MONGODB_CONFIG = {
  MAX_RETRIES: 5,
  RETRY_DELAY_MS: 5000,
  MAX_POOL_SIZE: 20,
  MIN_POOL_SIZE: 5,
  MAX_IDLE_TIME_MS: 30000,
  SOCKET_TIMEOUT_MS: 45000,
  SERVER_SELECTION_TIMEOUT_MS: 5000,
  DEFAULT_AUTH_SOURCE: 'admin',
} as const;

// ============================================================================
// URI Building
// ============================================================================

/**
 * Build MongoDB URI with authentication credentials
 * Supports both authenticated and unauthenticated connections
 */
export function buildMongoUri(): string {
  const baseUri = process.env.MONGODB_URI;

  if (!baseUri) {
    throw new Error('[MongoDB] MONGODB_URI environment variable is not set');
  }

  const username = process.env.MONGODB_USERNAME;
  const password = process.env.MONGODB_PASSWORD;

  if (!username || !password) {
    return baseUri;
  }

  let uri = baseUri;

  // Handle mongodb+srv:// protocol
  if (uri.startsWith('mongodb+srv://')) {
    uri = uri.replace(/:\/\/[^@]+@/, '://');
    uri = uri.replace(
      'mongodb+srv://',
      `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
    );
  }
  // Handle mongodb:// protocol
  else if (uri.startsWith('mongodb://')) {
    uri = uri.replace(/:\/\/[^@]+@/, '://');
    uri = uri.replace(
      'mongodb://',
      `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
    );
  }

  return uri;
}

// ============================================================================
// Connection Options
// ============================================================================

/**
 * Extract replica set name from URI for connection options
 */
export function extractReplicaSetName(uri: string): string | undefined {
  const match = uri.match(/replicaSet=([^&]+)/);
  return match ? match[1] : undefined;
}

/**
 * Build connection options for mongoose
 */
export function buildConnectionOptions(): ConnectOptions {
  const authSource = process.env.MONGODB_AUTH_SOURCE || MONGODB_CONFIG.DEFAULT_AUTH_SOURCE;

  return {
    maxPoolSize: MONGODB_CONFIG.MAX_POOL_SIZE,
    minPoolSize: MONGODB_CONFIG.MIN_POOL_SIZE,
    maxIdleTimeMS: MONGODB_CONFIG.MAX_IDLE_TIME_MS,
    socketTimeoutMS: MONGODB_CONFIG.SOCKET_TIMEOUT_MS,
    serverSelectionTimeoutMS: MONGODB_CONFIG.SERVER_SELECTION_TIMEOUT_MS,
    replicaSet: extractReplicaSetName(buildMongoUri()),
    readPreference: (process.env.MONGODB_READ_PREFERENCE || 'primary') as ConnectOptions['readPreference'],
    authSource,
    // RetryWrites for Atlas
    retryWrites: true,
    // Write concern for production
    w: 'majority',
    // Journal for durability
    journal: true,
  };
}

// ============================================================================
// Logging Helpers
// ============================================================================

/**
 * Mask URI for logging (hide credentials)
 */
export function maskUri(uri: string): string {
  return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
}

/**
 * Simple logger interface - implement based on your logging solution
 */
export interface MongoLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default console logger - replace with your logger implementation
 */
export const defaultMongoLogger: MongoLogger = {
  info: (msg, meta) => console.log(`[MongoDB] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[MongoDB] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[MongoDB] ${msg}`, meta || ''),
};

// ============================================================================
// Connection Management
// ============================================================================

let mongoLogger: MongoLogger = defaultMongoLogger;
let isConnected = false;

/**
 * Set custom logger for MongoDB events
 */
export function setMongoLogger(logger: MongoLogger): void {
  mongoLogger = logger;
}

/**
 * Connect to MongoDB with authentication support and retry logic
 *
 * @param customLogger - Optional custom logger
 * @returns Promise that resolves when connected
 * @throws Error if connection fails after all retries
 */
export async function connectMongoDB(customLogger?: MongoLogger): Promise<void> {
  if (customLogger) {
    mongoLogger = customLogger;
  }

  const uri = buildMongoUri();
  const options = buildConnectionOptions();
  const hasCredentials = !!(process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD);

  // Set up event handlers
  mongoose.connection.on('connected', () => {
    isConnected = true;
    mongoLogger.info('Connected', { uri: maskUri(uri) });
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    mongoLogger.warn('Disconnected');
  });

  mongoose.connection.on('error', (err) => {
    mongoLogger.error(`Error: ${err.message}`);
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    mongoLogger.info('Reconnected');
  });

  if (hasCredentials) {
    mongoLogger.info('Authentication enabled (credentials from env vars)');
  }

  // Connection with retry
  for (let attempt = 1; attempt <= MONGODB_CONFIG.MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(uri, options);
      mongoLogger.info('Connected successfully', {
        attempt,
        replicaSet: options.replicaSet || 'none',
        readPreference: options.readPreference,
        authEnabled: hasCredentials,
      });
      return;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      mongoLogger.error(`Connection attempt ${attempt}/${MONGODB_CONFIG.MAX_RETRIES} failed`, {
        error: errorMessage,
      });

      if (attempt === MONGODB_CONFIG.MAX_RETRIES) {
        throw new Error(`MongoDB connection failed after ${MONGODB_CONFIG.MAX_RETRIES} attempts: ${errorMessage}`);
      }

      // Exponential backoff
      const delay = MONGODB_CONFIG.RETRY_DELAY_MS * attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Gracefully disconnect from MongoDB
 */
export async function disconnectMongoDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    isConnected = false;
    mongoLogger.info('Disconnected gracefully');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    mongoLogger.error('Error during disconnect', { error: errorMessage });
  }
}

/**
 * Check if MongoDB is connected
 */
export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Get connection status
 */
export function getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' | 'error' {
  const state = mongoose.connection.readyState;
  switch (state) {
    case 0: return 'disconnected';
    case 1: return 'connected';
    case 2: return 'connecting';
    default: return 'error';
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  connectMongoDB,
  disconnectMongoDB,
  isMongoConnected,
  getConnectionStatus,
  buildMongoUri,
  buildConnectionOptions,
  setMongoLogger,
  config: MONGODB_CONFIG,
};
