import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import workflowRoutes from './routes/workflowRoutes.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 4199;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'rez-workflow-builder', timestamp: new Date().toISOString() });
});

app.use('/api', workflowRoutes);

app.listen(PORT, () => {
  logger.info(`REZ Workflow Builder running on port ${PORT}`);
});

export default app;
