import logger from './utils/logger';

import mongoose from 'mongoose';
import config from '../config/index.js';

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    logger.info('MongoDB already connected');
    return;
  }

  try {
    await mongoose.connect(config.mongodb.uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    isConnected = true;
    logger.info(`MongoDB connected to ${config.mongodb.uri}`);

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      isConnected = true;
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB disconnected');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
}

export function getConnectionStatus(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

export default mongoose;
