import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { agentRegistry } from '../services/agentRegistry.js';
import { AgentSchema, AgentCapabilitySchema, TaskSchema, MessageSchema } from '../types/index.js';
import { logger } from './utils/logger.js';

const router = Router();

router.post('/agents', (req, res) => {
  try {
    const agent = AgentSchema.parse(req.body);
    res.json({ success: true, data: agentRegistry.registerAgent(agent) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      res.status(500).json({ success: false, error: 'Registration failed' });
    }
  }
});

router.get('/agents', (req, res) => {
  res.json({ success: true, data: agentRegistry.getAllAgents() });
});

router.get('/agents/:id', (req, res) => {
  const agent = agentRegistry.getAgent(req.params.id);
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }
  res.json({ success: true, data: agent });
});

router.delete('/agents/:id', (req, res) => {
  const deleted = agentRegistry.deregisterAgent(req.params.id);
  res.json({ success: deleted });
});

router.get('/agents/:id/messages', (req, res) => {
  res.json({ success: true, data: agentRegistry.getMessages(req.params.id) });
});

router.get('/agents/:id/tasks', (req, res) => {
  res.json({ success: true, data: agentRegistry.getTasks(req.params.id) });
});

router.post('/capabilities', (req, res) => {
  try {
    const capability = AgentCapabilitySchema.parse(req.body);
    res.json({ success: true, data: capability });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      res.status(500).json({ success: false, error: 'Failed' });
    }
  }
});

router.get('/capabilities/:name', (req, res) => {
  const results = agentRegistry.findCapability(req.params.name);
  res.json({ success: true, data: results });
});

router.get('/discover/:capability', (req, res) => {
  const results = agentRegistry.discover(req.params.capability);
  res.json({ success: true, data: results });
});

router.post('/tasks', async (req, Request, res: Response) => {
  try {
    const task = TaskSchema.parse(req.body);
    const taskId = await agentRegistry.sendTask(task);
    res.status(201).json({ success: true, data: { taskId } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      res.status(500).json({ success: false, error: 'Task failed' });
    }
  }
});

router.post('/messages', async (req, res) => {
  try {
    const message = MessageSchema.parse(req.body);
    const result = await agentRegistry.sendMessage(message);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      res.status(500).json({ success: false, error: 'Message failed' });
    }
  }
});

router.get('/stats', (req, res) => {
  res.json({ success: true, data: agentRegistry.getStats() });
});

export default router;
