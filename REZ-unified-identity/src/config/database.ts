import mongoose from 'mongoose';
import { logger } from './logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_unified_identity';

export interface DatabaseConfig {
  uri: string;
  options: mongoose.ConnectOptions;
}

const getConnectionOptions = (): mongoose.ConnectOptions => {
  const options: mongoose.ConnectOptions = {
    maxPoolSize: 10,
    minPoolSize: 2,
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000,
    family: 4,
  };

  if (process.env.NODE_ENV === 'production') {
    options.retryWrites = true;
    options.w = 'majority';
  }

  return options;
};

export const connectDatabase = async (): Promise<typeof mongoose> => {
  try {
    logger.info('Connecting to MongoDB...', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });

    const connection = await mongoose.connect(MONGODB_URI, getConnectionOptions());

    logger.info('MongoDB connected successfully', {
      host: connection.connection.host,
      port: connection.connection.port,
      name: connection.connection.name,
    });

    mongoose.connection.on('error', (error: Error) => {
      logger.error('MongoDB connection error', { error: error.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    return connection;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to connect to MongoDB', { error: errorMessage });
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB disconnected gracefully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error disconnecting from MongoDB', { error: errorMessage });
    throw error;
  }
};

export const isConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};

export const getConnection = (): mongoose.Connection => {
  return mongoose.connection;
};

export default {
  connect: connectDatabase,
  disconnect: disconnectDatabase,
  isConnected,
  getConnection,
};
