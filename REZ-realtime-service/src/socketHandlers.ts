import { Server, Socket } from 'socket.io';
import { LiveActivityStore } from './stores/liveActivityStore.js';
import { config } from './config.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  channels?: Set<string>;
}

export function setupSocketHandlers(io: Server, store: LiveActivityStore) {
  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    socket.channels = new Set();

    // Authentication (simplified - in production, validate JWT)
    socket.on('authenticate', (data: { userId: string }) => {
      socket.userId = data.userId;
      console.log(`[Socket] User authenticated: ${data.userId} (${socket.id})`);
      socket.emit('authenticated', { success: true });
    });

    // Subscribe to channels
    socket.on('subscribe', (data: { channels: string[] }) => {
      const channels = data.channels || [];
      channels.forEach((channel: string) => {
        socket.join(channel);
        socket.channels?.add(channel);
      });
      console.log(`[Socket] ${socket.id} subscribed to: ${channels.join(', ')}`);
      socket.emit('subscribed', { channels });
    });

    // Unsubscribe from channels
    socket.on('unsubscribe', (data: { channels: string[] }) => {
      const channels = data.channels || [];
      channels.forEach((channel: string) => {
        socket.leave(channel);
        socket.channels?.delete(channel);
      });
      socket.emit('unsubscribed', { channels });
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Request live data
    socket.on('getActivities', (data: { city?: string; type?: string; limit?: number }) => {
      const activities = store.getActivities(data);
      socket.emit('activities', { activities });
    });

    socket.on('getTrending', (data: { city?: string; category?: string; limit?: number }) => {
      const items = store.getTrendingItems(data);
      socket.emit('trending', { items });
    });

    socket.on('getMerchantLive', (data: { merchantId: string }) => {
      const merchantData = store.getMerchantLiveData(data.merchantId);
      socket.emit('merchantLive', { merchantId: data.merchantId, data: merchantData });
    });

    // Disconnect handler
    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);
      if (socket.userId) {
        console.log(`[Socket] User disconnected: ${socket.userId}`);
      }
    });

    // Error handler
    socket.on('error', (error: Error) => {
      console.error(`[Socket] Error for ${socket.id}:`, error.message);
    });
  });

  // Middleware for rate limiting
  io.use((socket: AuthenticatedSocket, next) => {
    const userId = socket.handshake.auth.userId;

    if (userId) {
      const userSockets = Array.from(io.sockets.sockets.values())
        .filter((s: Socket) => (s as AuthenticatedSocket).userId === userId);

      if (userSockets.length >= config.maxConnectionsPerUser) {
        console.log(`[Socket] Rate limit: User ${userId} has too many connections`);
        return next(new Error('Too many connections'));
      }
    }

    next();
  });

  console.log('[Socket] Handlers initialized');
}
