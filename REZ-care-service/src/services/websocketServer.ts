/**
 * REZ Care Service - WebSocket Server
 *
 * Real-time updates for the Command Center dashboard.
 * Pushes alerts, tickets, and metrics to connected clients.
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';

interface ClientRoom {
  socketId: string;
  rooms: string[];
  userId?: string;
  subscribedTo: string[];
}

class WebSocketServer {
  private io: Server;
  private clients: Map<string, ClientRoom> = new Map();
  private alertSubscribers: Map<string, Set<string>> = new Map(); // alertId -> socketIds
  private ticketSubscribers: Map<string, Set<string>> = new Map(); // ticketId -> socketIds

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    logger.info('WebSocket Server initialized');
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: Socket) {
    const clientRoom: ClientRoom = {
      socketId: socket.id,
      rooms: [],
      subscribedTo: [],
    };
    this.clients.set(socket.id, clientRoom);

    logger.info('Client connected', { socketId: socket.id });

    // Join default rooms
    socket.join('alerts');
    socket.join('tickets');
    socket.join('metrics');
    clientRoom.rooms.push('alerts', 'tickets', 'metrics');

    // Handle room subscriptions
    socket.on('subscribe', (data: { room: string; id?: string }) => {
      socket.join(data.room);
      if (!clientRoom.rooms.includes(data.room)) {
        clientRoom.rooms.push(data.room);
      }

      // Track specific subscriptions
      if (data.id) {
        if (data.room === 'alerts' || data.room === 'alert') {
          if (!this.alertSubscribers.has(data.id)) {
            this.alertSubscribers.set(data.id, new Set());
          }
          this.alertSubscribers.get(data.id)!.add(socket.id);
          clientRoom.subscribedTo.push(`alert:${data.id}`);
        }
        if (data.room === 'ticket') {
          if (!this.ticketSubscribers.has(data.id)) {
            this.ticketSubscribers.set(data.id, new Set());
          }
          this.ticketSubscribers.get(data.id)!.add(socket.id);
          clientRoom.subscribedTo.push(`ticket:${data.id}`);
        }
      }

      logger.info('Client subscribed', { socketId: socket.id, room: data.room, id: data.id });
    });

    socket.on('unsubscribe', (data: { room: string; id?: string }) => {
      socket.leave(data.room);
      clientRoom.rooms = clientRoom.rooms.filter((r) => r !== data.room);

      if (data.id) {
        if (data.room === 'alerts' || data.room === 'alert') {
          this.alertSubscribers.get(data.id)?.delete(socket.id);
          clientRoom.subscribedTo = clientRoom.subscribedTo.filter((s) => s !== `alert:${data.id}`);
        }
        if (data.room === 'ticket') {
          this.ticketSubscribers.get(data.id)?.delete(socket.id);
          clientRoom.subscribedTo = clientRoom.subscribedTo.filter((s) => s !== `ticket:${data.id}`);
        }
      }

      logger.info('Client unsubscribed', { socketId: socket.id, room: data.room, id: data.id });
    });

    // Agent identification
    socket.on('identify', (data: { userId: string; name: string; role: string }) => {
      clientRoom.userId = data.userId;
      socket.join(`agent:${data.userId}`);
      logger.info('Agent identified', { socketId: socket.id, userId: data.userId, role: data.role });
    });

    // Ping/pong for heartbeat
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      // Clean up subscriptions
      for (const sub of clientRoom.subscribedTo) {
        const [type, id] = sub.split(':');
        if (type === 'alert') {
          this.alertSubscribers.get(id)?.delete(socket.id);
        } else if (type === 'ticket') {
          this.ticketSubscribers.get(id)?.delete(socket.id);
        }
      }
      this.clients.delete(socket.id);
      logger.info('Client disconnected', { socketId: socket.id, userId: clientRoom.userId });
    });
  }

  // ============================================
  // EMIT METHODS
  // ============================================

  /**
   * Emit new alert to all subscribers
   */
  emitAlert(alert: {
    _id: string;
    type: string;
    severity: string;
    description: string;
    affectedUsers?: string[];
  }) {
    // Emit to general alerts room
    this.io.to('alerts').emit('alert:new', alert);

    // Emit to specific alert subscribers
    const subscribers = this.alertSubscribers.get(alert._id);
    if (subscribers) {
      for (const socketId of subscribers) {
        this.io.to(socketId).emit('alert:update', alert);
      }
    }

    // P1 alerts to critical channel
    if (alert.severity === 'P1') {
      this.io.to('critical').emit('alert:critical', alert);
    }

    logger.info('Alert emitted', { alertId: alert._id, type: alert.type });
  }

  /**
   * Emit alert update
   */
  emitAlertUpdate(alert: {
    _id: string;
    status: string;
    resolution?: string;
  }) {
    this.io.to('alerts').emit('alert:update', alert);

    const subscribers = this.alertSubscribers.get(alert._id);
    if (subscribers) {
      for (const socketId of subscribers) {
        this.io.to(socketId).emit('alert:resolved', alert);
      }
    }
  }

  /**
   * Emit new auto-ticket
   */
  emitTicket(ticket: {
    _id: string;
    ticketId: string;
    type: string;
    severity: string;
    description: string;
    customerId?: string;
    merchantId?: string;
  }) {
    this.io.to('tickets').emit('ticket:new', ticket);

    // Emit to assigned agent
    if ((ticket as unknown as { assignedTo?: string }).assignedTo) {
      this.io.to(`agent:${(ticket as unknown as { assignedTo: string }).assignedTo}`).emit('ticket:assigned', ticket);
    }

    // P1 tickets to critical
    if (ticket.severity === 'P1') {
      this.io.to('critical').emit('ticket:critical', ticket);
    }

    logger.info('Ticket emitted', { ticketId: ticket.ticketId, type: ticket.type });
  }

  /**
   * Emit ticket update
   */
  emitTicketUpdate(ticket: {
    _id: string;
    ticketId: string;
    status: string;
    message?: string;
  }) {
    this.io.to('tickets').emit('ticket:update', ticket);

    const subscribers = this.ticketSubscribers.get(ticket._id);
    if (subscribers) {
      for (const socketId of subscribers) {
        this.io.to(socketId).emit('ticket:message', ticket);
      }
    }
  }

  /**
   * Emit metrics update
   */
  emitMetrics(metrics: {
    totalTickets: number;
    openTickets: number;
    resolvedToday: number;
    csatScore: number;
    sloCompliance: number;
    activeAlerts: number;
    autoTickets: number;
  }) {
    this.io.to('metrics').emit('metrics:update', metrics);
  }

  /**
   * Emit customer event
   */
  emitCustomerEvent(customerId: string, event: {
    type: string;
    data;
    timestamp: Date;
  }) {
    this.io.to(`customer:${customerId}`).emit('customer:event', event);
  }

  /**
   * Emit to specific agent
   */
  emitToAgent(agentId: string, event: string, data) {
    this.io.to(`agent:${agentId}`).emit(event, data);
  }

  /**
   * Emit to all connected clients
   */
  broadcast(event: string, data) {
    this.io.emit(event, data);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get agent count
   */
  getAgentCount(): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.userId) count++;
    }
    return count;
  }

  /**
   * Get rooms info
   */
  getRoomsInfo(): { name: string; count: number }[] {
    const rooms = new Map<string, number>();

    for (const socketId of this.clients.keys()) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        for (const room of socket.rooms) {
          if (room !== socketId) {
            rooms.set(room, (rooms.get(room) || 0) + 1);
          }
        }
      }
    }

    return Array.from(rooms.entries()).map(([name, count]) => ({ name, count }));
  }
}

// Singleton instance
let wsServer: WebSocketServer | null = null;

export function initWebSocketServer(httpServer: HttpServer): WebSocketServer {
  wsServer = new WebSocketServer(httpServer);
  return wsServer;
}

export function getWebSocketServer(): WebSocketServer | null {
  return wsServer;
}

export { WebSocketServer };
