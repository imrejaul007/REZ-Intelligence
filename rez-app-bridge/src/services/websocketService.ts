import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// Event types
export interface ChatMessage {
  id: string;
  userId: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file' | 'system';
  metadata?: Record<string, unknown>;
  read: boolean;
}

export interface TypingIndicator {
  userId: string;
  isTyping: boolean;
  recipientId?: string;
}

export interface OnlineStatus {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: Date;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  type: 'direct' | 'group';
  createdAt: Date;
  lastMessage?: ChatMessage;
}

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socket IDs
  private socketUsers: Map<string, string> = new Map(); // socket ID -> user ID
  private onlineUsers: Set<string> = new Set();

  /**
   * Initialize Socket.IO server
   */
  initialize(httpServer: HTTPServer): SocketIOServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();

    logger.info('WebSocket server initialized');
    return this.io;
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) {
      throw new Error('Socket.IO not initialized');
    }

    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    // Setup global notification emitter
    if (typeof global !== 'undefined') {
      (global as unknown).emitNotification = (userId: string, notification: unknown) => {
        this.emitToUser(userId, 'notification', notification);
      };
    }
  }

  /**
   * Handle new socket connection
   */
  private async handleConnection(socket: Socket): Promise<void> {
    const socketId = socket.id;

    // Extract user ID from handshake
    const userId = socket.handshake.auth.userId || socket.handshake.query.userId as string;

    if (!userId) {
      logger.warn('Socket connection rejected: no user ID', { socketId });
      socket.emit('error', { message: 'Authentication required' });
      socket.disconnect(true);
      return;
    }

    // Store socket-user mapping
    this.socketUsers.set(socketId, userId);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);

    // Update online status
    this.onlineUsers.add(userId);
    socket.join(`user:${userId}`);

    logger.info('User connected via WebSocket', { userId, socketId });

    // Emit online status to user's contacts
    this.broadcastUserStatus(userId, 'online');

    // Send acknowledgment
    socket.emit('connected', {
      socketId,
      userId,
      timestamp: new Date().toISOString(),
    });

    // Send any pending notifications/messages
    await this.sendPendingItems(socket, userId);

    // Setup disconnect handler
    socket.on('disconnect', (reason) => {
      this.handleDisconnect(socketId, userId, reason);
    });

    // Setup chat event handlers
    this.setupChatHandlers(socket, userId);

    // Setup typing handlers
    this.setupTypingHandlers(socket, userId);
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnect(socketId: string, userId: string, reason: string): void {
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socketId);
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
        this.onlineUsers.delete(userId);
        this.broadcastUserStatus(userId, 'offline', new Date());
        logger.info('User fully disconnected', { userId, reason });
      }
    }

    this.socketUsers.delete(socketId);
    logger.info('Socket disconnected', { socketId, userId, reason });
  }

  /**
   * Setup chat-related event handlers
   */
  private setupChatHandlers(socket: Socket, userId: string): void {
    // Send direct message
    socket.on('chat:message', async (data: {
      recipientId: string;
      content: string;
      type?: 'text' | 'image' | 'file';
      metadata?: Record<string, unknown>;
    }) => {
      try {
        const message: ChatMessage = {
          id: uuidv4(),
          userId,
          content: data.content,
          timestamp: new Date(),
          type: data.type || 'text',
          metadata: data.metadata,
          read: false,
        };

        // Save message (in production, save to database)
        await this.saveMessage(message);

        // Deliver to recipient if online
        this.emitToUser(data.recipientId, 'chat:message', message);

        // Confirm delivery to sender
        socket.emit('chat:message:sent', {
          messageId: message.id,
          timestamp: message.timestamp,
        });

        logger.info('Chat message delivered', {
          messageId: message.id,
          from: userId,
          to: data.recipientId,
        });
      } catch (error) {
        logger.error('Failed to send chat message', { error });
        socket.emit('chat:error', { message: 'Failed to send message' });
      }
    });

    // Mark messages as read
    socket.on('chat:read', async (data: {
      messageIds: string[];
      chatPartnerId: string;
    }) => {
      try {
        await this.markMessagesAsRead(data.messageIds);
        this.emitToUser(data.chatPartnerId, 'chat:read', {
          readerId: userId,
          messageIds: data.messageIds,
        });
      } catch (error) {
        logger.error('Failed to mark messages as read', { error });
      }
    });

    // Join chat room
    socket.on('chat:join', (data: { roomId: string }) => {
      socket.join(`room:${data.roomId}`);
      logger.debug('User joined chat room', { userId, roomId: data.roomId });
    });

    // Leave chat room
    socket.on('chat:leave', (data: { roomId: string }) => {
      socket.leave(`room:${data.roomId}`);
      logger.debug('User left chat room', { userId, roomId: data.roomId });
    });

    // Group message
    socket.on('chat:group:message', async (data: {
      roomId: string;
      content: string;
      type?: 'text' | 'image' | 'file';
      metadata?: Record<string, unknown>;
    }) => {
      try {
        const message: ChatMessage = {
          id: uuidv4(),
          userId,
          content: data.content,
          timestamp: new Date(),
          type: data.type || 'text',
          metadata: data.metadata,
          read: false,
        };

        await this.saveMessage(message);

        // Broadcast to room
        if (this.io) {
          this.io.to(`room:${data.roomId}`).emit('chat:message', message);
        }

        socket.emit('chat:message:sent', {
          messageId: message.id,
          timestamp: message.timestamp,
        });
      } catch (error) {
        logger.error('Failed to send group message', { error });
        socket.emit('chat:error', { message: 'Failed to send message' });
      }
    });
  }

  /**
   * Setup typing indicator handlers
   */
  private setupTypingHandlers(socket: Socket, userId: string): void {
    socket.on('typing:start', (data: { recipientId: string }) => {
      this.emitToUser(data.recipientId, 'typing:indicator', {
        userId,
        isTyping: true,
        recipientId: userId,
      } as TypingIndicator);
    });

    socket.on('typing:stop', (data: { recipientId: string }) => {
      this.emitToUser(data.recipientId, 'typing:indicator', {
        userId,
        isTyping: false,
        recipientId: userId,
      } as TypingIndicator);
    });
  }

  /**
   * Send pending items to newly connected user
   */
  private async sendPendingItems(socket: Socket, userId: string): Promise<void> {
    // In production, fetch pending notifications/messages from database
    // For now, we'll just emit a placeholder
    socket.emit('sync:complete', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Save message to database (stub - implement with MongoDB)
   */
  private async saveMessage(message: ChatMessage): Promise<void> {
    // In production, save to MongoDB
    logger.debug('Message saved', { messageId: message.id });
  }

  /**
   * Mark messages as read (stub - implement with MongoDB)
   */
  private async markMessagesAsRead(messageIds: string[]): Promise<void> {
    // In production, update in MongoDB
    logger.debug('Messages marked as read', { messageIds });
  }

  /**
   * Broadcast user status to contacts
   */
  private broadcastUserStatus(userId: string, status: 'online' | 'offline' | 'away', lastSeen?: Date): void {
    const statusUpdate: OnlineStatus = {
      userId,
      status,
      lastSeen,
    };

    // Emit to all online users (in production, filter to contacts only)
    if (this.io) {
      this.io.emit('user:status', statusUpdate);
    }
  }

  /**
   * Emit event to specific user (all their sockets)
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    if (!this.io) return;

    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet && userSocketSet.size > 0) {
      userSocketSet.forEach(socketId => {
        this.io?.to(socketId).emit(event, data);
      });
      logger.debug('Emitted event to user', { userId, event });
    }
  }

  /**
   * Emit event to room
   */
  emitToRoom(roomId: string, event: string, data: unknown): void {
    if (!this.io) return;
    this.io.to(`room:${roomId}`).emit(event, data);
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  /**
   * Get online status for multiple users
   */
  getOnlineStatus(userIds: string[]): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    userIds.forEach(id => {
      status[id] = this.onlineUsers.has(id);
    });
    return status;
  }

  /**
   * Get Socket.IO server instance
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Get connection statistics
   */
  getStats(): { totalConnections: number; uniqueUsers: number } {
    return {
      totalConnections: this.socketUsers.size,
      uniqueUsers: this.userSockets.size,
    };
  }
}

export const webSocketService = new WebSocketService();
