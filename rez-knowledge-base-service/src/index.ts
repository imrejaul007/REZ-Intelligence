import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import merchantRoutes from './routes/merchant';
import qrContextRoutes from './routes/qr-context';
import {
  UnifiedKnowledgeRouter,
  getAllKnowledgeBases,
  routeToKnowledgeBase,
  detectQueryContext,
  createContextFromQR,
  matchQueryIntent,
  searchKBItems,
  getQuestionResponse,
  hotelRoomKB,
  restaurantMenuKB,
  storeMerchantKB,
  campaignAdsKB
} from './kb';

dotenv.config();

// Initialize the unified knowledge router
const knowledgeRouter = UnifiedKnowledgeRouter.getInstance();

const app = express();
const PORT = process.env.PORT || 4025;

// Middleware
app.use(helmet());
// CORS - restrict to known origins
const allowedOrigins = (process.env.CORS_ORIGINS || 'https://rez.money,https://admin.rez.money,https://merchant.rez.money').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('CORS blocked'));
  },
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'rez-knowledge-base-service',
    timestamp: Date.now()
  });
});

// Routes
app.use('/api/merchants', merchantRoutes);
app.use('/api/qr-context', qrContextRoutes);

// API Documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'REZ Knowledge Base Service',
    version: '2.0.0',
    description: 'Comprehensive knowledge base service with QR context routing',
    knowledgeBases: {
      hotelRoom: 'Hotel/Room Service KB',
      restaurantMenu: 'Restaurant Menu KB',
      storeMerchant: 'Store/Merchant KB',
      campaignAds: 'Campaign/Ads KB'
    },
    endpoints: {
      health: 'GET /health',
      merchants: {
        list: 'GET /api/merchants',
        create: 'POST /api/merchants',
        get: 'GET /api/merchants/:merchantId',
        update: 'PUT /api/merchants/:merchantId',
        delete: 'DELETE /api/merchants/:merchantId'
      },
      menu: {
        add: 'POST /api/merchants/:merchantId/menu',
        update: 'PUT /api/merchants/:merchantId/menu/:itemId',
        delete: 'DELETE /api/merchants/:merchantId/menu/:itemId'
      },
      faq: {
        list: 'GET /api/merchants/:merchantId/faq',
        add: 'POST /api/merchants/:merchantId/faq',
        update: 'PUT /api/merchants/:merchantId/faq/:faqId',
        delete: 'DELETE /api/merchants/:merchantId/faq/:faqId'
      },
      search: 'GET /api/merchants/:merchantId/search?q=query',
      import: 'POST /api/merchants/:merchantId/import',
      export: 'GET /api/merchants/:merchantId/export',
      qrContext: {
        list: 'GET /api/qr-context/knowledge-bases',
        detect: 'POST /api/qr-context/detect',
        search: 'POST /api/qr-context/search',
        query: 'POST /api/qr-context/query',
        hotelRoom: 'GET /api/qr-context/hotel-room',
        restaurantMenu: 'GET /api/qr-context/restaurant-menu',
        storeMerchant: 'GET /api/qr-context/store-merchant',
        campaignAds: 'GET /api/qr-context/campaign-ads'
      },
      salesStrategies: {
        list: 'GET /api/merchants/:merchantId/sales-strategies',
        recommendations: 'GET /api/merchants/:merchantId/sales-recommendations'
      },
      policies: {
        get: 'GET /api/merchants/:merchantId/policies',
        update: 'PUT /api/merchants/:merchantId/policies',
        byType: 'GET /api/merchants/policies/by-type'
      }
    }
  });
});

// QR Context specific endpoints (direct knowledge base access)
app.get('/api/qr-context/knowledge-bases', (req, res) => {
  const bases = getAllKnowledgeBases();
  res.json({
    success: true,
    data: bases
  });
});

app.post('/api/qr-context/detect', (req, res) => {
  try {
    const { query, qrData } = req.body;

    let context;
    if (qrData) {
      context = createContextFromQR(qrData);
    } else if (query) {
      const source = detectQueryContext(query);
      context = {
        source,
        timestamp: new Date()
      };
    } else {
      return res.status(400).json({ success: false, error: 'Query or QR data required' });
    }

    const kb = routeToKnowledgeBase(query || '', context);

    res.json({
      success: true,
      data: {
        detectedSource: context.source,
        context,
        knowledgeBaseName: knowledgeRouter.getKnowledgeBaseInfo(context.source)?.name
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Detection failed' });
  }
});

app.post('/api/qr-context/search', (req, res) => {
  try {
    const { query, context } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query required' });
    }

    const qrContext = context
      ? createContextFromQR(context)
      : { source: detectQueryContext(query), timestamp: new Date() };

    const results = searchKBItems(query, qrContext);
    const intent = matchQueryIntent(query, qrContext);

    res.json({
      success: true,
      data: {
        query,
        context: qrContext,
        intent,
        results,
        count: results.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

app.post('/api/qr-context/query', (req, res) => {
  try {
    const { query, context } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query required' });
    }

    const qrContext = context
      ? createContextFromQR(context)
      : { source: detectQueryContext(query), timestamp: new Date() };

    const response = getQuestionResponse(query, qrContext);
    const intent = matchQueryIntent(query, qrContext);
    const items = searchKBItems(query, qrContext);

    res.json({
      success: true,
      data: {
        query,
        context: qrContext,
        intent,
        response: response || 'I am not sure I understand. Could you please rephrase your question?',
        relatedItems: items.slice(0, 5),
        requiresHuman: !response && items.length === 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Query processing failed' });
  }
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-knowledge-base';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`REZ Knowledge Base Service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

export default app;
