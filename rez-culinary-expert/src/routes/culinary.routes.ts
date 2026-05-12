/**
 * Culinary Routes
 * Express routes for the culinary expert agent
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Anthropic } from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';
import {
  CulinaryIntent,
  classifyIntent,
  ViewMenuSchema,
  BrowseCategorySchema,
  SearchItemsSchema,
  GetItemDetailsSchema,
  GetRecommendationSchema,
  GetPairingSchema,
  AddToOrderSchema,
  SetDietaryRestrictionSchema,
  CheckAllergensSchema,
  UpdateAllergyProfileSchema,
  PlaceOrderSchema,
} from '../intents/culinaryIntents.js';
import { getMenuService, MenuItem } from '../services/menuService.js';
import { getDietaryService } from '../services/dietaryService.js';
import { getRecommendationsService } from '../services/recommendations.js';
import { getOrderFlowHandler } from '../intents/orderFlow.js';
import { getCulinaryExpertiseService } from '../services/expertise.js';
import {
  formatMenuItemText,
  formatRecommendationResponse,
  formatDietaryCheckResponse,
  formatPairingResponse,
  formatAllergenWarning,
  formatOrderConfirmation,
  formatMenuBrowseResponse,
  formatIngredientsResponse,
  formatNutritionResponse,
  formatHelpResponse,
  formatErrorResponse,
  formatCuisineInfoResponse,
} from '../responses/templates.js';
import { TonePreset, TONE_PRESETS } from '../config/tone.js';
import { CULINARY_EXPERT_SYSTEM_PROMPT } from '../config/systemPrompt.js';

const router = Router();

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface ChatRequest {
  message: string;
  userId: string;
  restaurantId?: string;
  sessionId?: string;
  tone?: TonePreset;
  context?: Record<string, unknown>;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

function validateRequest<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.errors,
      } as ApiResponse);
    }
    req.body = result.data;
    next();
  };
}

// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ============================================================================
// AI CHAT ENDPOINT
// ============================================================================

/**
 * POST /api/culinary/chat
 * Main chat endpoint for culinary expert interactions
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, userId, restaurantId, tone = 'default', context = {} } = req.body as ChatRequest;

    if (!message || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: message, userId',
      } as ApiResponse);
    }

    // Classify intent
    const classified = classifyIntent(message, context);
    logger.info(`Intent classified: ${classified.intent} (${classified.confidence})`);

    const menuService = getMenuService();
    const dietaryService = getDietaryService();
    const recommendationsService = getRecommendationsService();
    const orderFlowHandler = getOrderFlowHandler();
    const expertiseService = getCulinaryExpertiseService();

    let response = '';
    let intentData: Record<string, unknown> = {};

    // Handle intents
    switch (classified.intent) {
      case CulinaryIntent.GREETING:
        response = "Hello! I'm your culinary expert. I can help you explore our menu, find perfect recommendations, check dietary information, and assist with your order. What would you like today?";
        break;

      case CulinaryIntent.VIEW_MENU:
        if (restaurantId) {
          const menu = await menuService.getRestaurantMenu(restaurantId);
          if (menu) {
            const categoryData = menu.categories.map(cat => ({
              name: cat.name,
              itemCount: cat.items.length,
              items: cat.items,
            }));
            response = formatMenuBrowseResponse(categoryData, tone);
          } else {
            response = "I couldn't find the menu for this restaurant. Please check the restaurant ID.";
          }
        } else {
          response = "I need to know which restaurant you're at to show you the menu. Could you provide the restaurant ID?";
        }
        break;

      case CulinaryIntent.SEARCH_ITEMS:
        if (restaurantId) {
          const searchResults = await menuService.searchMenuItems(restaurantId, {
            searchQuery: message,
          });
          if (searchResults.items.length > 0) {
            response = `Found ${searchResults.totalCount} items matching "${message}":\n\n`;
            response += searchResults.items.slice(0, 5).map(item =>
              formatMenuItemText(item, tone)
            ).join('\n\n');
          } else {
            response = `I couldn't find any items matching "${message}". Try searching for a specific dish or ingredient!`;
          }
        } else {
          response = "I need a restaurant ID to search the menu. Which restaurant are you at?";
        }
        break;

      case CulinaryIntent.GET_RECOMMENDATION:
        if (restaurantId) {
          const menu = await menuService.getRestaurantMenu(restaurantId);
          if (menu) {
            const allItems = menu.categories.flatMap(cat => cat.items);
            const recommendations = await recommendationsService.getPersonalizedRecommendations(
              userId,
              allItems,
              {
                ...classified.entities,
                ...context,
              } as Parameters<typeof recommendationsService.getPersonalizedRecommendations>[2]
            );
            response = formatRecommendationResponse(recommendations, tone);
          } else {
            response = "I couldn't access the menu. Please try again.";
          }
        } else {
          response = "Which restaurant would you like recommendations from?";
        }
        break;

      case CulinaryIntent.GET_PAIRING:
        if (restaurantId && classified.entities.itemId) {
          const item = await menuService.getMenuItem(restaurantId, classified.entities.itemId as string);
          if (item) {
            const pairings = recommendationsService.getPairingSuggestions(item);
            response = formatPairingResponse(
              item.name,
              pairings,
              (classified.entities.pairingType as 'wine' | 'beer' | 'cocktail' | 'non-alcoholic') || 'wine'
            );
          } else {
            response = "I couldn't find that item. Could you be more specific?";
          }
        } else {
          response = "Which dish would you like pairing suggestions for?";
        }
        break;

      case CulinaryIntent.SET_DIETARY_RESTRICTION:
      case CulinaryIntent.CHECK_ALLERGENS:
        if (classified.entities.restrictions) {
          const restrictions = classified.entities.restrictions as string[];
          for (const restriction of restrictions) {
            await dietaryService.addRestriction(userId, restriction as Parameters<typeof dietaryService.addRestriction>[1]);
          }
          response = `I've noted your dietary requirements: ${restrictions.join(', ')}. I'll keep these in mind for all recommendations and will flag any dishes that may not be suitable.`;
        } else if (classified.entities.isAllergy && classified.entities.allergens) {
          const allergens = classified.entities.allergens as string[];
          for (const allergen of allergens) {
            await dietaryService.addAllergy(userId, allergen.toLowerCase().replace('-', '_') as Parameters<typeof dietaryService.addAllergy>[1]);
          }
          response = formatAllergenWarning(allergens.map(a => ({
            id: a.toLowerCase(),
            name: a,
            severity: 'severe' as const,
          })));
          response += "\n\nYour allergy information has been saved. I'll flag any dishes containing these allergens.";
        } else {
          response = "I want to make sure I understand your dietary needs correctly. Could you tell me about any allergies or dietary restrictions?";
        }
        break;

      case CulinaryIntent.GET_NUTRITION:
      case CulinaryIntent.GET_INGREDIENTS:
        if (restaurantId && classified.entities.itemId) {
          const item = await menuService.getMenuItem(restaurantId, classified.entities.itemId as string);
          if (item) {
            if (classified.intent === CulinaryIntent.GET_NUTRITION) {
              response = formatNutritionResponse(item.name, {
                calories: item.calories,
              });
            } else {
              response = formatIngredientsResponse(item.name, item.ingredients, item.allergens);
            }
          } else {
            response = "I couldn't find that item. Could you specify which dish you're asking about?";
          }
        } else {
          response = "Which dish would you like to know more about?";
        }
        break;

      case CulinaryIntent.GET_CUISINE_INFO:
        if (classified.entities.cuisine) {
          const cuisineInfo = expertiseService.getCuisineInfo(classified.entities.cuisine as string);
          if (cuisineInfo) {
            response = formatCuisineInfoResponse(
              cuisineInfo.name,
              cuisineInfo.description,
              cuisineInfo.signatureDishes,
              cuisineInfo.keyIngredients
            );
          } else {
            response = `I don't have detailed information about ${classified.entities.cuisine} cuisine. What else can I help you with?`;
          }
        } else {
          response = "Which cuisine would you like to learn about?";
        }
        break;

      case CulinaryIntent.ADD_TO_ORDER:
        if (restaurantId && classified.entities.itemId) {
          const item = await menuService.getMenuItem(restaurantId, classified.entities.itemId as string);
          if (item) {
            const quantity = (classified.entities.quantity as number) || 1;
            const result = await orderFlowHandler.addItem(userId, item, quantity);
            response = result.message;
          } else {
            response = "I couldn't find that item. Which dish would you like to add?";
          }
        } else {
          response = "Which dish would you like to add to your order?";
        }
        break;

      case CulinaryIntent.HELP:
        response = formatHelpResponse();
        break;

      case CulinaryIntent.UNKNOWN:
      default:
        // Use AI to generate contextual response
        try {
          const client = getAnthropicClient();
          const menuContext = restaurantId
            ? await menuService.getRestaurantMenu(restaurantId)
            : null;

          const aiResponse = await client.messages.create({
            model: 'claude-opus-4-7',
            max_tokens: 1024,
            system: CULINARY_EXPERT_SYSTEM_PROMPT,
            messages: [
              {
                role: 'user',
                content: `User query: ${message}\n\nRestaurant: ${restaurantId || 'Not specified'}\nUser ID: ${userId}\n\nMenu context: ${menuContext ? JSON.stringify(menuContext.categories) : 'No menu context available'}\n\nPlease respond helpfully as a culinary expert.`,
              },
            ],
          });

          response = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : 'I understand you need help. Could you be more specific about what you\'re looking for?';
        } catch (aiError) {
          logger.error('AI response generation failed:', aiError);
          response = "I'm here to help you explore our menu, get recommendations, or place an order. What would you like to know?";
        }
        break;
    }

    res.json({
      success: true,
      data: {
        response,
        intent: classified.intent,
        confidence: classified.confidence,
        ...intentData,
      },
    } as ApiResponse<{ response: string; intent: string; confidence: number }>);
  } catch (error) {
    logger.error('Chat endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
});

// ============================================================================
// MENU ENDPOINTS
// ============================================================================

/**
 * GET /api/culinary/menu/:restaurantId
 * Get full menu for a restaurant
 */
