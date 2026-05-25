import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ontologyEngine } from '../services/ontologyCore.js';
import { ClassSchema, EntitySchema, RelationSchema, OntologyQuerySchema } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/classes', (req, res) => {
  try {
    const klass = ClassSchema.parse(req.body);
    res.json({ success: true, data: ontologyEngine.createClass(klass) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      res.status(500).json({ success: false, error: 'Failed to create class' });
    }
  }
});

router.post('/entities', (req, res) => {
  try {
    const entity = EntitySchema.parse(req.body);
    res.json({ success: true, data: ontologyEngine.createEntity(entity) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      res.status(500).json({ success: false, error: 'Failed to create entity' });
    }
  }
});

router.post('/relations', (req, res) => {
  try {
    const relation = RelationSchema.parse(req.body);
    res.json({ success: true, data: ontologyEngine.createRelation(relation) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      res.status(500).json({ success: false, error: 'Failed to create relation' });
    }
  }
});

router.get('/query', (req, res) => {
  try {
    const { entity, query, depth } = req.query;
    const result = ontologyEngine.query({ entity: entity as string, query: query as string, depth: Number(depth) || 3 });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Query error:', error);
    res.status(500).json({ success: false, error: 'Query failed' });
  }
});

router.get('/ancestors/:classId', (req, res) => {
  const ancestors = ontologyEngine.getAncestors(req.params.classId);
  res.json({ success: true, data: ancestors });
});

router.get('/descendants/:classId', (req, res) => {
  const descendants = ontologyEngine.getDescendants(req.params.classId);
  res.json({ success: true, data: descendants });
});

router.post('/reason', (req, res) => {
  const { goal } = req.body;
  const result = ontologyEngine.reason(goal);
  res.json({ success: true, data: result });
});

router.get('/export', (req, res) => {
  res.json({ success: true, data: ontologyEngine.export() });
});

router.post('/align', (req, res) => {
  ontologyEngine.align(req.body);
  res.json({ success: true, message: 'Ontology aligned' });
});

export default router;
