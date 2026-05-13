import { Server as SocketIOServer, Socket } from 'socket.io';
import { WidgetService } from './widgetService';
import winston from 'winston';

interface ClientSession {
  socketId: string;
  sessionId: string;
  userId?: string;
  connectedAt: Date;
}

interface IncomingMessage {
  type: 'message' | 'typing' | 'ping';
  payload: {
    sessionId?: string;
    message?: string;
    userId?: string;
  };
}

interface OutgoingMessage {
  type: 'message' | 'response' | 'typing' | 'error' | 'session_created' | 'connected';
  payload: Record<string, unknown>;
}

export class SocketService {
  private io: SocketIOServer;
  private widgetService: WidgetService;
  private logger: winston.Logger;
  private clientSessions: Map<string, ClientSession> = new Map();
  private sessionToSocket: Map<string, string> = new Map();

  constructor(
    io: SocketIOServer,
    widgetService: WidgetService,
    logger: winston.Logger
  ) {
    this.io = io;
    this.widgetService = widgetService;
    this.logger = logger;
  }

  handleConnection(socket: Socket): void {
    // Send connection acknowledgment
    this.sendToSocket(socket, {
      type: 'connected',
      payload: {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      },
    });

    // Handle incoming messages
    socket.on('message', async (data: IncomingMessage) => {
      await this.handleMessage(socket, data);
    });

    // Handle typing indicator
    socket.on('typing', (data: { sessionId: string; isTyping: boolean }) => {
      this.handleTyping(socket, data);
    });

    // Handle session join
    socket.on('join_session', async (data: { sessionId: string; userId?: string }) => {
      await this.handleJoinSession(socket, data);
    });

    // Handle explicit ping
    socket.on('ping', () => {
      this.sendToSocket(socket, { type: 'connected', payload: { timestamp: Date.now() } });
    });
  }

  private async handleMessage(socket: Socket, data: IncomingMessage): Promise<void> {
    try {
      const { sessionId, message } = data.payload;

      if (!sessionId) {
        // Create a new session if none provided
        const session = await this.widgetService.createSession(data.payload.userId);

        // Store session mapping
        this.storeSessionMapping(socket, session.sessionId, data.payload.userId);

        // Send session created event
        this.sendToSocket(socket, {
          type: 'session_created',
          payload: {
            sessionId: session.sessionId,
            createdAt: session.createdAt,
          },
        });

        // Process the message with the new session
        if (message) {
          await this.processMessage(socket, session.sessionId, message);
        }
      } else {
        // Validate session exists
        const existingSession = await this.widgetService.getSession(sessionId);
        if (!existingSession) {
          this.sendToSocket(socket, {
            type: 'error',
            payload: { code: 'INVALID_SESSION', message: 'Session not found or expired' },
          });
          return;
        }

        // Store session mapping if not already stored
        if (!this.sessionToSocket.has(sessionId)) {
          this.storeSessionMapping(socket, sessionId, existingSession.userId);
        }

        await this.processMessage(socket, sessionId, message);
      }
    } catch (error) {
      this.logger.error('Error handling message:', {
        socketId: socket.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      this.sendToSocket(socket, {
        type: 'error',
        payload: {
          code: 'MESSAGE_ERROR',
          message: 'Failed to process message',
        },
      });
    }
  }

  private async processMessage(
    socket: Socket,
    sessionId: string,
    message: string
  ): Promise<void> {
    // Validate message length
    const maxLength = parseInt(process.env.WIDGET_MAX_MESSAGE_LENGTH || '5000', 10);
    if (message.length > maxLength) {
      this.sendToSocket(socket, {
        type: 'error',
        payload: {
          code: 'MESSAGE_TOO_LONG',
          message: `Message exceeds maximum length of ${maxLength} characters`,
        },
      });
      return;
    }

    // Send typing indicator to client
    this.sendToSocket(socket, {
      type: 'typing',
      payload: { isTyping: true },
    });

    try {
      // Process message through widget service (which calls orchestrator)
      const response = await this.widgetService.handleMessage(sessionId, message);

      // Send response back to client
      this.sendToSocket(socket, {
        type: 'response',
        payload: {
          message: response.message,
          timestamp: response.timestamp,
          sessionId,
        },
      });

      this.logger.info('Message processed', {
        socketId: socket.id,
        sessionId,
        messageLength: message.length,
        responseLength: response.message.length,
      });
    } catch (error) {
      this.logger.error('Error processing message:', {
        socketId: socket.id,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Send error response
      this.sendToSocket(socket, {
        type: 'response',
        payload: {
          message: 'I apologize, but I encountered an error processing your request. Please try again.',
          timestamp: new Date().toISOString(),
          sessionId,
          isError: true,
        },
      });
    }
  }

  private handleTyping(socket: Socket, data: { sessionId: string; isTyping: boolean }): void {
    const { sessionId, isTyping } = data;
    const socketId = this.sessionToSocket.get(sessionId);

    if (socketId) {
      this.io.to(socketId).emit('typing', { isTyping });
    }
  }

  private async handleJoinSession(
    socket: Socket,
    data: { sessionId: string; userId?: string }
  ): Promise<void> {
    try {
      const session = await this.widgetService.getSession(data.sessionId);

      if (!session) {
        this.sendToSocket(socket, {
          type: 'error',
          payload: { code: 'INVALID_SESSION', message: 'Session not found or expired' },
        });
        return;
      }

      this.storeSessionMapping(socket, data.sessionId, data.userId || session.userId);

      this.sendToSocket(socket, {
        type: 'session_created',
        payload: {
          sessionId: session.sessionId,
          createdAt: session.createdAt,
          userId: session.userId,
        },
      });
    } catch (error) {
      this.logger.error('Error joining session:', {
        socketId: socket.id,
        sessionId: data.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private storeSessionMapping(socket: Socket, sessionId: string, userId?: string): void {
    this.clientSessions.set(socket.id, {
      socketId: socket.id,
      sessionId,
      userId,
      connectedAt: new Date(),
    });
    this.sessionToSocket.set(sessionId, socket.id);
  }

  handleDisconnect(socket: Socket): void {
    const clientSession = this.clientSessions.get(socket.id);

    if (clientSession) {
      this.sessionToSocket.delete(clientSession.sessionId);
      this.clientSessions.delete(socket.id);
    }
  }

  private sendToSocket(socket: Socket, message: OutgoingMessage): void {
    socket.emit('event', message);
  }

  async shutdown(): Promise<void> {
    // End all sessions gracefully
    const sessionIds = Array.from(this.sessionToSocket.keys());
    for (const sessionId of sessionIds) {
      this.widgetService.endSession(sessionId);
    }

    this.logger.info('Socket service shut down', {
      sessionsEnded: sessionIds.length,
    });
  }
}
