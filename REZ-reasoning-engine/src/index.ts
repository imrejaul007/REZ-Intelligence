import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import reasoningRoutes from './routes/reasoningRoutes.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 4198;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'rez-reasoning-engine', timestamp: new Date().toISOString() });
});

app.use('/api', reasoningRoutes);

app.listen(PORT, () => {
  logger.info(`REZ Reasoning Engine running on port ${PORT}`);
});

export default app;
