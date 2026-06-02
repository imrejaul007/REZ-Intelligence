/**
 * REZ Live Action Feed - Main Entry Point
 * Port: 4802
 */
import 'dotenv/config';
import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { createLogger } from './utils/logger.js';
import { tenantMiddleware } from './middleware/tenant.js';
import feedRoutes from './routes/feedRoutes.js';
import { getFeedService } from './services/feedService.js';

const SERVICE = 'REZ-live-action-feed';
const PORT = parseInt(process.env.PORT || '4802', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-live-feed';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const logger = createLogger(SERVICE);

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new SocketServer(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: true },
  transports: ['websocket', 'polling'],
});

// Connect feed service to Socket.IO
getFeedService().setSocketIO(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  const tenantId = socket.handshake.headers['x-tenant-id'] as string;
  const entityId = socket.handshake.headers['x-entity-id'] as string;

  if (tenantId) {
    socket.join(`tenant:${tenantId}`);
    logger.info('socket_joined', { tenantId, socketId: socket.id });
  }
  if (entityId) {
    socket.join(`entity:${entityId}`);
  }

  socket.on('subscribe', (data: { tenantId: string; entityId?: string }) => {
    socket.join(`tenant:${data.tenantId}`);
    if (data.entityId) socket.join(`entity:${data.entityId}`);
    logger.info('socket_subscribe', { tenantId: data.tenantId, entityId: data.entityId });
  });

  socket.on('unsubscribe', (data: { tenantId: string; entityId?: string }) => {
    socket.leave(`tenant:${data.tenantId}`);
    if (data.entityId) socket.leave(`entity:${data.entityId}`);
  });

  socket.on('disconnect', () => logger.info('socket_disconnected', { socketId: socket.id }));
});

app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } } }));
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(rateLimit({ windowMs: 60000, max: 100, message: { success: false, error: { code: 'RATE_LIMIT' } } }));
app.use(express.json({ limit: '10mb' }));
app.use(compression());
app.use(tenantMiddleware());
app.use('/api/feed', feedRoutes);

app.get('/health', (_req: Request, res: Response) => res.json({ status: 'healthy', service: SERVICE }));
app.get('/health/live', (_req: Request, res: Response) => res.json({ status: 'ok' }));
app.get('/health/ready', async (_req: Request, res: Response) => {
  const mongoState = mongoose.connection.readyState;
  res.json({ status: mongoState === 1 ? 'ready' : 'not_ready' });
});

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('mongodb_connected');
    httpServer.listen(PORT, () => console.log(`\n  REZ Live Action Feed running on port ${PORT}\n  Socket.IO: ACTIVE\n  "AI That Runs Your Company While You Sleep"\n`));
  } catch (error) { logger.error('start_failed', { error }); process.exit(1); }
}
process.on('SIGTERM', async () => { httpServer.close(); await mongoose.connection.close(); process.exit(0); });
start();
export default app;
