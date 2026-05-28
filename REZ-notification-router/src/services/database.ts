import mongoose from 'mongoose';
import { logInfo, logError, logWarn } from './logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-notification-router';

export async function connectDatabase(): Promise<void> {
  try {
    logInfo('Connecting to MongoDB...');

    await mongoose.connect(MONGODB_URI);

    logInfo('Connected to MongoDB successfully');

    mongoose.connection.on('error', (err) => {
      logError('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logWarn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logInfo('MongoDB reconnected');
    });
  } catch (error) {
    logError('Failed to connect to MongoDB', { error: (error as Error).message });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.connection.close();
    logInfo('MongoDB connection closed');
  } catch (error) {
    logError('Error closing MongoDB connection', { error: (error as Error).message });
  }
}

export async function pingDatabase(): Promise<boolean> {
  try {
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
