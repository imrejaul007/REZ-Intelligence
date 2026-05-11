/**
 * ReZ A/B Testing Service
 * Experimentation and feature flag management
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://rez.money'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Types
interface Experiment {
  id: string;
  name: string;
  description: string;
  variants: Variant[];
  targetingRules: TargetingRule[];
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Variant {
  id: string;
  name: string;
  description: string;
  weight: number;
  isControl: boolean;
}

interface TargetingRule {
  field: string;
  operator: 'equals' | 'contains' | 'in' | 'not';
  value: string | string[];
}

interface ExperimentAssignment {
  experimentId: string;
  userId: string;
  variantId: string;
  assignedAt: Date;
}

// In-memory storage (replace with MongoDB in production)
const experiments: Map<string, Experiment> = new Map();
const assignments: Map<string, ExperimentAssignment> = new Map();

// Routes

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'ab-testing-service',
    timestamp: new Date().toISOString(),
    version: '1.0'
  });
});

// List all experiments
app.get('/api/experiments', (req: Request, res: Response) => {
  const experimentList = Array.from(experiments.values());
  res.json({ success: true, data: experimentList });
});

// Get experiment by ID
app.get('/api/experiments/:id', (req: Request, res: Response) => {
  const experiment = experiments.get(req.params.id);
  if (!experiment) {
    return res.status(404).json({ success: false, error: 'Experiment not found' });
  }
  res.json({ success: true, data: experiment });
});

// Create experiment
app.post('/api/experiments', (req: Request, res: Response) => {
  const { name, description, variants, targetingRules } = req.body;

  if (!name || !variants || variants.length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Name and at least 2 variants are required'
    });
  }

  const experiment: Experiment = {
    id: uuidv4(),
    name,
    description: description || '',
    variants,
    targetingRules: targetingRules || [],
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  experiments.set(experiment.id, experiment);
  res.status(201).json({ success: true, data: experiment });
});

// Update experiment
app.put('/api/experiments/:id', (req: Request, res: Response) => {
  const experiment = experiments.get(req.params.id);
  if (!experiment) {
    return res.status(404).json({ success: false, error: 'Experiment not found' });
  }

  const updated = { ...experiment, ...req.body, updatedAt: new Date() };
  experiments.set(req.params.id, updated);
  res.json({ success: true, data: updated });
});

// Delete experiment
app.delete('/api/experiments/:id', (req: Request, res: Response) => {
  const deleted = experiments.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Experiment not found' });
  }
  res.json({ success: true, message: 'Experiment deleted' });
});

// Get variant assignment for user
app.get('/api/experiments/:id/assign', (req: Request, res: Response) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  const experiment = experiments.get(req.params.id);
  if (!experiment) {
    return res.status(404).json({ success: false, error: 'Experiment not found' });
  }

  if (experiment.status !== 'active') {
    return res.status(400).json({ success: false, error: 'Experiment is not active' });
  }

  // Check for existing assignment
  const assignmentKey = `${experiment.id}:${userId}`;
  const existingAssignment = assignments.get(assignmentKey);
  if (existingAssignment) {
    return res.json({ success: true, data: existingAssignment });
  }

  // Simple deterministic assignment based on user ID hash
  const userHash = Array.from(userId as string).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variantIndex = userHash % experiment.variants.length;
  const variant = experiment.variants[variantIndex];

  const assignment: ExperimentAssignment = {
    experimentId: experiment.id,
    userId: userId as string,
    variantId: variant.id,
    assignedAt: new Date()
  };

  assignments.set(assignmentKey, assignment);
  res.json({ success: true, data: assignment });
});

// Get experiment results
app.get('/api/experiments/:id/results', (req: Request, res: Response) => {
  const experiment = experiments.get(req.params.id);
  if (!experiment) {
    return res.status(404).json({ success: false, error: 'Experiment not found' });
  }

  const experimentAssignments = Array.from(assignments.values())
    .filter(a => a.experimentId === experiment.id);

  const variantCounts: Record<string, number> = {};
  experiment.variants.forEach(v => {
    variantCounts[v.id] = 0;
  });

  experimentAssignments.forEach(a => {
    if (variantCounts[a.variantId] !== undefined) {
      variantCounts[a.variantId]++;
    }
  });

  res.json({
    success: true,
    data: {
      experimentId: experiment.id,
      totalAssignments: experimentAssignments.length,
      variantDistribution: variantCounts,
      variants: experiment.variants
    }
  });
});

// Error handling
app.use((err: Error, req: Request, res: Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Database connection (optional - service can run without it)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_ab_testing';

const startServer = () => {
  const PORT = process.env.PORT || 4002;

  if (process.env.MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
      .then(() => console.log('Connected to MongoDB'))
      .catch((err) => console.warn('MongoDB connection failed, using in-memory storage:', err.message));
  }

  app.listen(PORT, () => {
    console.log(`A/B Testing service running on port ${PORT}`);
  });
};

startServer();

export default app;
