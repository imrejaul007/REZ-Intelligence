import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import syntheticRoutes from './routes/syntheticRoutes.js';
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4197;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'rez-synthetic-data',
    timestamp: new Date().toISOString()
  });
});

app.use('/api', syntheticRoutes);

app.use((err, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`REZ Synthetic Data running on port ${PORT}`);
  logger.info(`Health: http://localhost:${PORT}/health`);
  logger.info(`API: http://localhost:${PORT}/api`);
});

export default app;
