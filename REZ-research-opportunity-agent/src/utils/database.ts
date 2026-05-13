import mongoose from 'mongoose';
import config from '../config/index.js';
import logger from './logger.js';

const mongoLogger = logger.child({ context: 'MongoDB' });

export async function connectDatabase(): Promise<typeof mongoose> {
  const { uri, options } = config.mongodb;

  try {
    mongoLogger.info('Connecting to MongoDB...', { uri: uri.replace(/\/\/.*@/, '//<credentials>@') });

    await mongoose.connect(uri, options);

    mongoLogger.info('MongoDB connected successfully');

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      mongoLogger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      mongoLogger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      mongoLogger.info('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

    return mongoose;
  } catch (error) {
    const err = error as Error;
    mongoLogger.error('Failed to connect to MongoDB', { error: err.message });
    throw error;
  }
}

async function gracefulShutdown(): Promise<void> {
  mongoLogger.info('Initiating graceful shutdown...');

  try {
    await mongoose.connection.close();
    mongoLogger.info('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    const err = error as Error;
    mongoLogger.error('Error during graceful shutdown', { error: err.message });
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.connection.close();
    mongoLogger.info('MongoDB disconnected');
  } catch (error) {
    const err = error as Error;
    mongoLogger.error('Error disconnecting from MongoDB', { error: err.message });
    throw error;
  }
}

export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export default { connectDatabase, disconnectDatabase, isConnected };
