import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import agentRoutes from './routes/agentRoutes.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 4201;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'rez-agent-protocol', timestamp: new Date().toISOString() });
});

app.use('/api', agentRoutes);

app.listen(PORT, () => {
  logger.info(`REZ Agent Protocol running on port ${PORT}`);
});

export default app;
