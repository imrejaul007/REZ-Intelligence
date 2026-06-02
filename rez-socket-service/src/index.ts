import { Server } from 'socket.io';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';

// SECURITY FIX: Validate CORS origin - never allow wildcard in production
function getAllowedOrigins(): string | string[] {
  const origins = process.env.CORS_ORIGIN;
  if (!origins) {
    throw new Error('CORS_ORIGIN environment variable is required');
  }
  const originList = origins.split(',').map(o => o.trim());
  // Block wildcard in production
  if (originList.includes('*') && process.env.NODE_ENV === 'production') {
    throw new Error('Wildcard CORS origin is not allowed in production');
  }
  return originList;
}

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
  },
});

// SECURITY FIX: JWT Authentication middleware for WebSocket connections
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET_VALUE = JWT_SECRET;

interface AuthenticatedSocket {
  id: string;
  userId?: string;
  role?: string;
  data: {
    user: { id: string; role: string };
  };
}

function authenticateSocket(token: string): { userId: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET_VALUE) as { userId?: string; sub?: string; role?: string };
    return {
      userId: decoded.userId || decoded.sub || '',
      role: decoded.role || 'user',
    };
  } catch {
    return null;
  }
}

import { setupKitchenEvents } from './events/kitchen';
import { setupStaffEvents } from './events/staff';
import { setupGroupEvents } from './events/group-ordering';
import { setupLoyaltyEvents } from './events/loyalty';

// Initialize all event handlers
setupKitchenEvents(io);
setupStaffEvents(io);
setupGroupEvents(io);
setupLoyaltyEvents(io);

io.use((socket, next) => {
  // SECURITY FIX: Require authentication on all connections
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return next(new Error('Authentication required'));
  }

  const auth = authenticateSocket(token);
  if (!auth) {
    return next(new Error('Invalid or expired token'));
  }

  // Attach user info to socket for use in event handlers
  (socket as AuthenticatedSocket).userId = auth.userId;
  (socket as AuthenticatedSocket).role = auth.role;
  (socket as AuthenticatedSocket).data = {
    user: { id: auth.userId, role: auth.role },
  };

  next();
});

io.on('connection', (socket) => {
  const authSocket = socket as AuthenticatedSocket;
  console.log(`Client connected: ${socket.id}, User: ${authSocket.userId}`);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}, User: ${authSocket.userId}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
