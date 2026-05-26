import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { embeddingEngine } from '../services/embeddingEngine.js';
import { collectionManager } from '../services/collectionManager.js';
import {
  EmbeddingRequestSchema,
  BatchEmbeddingRequestSchema,
  SearchRequestSchema,
  CollectionSchema
} from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/embed', async (req: Request, res: Response) => {
  try {
    const validated = EmbeddingRequestSchema.parse(req.body);

    let vector: number[];
    if (validated.text) {
      vector = await embeddingEngine.generateEmbedding(validated.text, validated.dimensions);
    } else {
      return res.status(400).json({ success: false, error: 'Text is required for embedding' });
    }

    res.json({
      success: true,
      data: {
        id: validated.id,
        vector,
        dimensions: vector.length
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Embed error:', error);
      res.status(500).json({ success: false, error: 'Embedding failed' });
    }
  }
});

router.post('/embed/batch', async (req: Request, res: Response) => {
  try {
    const validated = BatchEmbeddingRequestSchema.parse(req.body);
    const results: { text: string; vector: number[] }[] = [];

    for (const text of validated.texts) {
      const vector = await embeddingEngine.generateEmbedding(text, validated.dimensions);
      results.push({ text, vector });
    }

    res.json({
      success: true,
      data: {
        embeddings: results,
        count: results.length
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Batch embed error:', error);
      res.status(500).json({ success: false, error: 'Batch embedding failed' });
    }
  }
});

router.post('/embed/product', async (req: Request, res: Response) => {
  try {
    const { productId, name, description, category, brand, price } = req.body;
    const vector = await embeddingEngine.generateProductEmbedding({
      name, description, category, brand, price
    });

    res.json({
      success: true,
      data: { productId, vector, dimensions: vector.length }
    });
  } catch (error) {
    logger.error('Product embed error:', error);
    res.status(500).json({ success: false, error: 'Product embedding failed' });
  }
});

router.post('/embed/user', async (req: Request, res: Response) => {
  try {
    const { userId, preferences, behaviors, demographics } = req.body;
    const vector = await embeddingEngine.generateUserEmbedding({ preferences, behaviors, demographics });

    res.json({
      success: true,
      data: { userId, vector, dimensions: vector.length }
    });
  } catch (error) {
    logger.error('User embed error:', error);
    res.status(500).json({ success: false, error: 'User embedding failed' });
  }
});

router.post('/embed/behavior', async (req: Request, res: Response) => {
  try {
    const { action, entity, context, timestamp } = req.body;
    const vector = await embeddingEngine.generateBehaviorEmbedding({ action, entity, context, timestamp });

    res.json({
      success: true,
      data: { vector, dimensions: vector.length }
    });
  } catch (error) {
    logger.error('Behavior embed error:', error);
    res.status(500).json({ success: false, error: 'Behavior embedding failed' });
  }
});

router.post('/embed/location', async (req: Request, res: Response) => {
  try {
    const { name, type, area, city } = req.body;
    const vector = await embeddingEngine.generateLocationEmbedding({ name, type, area, city });

    res.json({
      success: true,
      data: { vector, dimensions: vector.length }
    });
  } catch (error) {
    logger.error('Location embed error:', error);
    res.status(500).json({ success: false, error: 'Location embedding failed' });
  }
});

router.post('/collections', async (req: Request, res: Response) => {
  try {
    const validated = CollectionSchema.parse(req.body);
    const collection = collectionManager.createCollection(validated);

    res.status(201).json({ success: true, data: collection });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Create collection error:', error);
      res.status(500).json({ success: false, error: 'Failed to create collection' });
    }
  }
});

router.get('/collections', async (req: Request, res: Response) => {
  try {
    const collections = collectionManager.getAllCollections();
    const stats = collectionManager.getStorageStats();

    res.json({ success: true, data: { collections, stats } });
  } catch (error) {
    logger.error('List collections error:', error);
    res.status(500).json({ success: false, error: 'Failed to list collections' });
  }
});

router.get('/collections/:name', async (req: Request, res: Response) => {
  try {
    const collection = collectionManager.getCollection(req.params.name);
    if (!collection) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }

    const stats = embeddingEngine.getCollectionStats(req.params.name);
    res.json({ success: true, data: { ...collection, ...stats } });
  } catch (error) {
    logger.error('Get collection error:', error);
    res.status(500).json({ success: false, error: 'Failed to get collection' });
  }
});

router.delete('/collections/:name', async (req: Request, res: Response) => {
  try {
    await embeddingEngine.clearCollection(req.params.name);
    const deleted = collectionManager.deleteCollection(req.params.name);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }

    res.json({ success: true, message: 'Collection deleted' });
  } catch (error) {
    logger.error('Delete collection error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete collection' });
  }
});

router.post('/index', async (req: Request, res: Response) => {
  try {
    const { collection, id, text, type, metadata, dimensions } = req.body;

    if (!collection || !id || !text || !type) {
      return res.status(400).json({ success: false, error: 'collection, id, text, type required' });
    }

    const dims = dimensions || 384;
    const vector = await embeddingEngine.generateEmbedding(text, dims);

    const doc = {
      id,
      vector,
      text,
      type,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await embeddingEngine.indexDocument(collection, doc);
    collectionManager.updateCollectionCount(collection, 1);

    res.json({ success: true, data: { id, collection, indexed: true } });
  } catch (error) {
    logger.error('Index error:', error);
    res.status(500).json({ success: false, error: 'Indexing failed' });
  }
});

router.post('/search', async (req: Request, res: Response) => {
  try {
    const validated = SearchRequestSchema.parse(req.body);
    const startTime = Date.now();

    let results;
    if (validated.query) {
      results = await embeddingEngine.semanticSearch(
        validated.collection,
        validated.query,
        validated.limit,
        validated.minScore
      );
    } else if (validated.vector) {
      results = await embeddingEngine.search(
        validated.collection,
        validated.vector,
        validated.limit,
        validated.minScore
      );
    } else {
      return res.status(400).json({ success: false, error: 'query or vector required' });
    }

    res.json({
      success: true,
      data: {
        results,
        query: validated.query,
        totalResults: results.length,
        searchTimeMs: Date.now() - startTime
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Search error:', error);
      res.status(500).json({ success: false, error: 'Search failed' });
    }
  }
});

router.get('/similar/:collection/:id', async (req: Request, res: Response) => {
  try {
    const { collection, id } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const results = await embeddingEngine.findSimilar(collection, id, limit);

    res.json({ success: true, data: { results } });
  } catch (error) {
    logger.error('Find similar error:', error);
    res.status(500).json({ success: false, error: 'Similarity search failed' });
  }
});

router.post('/cluster/:collection', async (req: Request, res: Response) => {
  try {
    const { collection } = req.params;
    const k = parseInt(req.query.k as string) || 5;

    const clusters = await embeddingEngine.computeClustering(collection, k);

    res.json({ success: true, data: { clusters, k } });
  } catch (error) {
    logger.error('Clustering error:', error);
    res.status(500).json({ success: false, error: 'Clustering failed' });
  }
});

router.delete('/document/:collection/:id', async (req: Request, res: Response) => {
  try {
    const { collection, id } = req.params;
    const deleted = await embeddingEngine.deleteDocument(collection, id);

    if (deleted) {
      collectionManager.updateCollectionCount(collection, -1);
    }

    res.json({ success: true, deleted });
  } catch (error) {
    logger.error('Delete doc error:', error);
    res.status(500).json({ success: false, error: 'Delete failed' });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = collectionManager.getStorageStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

export default router;
