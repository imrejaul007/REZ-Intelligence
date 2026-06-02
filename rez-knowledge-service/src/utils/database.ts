// REZ Knowledge Service - Database Connection Utility

import mongoose from 'mongoose';
import config from '../config';
import logger from './logger';

export async function connectDatabase(): Promise<void> {
  try {
    logger.info('Connecting to MongoDB...', { uri: config.mongodb.uri.replace(/\/\/.*@/, '//<credentials>@') });

    await mongoose.connect(config.mongodb.uri, config.mongodb.options);

    logger.info('MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected gracefully');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
}

export default mongoose;
