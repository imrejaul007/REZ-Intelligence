import mongoose from 'mongoose';
import { logger } from './logger.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-unified-profile';
const RECONNECT_INTERVAL = 5000;
const MAX_RETRIES = 10;

let retryCount = 0;
let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    logger.info('Database already connected');
    return;
  }

  const options: mongoose.ConnectOptions = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
  };

  try {
    logger.info('Connecting to MongoDB...', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });

    await mongoose.connect(MONGODB_URI, options);

    isConnected = true;
    retryCount = 0;

    logger.info('Successfully connected to MongoDB');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message });
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
      isConnected = false;
      handleDisconnect();
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      isConnected = true;
    });

  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error: error.message });
    isConnected = false;
    throw error;
  }
}

async function handleDisconnect(): Promise<void> {
  while (!isConnected && retryCount < MAX_RETRIES) {
    retryCount++;
    logger.info(`Reconnection attempt ${retryCount}/${MAX_RETRIES} in ${RECONNECT_INTERVAL}ms...`);

    await new Promise(resolve => setTimeout(resolve, RECONNECT_INTERVAL));

    try {
      await mongoose.connect(MONGODB_URI);
      isConnected = true;
      logger.info('Reconnected to MongoDB successfully');
    } catch (error) {
      logger.error(`Reconnection attempt ${retryCount} failed`, { error: error.message });
    }
  }

  if (!isConnected && retryCount >= MAX_RETRIES) {
    logger.error('Max reconnection attempts reached. Please check MongoDB availability.');
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB', { error: error.message });
    throw error;
  }
}

export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

export default {
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected
};
