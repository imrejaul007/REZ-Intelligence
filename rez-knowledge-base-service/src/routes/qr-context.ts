/**
 * QR Context Routes
 * Provides endpoints for accessing QR-specific knowledge bases
 */

import { Router, Request, Response } from 'express';
import {
  UnifiedKnowledgeRouter,
  getAllKnowledgeBases,
  routeToKnowledgeBase,
  detectQueryContext,
  createContextFromQR,
  matchQueryIntent,
  searchKBItems,
  getQuestionResponse,
  QRContextSource,
  hotelRoomKB,
  restaurantMenuKB,
  storeMerchantKB,
  campaignAdsKB,
} from '../kb';

const router = Router();
const knowledgeRouter = UnifiedKnowledgeRouter.getInstance();

// ====== LIST ALL KNOWLEDGE BASES ======

/**
 * GET /api/qr-context/knowledge-bases
 * List all available knowledge bases
 */
router.get('/knowledge-bases', (req: Request, res: Response) => {
  try {
    const bases = getAllKnowledgeBases();
    res.json({
      success: true,
      data: {
        count: bases.length,
        knowledgeBases: bases
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to list knowledge bases' });
  }
});

// ====== HOTEL ROOM KB ======

/**
 * GET /api/qr-context/hotel-room
 * Get hotel room service knowledge base
 */
router.get('/hotel-room', (req: Request, res: Response) => {
  try {
    const { section } = req.query;

    if (section && typeof section === 'string') {
      const sectionData = (hotelRoomKB as any).categories?.[section] || (hotelRoomKB as any)?.[section];
      if (sectionData) {
        return res.json({
          success: true,
          data: {
            section,
            data: sectionData
          }
        });
      }
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    res.json({
      success: true,
      data: {
        name: 'Hotel Room Service Knowledge Base',
        source: QRContextSource.ROOM_QR,
        categories: Object.keys((hotelRoomKB as any).categories || {}),
        intents: Object.keys((hotelRoomKB as any).intents || {}),
        responses: (hotelRoomKB as any).responses || {},
        contextSlots: (hotelRoomKB as any).contextSlots || {}
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch hotel room KB' });
  }
});

// ====== RESTAURANT MENU KB ======

/**
 * GET /api/qr-context/restaurant-menu
 * Get restaurant menu knowledge base
 */
router.get('/restaurant-menu', (req: Request, res: Response) => {
  try {
    const { section } = req.query;

    if (section && typeof section === 'string') {
      const sectionData = (restaurantMenuKB as any).categories?.[section] ||
                          (restaurantMenuKB as any)?.[section];
      if (sectionData) {
        return res.json({
          success: true,
          data: {
            section,
            data: sectionData
          }
        });
      }
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    res.json({
      success: true,
      data: {
        name: 'Restaurant Menu Knowledge Base',
        source: QRContextSource.MENU_QR,
        categories: Object.keys((restaurantMenuKB as any).categories || {}),
        dietaryOptions: ((restaurantMenuKB as any).dietary?.info || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          icon: d.icon
        })),
        allergens: ((restaurantMenuKB as any).allergens?.info || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          icon: a.icon
        })),
        cuisineTypes: ((restaurantMenuKB as any).cuisineTypes?.types || []).map((c: any) => ({
          id: c.id,
          name: c.name
        })),
        spiceLevels: (restaurantMenuKB as any).spiceLevels || [],
        intents: Object.keys((restaurantMenuKB as any).intents || {}),
        responses: (restaurantMenuKB as any).responses || {},
        contextSlots: (restaurantMenuKB as any).contextSlots || {}
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch restaurant menu KB' });
  }
});

// ====== STORE MERCHANT KB ======

/**
 * GET /api/qr-context/store-merchant
 * Get store/merchant knowledge base
 */
router.get('/store-merchant', (req: Request, res: Response) => {
  try {
    const { section } = req.query;

    if (section && typeof section === 'string') {
      const sectionData = (storeMerchantKB as any).categories?.[section] ||
                          (storeMerchantKB as any)?.[section];
      if (sectionData) {
        return res.json({
          success: true,
          data: {
            section,
            data: sectionData
          }
        });
      }
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    res.json({
      success: true,
      data: {
        name: 'Store/Merchant Knowledge Base',
        source: QRContextSource.STORE_QR,
        linkTypes: ((storeMerchantKB as any).linkTypes?.types || []).map((l: any) => ({
          id: l.id,
          name: l.name,
          icon: l.icon
        })),
        storeCategories: ((storeMerchantKB as any).storeCategories?.categories || []).map((c: any) => ({
          id: c.id,
          name: c.name
        })),
        services: ((storeMerchantKB as any).services?.available || []).map((s: any) => ({
          id: s.id,
          name: s.name
        })),
        intents: Object.keys((storeMerchantKB as any).intents || {}),
        responses: (storeMerchantKB as any).responses || {},
        contextSlots: (storeMerchantKB as any).contextSlots || {}
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch store merchant KB' });
  }
});

// ====== CAMPAIGN ADS KB ======

/**
 * GET /api/qr-context/campaign-ads
 * Get campaign/ads knowledge base
 */
router.get('/campaign-ads', (req: Request, res: Response) => {
  try {
    const { section } = req.query;

    if (section && typeof section === 'string') {
      const sectionData = (campaignAdsKB as any).categories?.[section] ||
                          (campaignAdsKB as any)?.[section];
      if (sectionData) {
        return res.json({
          success: true,
          data: {
            section,
            data: sectionData
          }
        });
      }
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    res.json({
      success: true,
      data: {
        name: 'Campaign/Ads Knowledge Base',
        source: QRContextSource.ADS_QR,
        rewardTypes: ((campaignAdsKB as any).rewardTypes?.types || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          icon: r.icon,
          expiresIn: r.expiresIn
        })),
        attributionMethods: ((campaignAdsKB as any).attribution?.methods || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          icon: a.icon
        })),
        claimProcesses: Object.keys((campaignAdsKB as any).claimProcess?.processes || {}),
        campaignTypes: ((campaignAdsKB as any).campaignTypes?.types || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          icon: c.icon
        })),
        intents: Object.keys((campaignAdsKB as any).intents || {}),
        responses: (campaignAdsKB as any).responses || {},
        contextSlots: (campaignAdsKB as any).contextSlots || {}
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch campaign ads KB' });
  }
});

// ====== CONTEXT DETECTION ======

/**
 * POST /api/qr-context/detect
 * Detect context from query or QR data
 */
router.post('/detect', (req: Request, res: Response) => {
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
      return res.status(400).json({
        success: false,
        error: 'Either query or qrData is required'
      });
    }

    const kbInfo = knowledgeRouter.getKnowledgeBaseInfo(context.source);

    res.json({
      success: true,
      data: {
        detectedSource: context.source,
        sourceName: kbInfo?.name || 'Unknown',
        description: kbInfo?.description || '',
        context
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Detection failed' });
  }
});

// ====== SEARCH ======

/**
 * POST /api/qr-context/search
 * Search items across knowledge bases
 */
router.post('/search', (req: Request, res: Response) => {
  try {
    const { query, context } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const qrContext = context
      ? createContextFromQR(context)
      : { source: detectQueryContext(query), timestamp: new Date() };

    const results = searchKBItems(query, qrContext);
    const intent = matchQueryIntent(query, qrContext);
    const kbInfo = knowledgeRouter.getKnowledgeBaseInfo(qrContext.source);

    res.json({
      success: true,
      data: {
        query,
        context: qrContext,
        knowledgeBase: kbInfo?.name,
        intent,
        results,
        count: results.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

// ====== QUERY PROCESSING ======

/**
 * POST /api/qr-context/query
 * Process a natural language query against the knowledge base
 */
router.post('/query', (req: Request, res: Response) => {
  try {
    const { query, context } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const qrContext = context
      ? createContextFromQR(context)
      : { source: detectQueryContext(query), timestamp: new Date() };

    const response = getQuestionResponse(query, qrContext);
    const intent = matchQueryIntent(query, qrContext);
    const items = searchKBItems(query, qrContext);
    const kbInfo = knowledgeRouter.getKnowledgeBaseInfo(qrContext.source);

    res.json({
      success: true,
      data: {
        query,
        context: qrContext,
        knowledgeBase: kbInfo?.name,
        intent,
        response: response || null,
        relatedItems: items.slice(0, 5),
        requiresHuman: !response && items.length === 0,
        confidence: response ? 0.9 : items.length > 0 ? 0.6 : 0.1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Query processing failed' });
  }
});

// ====== QR DATA PROCESSING ======

/**
 * POST /api/qr-context/process
 * Process full QR data and return appropriate knowledge base
 */
router.post('/process', (req: Request, res: Response) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({
        success: false,
        error: 'QR data is required'
      });
    }

    const context = createContextFromQR(qrData);
    const kb = routeToKnowledgeBase('', context);
    const kbInfo = knowledgeRouter.getKnowledgeBaseInfo(context.source);

    res.json({
      success: true,
      data: {
        context,
        knowledgeBase: kbInfo?.name,
        knowledgeBaseDescription: kbInfo?.description,
        merchantId: context.merchantId,
        campaignId: context.campaignId,
        timestamp: context.timestamp,
        metadata: context.metadata
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'QR processing failed' });
  }
});

// ====== ITEM DETAILS ======

/**
 * GET /api/qr-context/:source/items
 * Get items from a specific knowledge base
 */
router.get('/:source/items', (req: Request, res: Response) => {
  try {
    const { source } = req.params;
    const { category, search } = req.query;

    // Map source to context
    let contextSource: QRContextSource;
    switch (source.toLowerCase()) {
      case 'room':
      case 'hotel-room':
      case 'room_qr':
        contextSource = QRContextSource.ROOM_QR;
        break;
      case 'menu':
      case 'restaurant':
      case 'menu_qr':
        contextSource = QRContextSource.MENU_QR;
        break;
      case 'store':
      case 'merchant':
      case 'store_qr':
        contextSource = QRContextSource.STORE_QR;
        break;
      case 'campaign':
      case 'ads':
      case 'campaign_ads':
      case 'ads_qr':
        contextSource = QRContextSource.ADS_QR;
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid source'
        });
    }

    const context = { source: contextSource, timestamp: new Date() };
    const items = searchKBItems(search as string || '', context);

    // Filter by category if specified
    let filteredItems = items;
    if (category && typeof category === 'string') {
      filteredItems = items.filter((item: any) =>
        item.category?.toLowerCase() === category.toLowerCase()
      );
    }

    res.json({
      success: true,
      data: {
        source,
        category: category || 'all',
        items: filteredItems,
        count: filteredItems.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch items' });
  }
});

export default router;
