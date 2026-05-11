/**
 * MongoDB Database Configuration
 *
 * Handles MongoDB connection using Mongoose with connection pooling,
 * error handling, and graceful shutdown support.
 *
 * @module config/database
 */

import mongoose, { Connection } from 'mongoose';
import logger from '../utils/logger';

/** MongoDB connection options */
interface MongoDBOptions {
  maxPoolSize: number;
  serverSelectionTimeoutMS: number;
  socketTimeoutMS: number;
}

/** Default MongoDB connection options */
const defaultOptions: MongoDBOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

/**
 * Connect to MongoDB database
 *
 * Establishes a connection to MongoDB using the MONGODB_URI environment variable
 * or a default fallback URI. Configures connection pooling and event handlers.
 *
 * @returns Promise resolving to the mongoose connection
 * @throws Exits process if connection fails
 */
export const connectDB = async (): Promise<Connection> => {
  try {
    const mongoURI =
      process.env.MONGODB_URI ||
      'mongodb+srv://work_db_user:ZAFYAYH1zK0C74Ap@rez-intent-graph.a8ilqgi.mongodb.net/rez_personalization';

    await mongoose.connect(mongoURI, defaultOptions);

    logger.info('MongoDB connected successfully');

    // Connection error handler
    mongoose.connection.on('error', (err: Error) => {
      logger.error('MongoDB connection error:', err);
    });

    // Disconnection handler
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    return mongoose.connection;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown connection error';
    logger.error('MongoDB connection failed:', errorMessage);
    process.exit(1);
  }
};

/**
 * Get the current mongoose connection
 *
 * @returns The active mongoose connection
 */
export const getConnection = (): Connection => {
  return mongoose.connection;
};

/**
 * Close the database connection gracefully
 *
 * @returns Promise resolving when connection is closed
 */
export const closeConnection = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed gracefully');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown close error';
    logger.error('Error closing MongoDB connection:', errorMessage);
  }
};

export default { connectDB, getConnection, closeConnection };