router.get('/menu/:restaurantId', async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;
    const menuService = getMenuService();

    const menu = await menuService.getRestaurantMenu(restaurantId);

    if (!menu) {
      return res.status(404).json({
        success: false,
        error: 'Menu not found',
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: menu,
    } as ApiResponse);
  } catch (error) {
    logger.error('Get menu error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch menu',
    } as ApiResponse);
  }
});

/**
 * GET /api/culinary/menu/:restaurantId/items/:itemId
 * Get specific menu item details
 */
router.get('/menu/:restaurantId/items/:itemId', async (req: Request, res: Response) => {
  try {
    const { restaurantId, itemId } = req.params;
    const menuService = getMenuService();

    const item = await menuService.getMenuItem(restaurantId, itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found',
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: item,
    } as ApiResponse);
  } catch (error) {
    logger.error('Get item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch item',
    } as ApiResponse);
  }
});

/**
 * POST /api/culinary/menu/:restaurantId/search
 * Search menu items
 */
router.post('/menu/:restaurantId/search', validateRequest(SearchItemsSchema), async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;
    const filters = req.body;
    const menuService = getMenuService();

    const results = await menuService.searchMenuItems(restaurantId, filters);

    res.json({
      success: true,
      data: results,
    } as ApiResponse);
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
    } as ApiResponse);
  }
});

