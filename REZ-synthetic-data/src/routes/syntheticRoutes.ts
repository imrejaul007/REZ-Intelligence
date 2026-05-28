import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { dataGenerator } from '../services/dataGenerator.js';
import { DatasetSchema, AnonymizeRequestSchema, SyntheticDataRequestSchema } from '../types/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const validated = SyntheticDataRequestSchema.parse(req.body);
    const result = await dataGenerator.generate(validated);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Generate error:', error);
      res.status(500).json({ success: false, error: 'Generation failed' });
    }
  }
});

router.post('/generate/users', async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 100;
    const data = dataGenerator.generateUserDataset(count);

    res.json({
      success: true,
      data: {
        datasetId: data.length > 0 ? (data[0] as { id: string }).id : 'unknown',
        recordCount: data.length,
        generatedAt: new Date(),
        data
      }
    });
  } catch (error) {
    logger.error('Generate users error:', error);
    res.status(500).json({ success: false, error: 'Generation failed' });
  }
});

router.post('/generate/products', async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 100;
    const data = dataGenerator.generateProductDataset(count);

    res.json({
      success: true,
      data: {
        recordCount: data.length,
        generatedAt: new Date(),
        data
      }
    });
  } catch (error) {
    logger.error('Generate products error:', error);
    res.status(500).json({ success: false, error: 'Generation failed' });
  }
});

router.post('/generate/orders', async (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 100;
    const data = dataGenerator.generateOrderDataset(count);

    res.json({
      success: true,
      data: {
        recordCount: data.length,
        generatedAt: new Date(),
        data
      }
    });
  } catch (error) {
    logger.error('Generate orders error:', error);
    res.status(500).json({ success: false, error: 'Generation failed' });
  }
});

router.post('/anonymize', async (req: Request, res: Response) => {
  try {
    const validated = AnonymizeRequestSchema.parse(req.body);
    const anonymized = await dataGenerator.anonymizeData(
      validated.data,
      validated.fieldsToAnonymize,
      validated.preserveFormat
    );

    res.json({
      success: true,
      data: {
        originalCount: validated.data.length,
        anonymizedCount: anonymized.length,
        anonymizedFields: validated.fieldsToAnonymize,
        data: anonymized
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Anonymize error:', error);
      res.status(500).json({ success: false, error: 'Anonymization failed' });
    }
  }
});

router.post('/quality-report', async (req: Request, res: Response) => {
  try {
    const { data, schema } = req.body;
    if (!data || !schema) {
      return res.status(400).json({ success: false, error: 'data and schema required' });
    }

    const report = await dataGenerator.generateQualityReport(data, schema);

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Quality report error:', error);
    res.status(500).json({ success: false, error: 'Quality report failed' });
  }
});

router.get('/templates', (req, res) => {
  const templates = [
    {
      id: 'user_profile',
      name: 'User Profile',
      description: 'Synthetic user profiles with PII',
      schema: [
        { name: 'id', type: 'uuid' },
        { name: 'email', type: 'email' },
        { name: 'name', type: 'name' },
        { name: 'phone', type: 'phone' },
        { name: 'address', type: 'address' },
        { name: 'age', type: 'number', min: 18, max: 80 },
        { name: 'isActive', type: 'boolean' }
      ]
    },
    {
      id: 'product_catalog',
      name: 'Product Catalog',
      description: 'Product inventory data',
      schema: [
        { name: 'id', type: 'uuid' },
        { name: 'sku', type: 'string', pattern: 'SKU[0-9]{6}' },
        { name: 'name', type: 'string', minLength: 5, maxLength: 100 },
        { name: 'category', type: 'enum', enum: ['Electronics', 'Clothing', 'Food', 'Home'] },
        { name: 'price', type: 'number', min: 10, max: 10000 },
        { name: 'stock', type: 'number', min: 0, max: 1000 }
      ]
    },
    {
      id: 'transaction',
      name: 'Transaction',
      description: 'Financial transactions',
      schema: [
        { name: 'id', type: 'uuid' },
        { name: 'orderId', type: 'string' },
        { name: 'amount', type: 'number', min: 1, max: 100000 },
        { name: 'status', type: 'enum', enum: ['pending', 'completed', 'failed', 'refunded'] },
        { name: 'paymentMethod', type: 'enum', enum: ['UPI', 'Card', 'Wallet', 'COD'] },
        { name: 'createdAt', type: 'date' }
      ]
    },
    {
      id: 'merchant',
      name: 'Merchant',
      description: 'Merchant/business profiles',
      schema: [
        { name: 'id', type: 'uuid' },
        { name: 'businessName', type: 'string', minLength: 3, maxLength: 100 },
        { name: 'category', type: 'enum', enum: ['Restaurant', 'Retail', 'Salon', 'Hotel', 'Gym'] },
        { name: 'address', type: 'address' },
        { name: 'phone', type: 'phone' },
        { name: 'rating', type: 'number', min: 1, max: 5 },
        { name: 'isVerified', type: 'boolean' }
      ]
    }
  ];

  res.json({ success: true, data: templates });
});

router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { requests } = req.body;
    if (!Array.isArray(requests)) {
      return res.status(400).json({ success: false, error: 'requests must be an array' });
    }

    const results = await Promise.all(
      requests.map(async (r) => {
        const validated = SyntheticDataRequestSchema.parse(r);
        return dataGenerator.generate(validated);
      })
    );

    res.json({
      success: true,
      data: {
        generated: results.length,
        datasets: results
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Batch generate error:', error);
      res.status(500).json({ success: false, error: 'Batch generation failed' });
    }
  }
});

export default router;
