/**
 * MongoDB Database Configuration
 * Connection management with connection pooling and event handling
 */

import mongoose from 'mongoose';
import { config } from './index';
import { logger } from './logger';

const mongooseLogger = logger.child({ component: 'MongoDB' });

// Connection state
let isConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;
const RETRY_DELAY_MS = 5000;

interface ConnectionState {
  isConnected: boolean;
  readyState: number;
  host?: string;
  name?: string;
}

export async function connectDatabase(): Promise<typeof mongoose> {
  if (isConnected) {
    mongooseLogger.debug('Already connected to MongoDB');
    return mongoose;
  }

  const connectionOptions: mongoose.ConnectOptions = {
    maxPoolSize: config.mongodb.options.maxPoolSize,
    minPoolSize: config.mongodb.options.minPoolSize,
    serverSelectionTimeoutMS: config.mongodb.options.serverSelectionTimeoutMS,
    socketTimeoutMS: config.mongodb.options.socketTimeoutMS,
  };

  while (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
    try {
      connectionAttempts++;
      mongooseLogger.info('Connecting to MongoDB...', {
        host: config.mongodb.uri.replace(/\/\/.*@/, '//***@'),
        attempt: connectionAttempts,
      });

      await mongoose.connect(config.mongodb.uri, connectionOptions);

      isConnected = true;
      connectionAttempts = 0;

      mongooseLogger.info('Connected to MongoDB successfully');

      // Connection event handlers
      mongoose.connection.on('connected', () => {
        isConnected = true;
        mongooseLogger.info('MongoDB connection established');
      });

      mongoose.connection.on('disconnected', () => {
        isConnected = false;
        mongooseLogger.warn('MongoDB connection lost');
      });

      mongoose.connection.on('reconnected', () => {
        isConnected = true;
        mongooseLogger.info('MongoDB reconnected');
      });

      mongoose.connection.on('error', (error) => {
        mongooseLogger.error('MongoDB connection error', { error: error.message });
      });

      return mongoose;
    } catch (error) {
      mongooseLogger.error('Failed to connect to MongoDB', {
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: connectionAttempts,
        maxAttempts: MAX_CONNECTION_ATTEMPTS,
      });

      if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
        throw error;
      }

      mongooseLogger.info(`Retrying connection in ${RETRY_DELAY_MS / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  throw new Error('Failed to connect to MongoDB after maximum attempts');
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    mongooseLogger.debug('Already disconnected from MongoDB');
    return;
  }

  try {
    await mongoose.connection.close();
    isConnected = false;
    mongooseLogger.info('Disconnected from MongoDB');
  } catch (error) {
    mongooseLogger.error('Error disconnecting from MongoDB', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export function getConnectionState(): ConnectionState {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
  };
}

// Mongoose connection states
export const MongooseConnectionState = {
  DISCONNECTED: 0,
  CONNECTED: 1,
  CONNECTING: 2,
  DISCONNECTING: 3,
} as const;

export default mongoose;