// ============================================================================
// RECOMMENDATIONS ENDPOINTS
// ============================================================================

/**
 * POST /api/culinary/recommendations
 * Get personalized recommendations
 */
router.post('/recommendations', validateRequest(GetRecommendationSchema), async (req: Request, res: Response) => {
  try {
    const { restaurantId, userId, context, limit } = req.body;
    const menuService = getMenuService();
    const recommendationsService = getRecommendationsService();

    const menu = await menuService.getRestaurantMenu(restaurantId);
    if (!menu) {
      return res.status(404).json({
        success: false,
        error: 'Restaurant not found',
      } as ApiResponse);
    }

    const allItems = menu.categories.flatMap(cat => cat.items);
    const recommendations = await recommendationsService.getPersonalizedRecommendations(
      userId,
      allItems,
      context,
      limit
    );

    res.json({
      success: true,
      data: recommendations,
    } as ApiResponse);
  } catch (error) {
    logger.error('Recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
    } as ApiResponse);
  }
});

/**
 * GET /api/culinary/pairings/:restaurantId/:itemId
 * Get pairing suggestions for an item
 */
router.get('/pairings/:restaurantId/:itemId', async (req: Request, res: Response) => {
  try {
    const { restaurantId, itemId } = req.params;
    const { type } = req.query;
    const menuService = getMenuService();
    const recommendationsService = getRecommendationsService();

    const item = await menuService.getMenuItem(restaurantId, itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found',
      } as ApiResponse);
    }

    const pairings = recommendationsService.getPairingSuggestions(item);

    res.json({
      success: true,
      data: {
        item: item.name,
        pairings,
        type: type || 'all',
      },
    } as ApiResponse);
  } catch (error) {
    logger.error('Pairings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pairings',
    } as ApiResponse);
  }
});

