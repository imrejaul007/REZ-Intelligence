import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { signalRoutes } from './routes/signals';
import { intentRoutes } from './routes/intents';
import { dormantRoutes } from './routes/dormant';
import { profileRoutes } from './routes/profiles';
import { nudgeRoutes } from './routes/nudges';
import { agentRoutes } from './routes/agents';
import { healthRoutes } from './routes/health';
import { agentService } from './services/agents';

const app = express();
const PORT = process.env.PORT || 4009;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Routes
app.use('/api/signals', signalRoutes);
app.use('/api/intents', intentRoutes);
app.use('/api/dormant', dormantRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/nudges', nudgeRoutes);
app.use('/api/agents', agentRoutes);
app.use('/health', healthRoutes);

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-intent';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Start server
async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Start all AI agents
    await agentService.startAllAgents();
    console.log('AI agents started');

    app.listen(PORT, () => {
      console.log(`Intent service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await agentService.stopAllAgents();
  await mongoose.disconnect();
  process.exit(0);
});

start();
