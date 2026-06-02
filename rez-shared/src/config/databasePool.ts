import mongoose from 'mongoose'
import { logger } from '../utils/logger'

const DEFAULT_POOL_SIZE = 50
const DEFAULT_MIN_POOL_SIZE = 10
const SOCKET_TIMEOUT = 45000
const SERVER_SELECTION_TIMEOUT = 5000

interface PoolConfig {
  maxPoolSize?: number
  minPoolSize?: number
  socketTimeout?: number
  serverSelectionTimeout?: number
}

export class DatabasePool {
  private static instance: DatabasePool
  private isConnected = false

  private constructor() {}

  static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool()
    }
    return DatabasePool.instance
  }

  async connect(uri: string, config: PoolConfig = {}): Promise<void> {
    if (this.isConnected) return

    const options: mongoose.ConnectOptions = {
      maxPoolSize: config.maxPoolSize ?? DEFAULT_POOL_SIZE,
      minPoolSize: config.minPoolSize ?? DEFAULT_MIN_POOL_SIZE,
      socketTimeoutMS: config.socketTimeout ?? SOCKET_TIMEOUT,
      serverSelectionTimeoutMS: config.serverSelectionTimeout ?? SERVER_SELECTION_TIMEOUT,
      retryWrites: true,
      retryReads: true,
      w: 'majority' as const,
      bufferCommands: false,
      family: 4,
    }

    mongoose.set('strictQuery', false)

    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected')
      this.isConnected = true
    })

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB error', { error: err })
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected')
      this.isConnected = false
    })

    await mongoose.connect(uri, options)
  }

  async disconnect(): Promise<void> {
    await mongoose.disconnect()
    this.isConnected = false
  }

  getStats() {
    const state = mongoose.connection.readyState
    return {
      state: ['disconnected', 'connected', 'connecting', 'disconnecting'][state],
      isConnected: this.isConnected,
    }
  }
}

export const dbPool = DatabasePool.getInstance()