// ============================================================================
// DIETARY ENDPOINTS
// ============================================================================

/**
 * POST /api/culinary/dietary/restrictions
 * Set dietary restrictions
 */
router.post('/dietary/restrictions', validateRequest(SetDietaryRestrictionSchema), async (req: Request, res: Response) => {
  try {
    const { userId, restriction, enabled } = req.body;
    const dietaryService = getDietaryService();

    if (enabled) {
      await dietaryService.addRestriction(userId, restriction);
    } else {
      await dietaryService.removeRestriction(userId, restriction);
    }

    res.json({
      success: true,
      message: `Dietary restriction '${restriction}' ${enabled ? 'added' : 'removed'}`,
    } as ApiResponse);
  } catch (error) {
    logger.error('Dietary restriction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update dietary restriction',
    } as ApiResponse);
  }
});

/**
 * POST /api/culinary/dietary/allergies
 * Update allergy profile
 */
router.post('/dietary/allergies', validateRequest(UpdateAllergyProfileSchema), async (req: Request, res: Response) => {
  try {
    const { userId, allergies } = req.body;
    const dietaryService = getDietaryService();

    for (const allergy of allergies) {
      await dietaryService.addAllergy(
        userId,
        allergy.allergenId,
        allergy.severity,
        allergy.notes
      );
    }

    res.json({
      success: true,
      message: `Updated ${allergies.length} allergy profiles`,
    } as ApiResponse);
  } catch (error) {
    logger.error('Allergy update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update allergy profile',
    } as ApiResponse);
  }
});

/**
 * GET /api/culinary/dietary/profile/:userId
 * Get user dietary profile
 */
router.get('/dietary/profile/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const dietaryService = getDietaryService();

    const profile = await dietaryService.getUserProfile(userId);

    res.json({
      success: true,
      data: profile,
    } as ApiResponse);
  } catch (error) {
    logger.error('Get dietary profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dietary profile',
    } as ApiResponse);
  }
});

/**
 * POST /api/culinary/dietary/check
 * Check dish compatibility
 */
router.post('/dietary/check', validateRequest(CheckAllergensSchema), async (req: Request, res: Response) => {
  try {
    const { userId, itemId, description } = req.body;
    const dietaryService = getDietaryService();
    const menuService = getMenuService();

    let dishDescription = description || '';
    let dishAllergens: string[] = [];
    let dishDietaryTags: string[] = [];

    if (itemId && req.body.restaurantId) {
      const item = await menuService.getMenuItem(req.body.restaurantId, itemId);
      if (item) {
        dishDescription = item.description;
        dishAllergens = item.allergens;
        dishDietaryTags = item.dietaryTags;
      }
    }

    const result = await dietaryService.checkDishCompatibility(
      userId,
      dishDescription,
      dishAllergens,
      dishDietaryTags
    );

    res.json({
      success: true,
      data: result,
    } as ApiResponse);
  } catch (error) {
    logger.error('Dietary check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check dietary compatibility',
    } as ApiResponse);
  }
});

// ============================================================================
// ORDER ENDPOINTS
// ============================================================================

/**
 * POST /api/culinary/orders/start
 * Start a new order
 */
router.post('/orders/start', async (req: Request, res: Response) => {
  try {
    const { userId, restaurantId } = req.body;

    if (!userId || !restaurantId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, restaurantId',
      } as ApiResponse);
    }

    const orderFlowHandler = getOrderFlowHandler();
    const result = await orderFlowHandler.startOrder(userId, restaurantId);

    res.json({
      success: result.success,
      data: result.state,
      message: result.message,
    } as ApiResponse);
  } catch (error) {
    logger.error('Start order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start order',
    } as ApiResponse);
  }
});

/**
 * POST /api/culinary/orders/add-item
 * Add item to order
 */
router.post('/orders/add-item', async (req: Request, res: Response) => {
  try {
    const { userId, restaurantId, itemId, quantity, customizations, specialInstructions } = req.body;
    const menuService = getMenuService();
    const orderFlowHandler = getOrderFlowHandler();

    const item = await menuService.getMenuItem(restaurantId, itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found',
      } as ApiResponse);
    }

    const result = await orderFlowHandler.addItem(
      userId,
      item,
      quantity || 1,
      customizations || [],
      specialInstructions
    );

    res.json({
      success: result.success,
      data: result.state,
      message: result.message,
    } as ApiResponse);
  } catch (error) {
    logger.error('Add item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add item',
    } as ApiResponse);
  }
});

/**
 * POST /api/culinary/orders/place
 * Place order
 */
router.post('/orders/place', validateRequest(PlaceOrderSchema), async (req: Request, res: Response) => {
  try {
    const orderFlowHandler = getOrderFlowHandler();
    const result = await orderFlowHandler.placeOrder(req.body.userId);

    res.json({
      success: result.success,
      data: result.order,
      message: result.message,
    } as ApiResponse);
  } catch (error) {
    logger.error('Place order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to place order',
    } as ApiResponse);
  }
});

/**
 * POST /api/culinary/orders/cancel
 * Cancel order
 */
router.post('/orders/cancel', async (req: Request, res: Response) => {
  try {
    const { userId, orderId } = req.body;
    const orderFlowHandler = getOrderFlowHandler();

    const result = await orderFlowHandler.cancelOrder(userId, orderId);

    res.json({
      success: result.success,
      data: result.order,
      message: result.message,
    } as ApiResponse);
  } catch (error) {
    logger.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order',
    } as ApiResponse);
  }
});

/**
 * GET /api/culinary/orders/:userId
 * Get order history
 */
router.get('/orders/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { orderId } = req.query;
    const orderFlowHandler = getOrderFlowHandler();

    if (orderId) {
      const order = await orderFlowHandler.getOrderStatus(userId, orderId as string);
      res.json({
        success: true,
        data: order,
      } as ApiResponse);
    } else {
      const history = await orderFlowHandler.getOrderHistory(userId);
      res.json({
        success: true,
        data: history,
      } as ApiResponse);
    }
  } catch (error) {
    logger.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get orders',
    } as ApiResponse);
  }
});

// ============================================================================
// EXPERTISE ENDPOINTS
// ============================================================================

/**
 * GET /api/culinary/expertise/cuisines
 * Get all available cuisines
 */
router.get('/expertise/cuisines', (req: Request, res: Response) => {
  try {
    const expertiseService = getCulinaryExpertiseService();
    const cuisines = expertiseService.getAllCuisines();

    res.json({
      success: true,
      data: cuisines,
    } as ApiResponse);
  } catch (error) {
    logger.error('Get cuisines error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cuisines',
    } as ApiResponse);
  }
});

/**
 * GET /api/culinary/expertise/cuisines/:name
 * Get cuisine info
 */
router.get('/expertise/cuisines/:name', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const expertiseService = getCulinaryExpertiseService();

    const cuisine = expertiseService.getCuisineInfo(decodeURIComponent(name));

    if (!cuisine) {
      return res.status(404).json({
        success: false,
        error: 'Cuisine not found',
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: cuisine,
    } as ApiResponse);
  } catch (error) {
    logger.error('Get cuisine error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cuisine',
    } as ApiResponse);
  }
});

/**
 * GET /api/culinary/expertise/dietary
 * Get all dietary tags
 */
router.get('/expertise/dietary', (req: Request, res: Response) => {
  try {
    const expertiseService = getCulinaryExpertiseService();
    const tags = expertiseService.getAllDietaryTags();

    res.json({
      success: true,
      data: tags,
    } as ApiResponse);
  } catch (error) {
    logger.error('Get dietary tags error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dietary tags',
    } as ApiResponse);
  }
});

/**
 * GET /api/culinary/expertise/summary
 * Get expertise summary
 */
router.get('/expertise/summary', (req: Request, res: Response) => {
  try {
    const expertiseService = getCulinaryExpertiseService();
    const summary = expertiseService.getExpertiseSummary();

    res.json({
      success: true,
      data: summary,
    } as ApiResponse);
  } catch (error) {
    logger.error('Get expertise summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get expertise summary',
    } as ApiResponse);
  }
});

export default router;
