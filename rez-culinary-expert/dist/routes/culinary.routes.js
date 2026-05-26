"use strict";
/**
 * Culinary Routes
 * Express routes for the culinary expert agent
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sdk_1 = require("@anthropic-ai/sdk");
const logger_1 = require("./utils/logger");
const culinaryIntents_js_1 = require("../intents/culinaryIntents.js");
const menuService_js_1 = require("../services/menuService.js");
const dietaryService_js_1 = require("../services/dietaryService.js");
const recommendations_js_1 = require("../services/recommendations.js");
const orderFlow_js_1 = require("../intents/orderFlow.js");
const expertise_js_1 = require("../services/expertise.js");
const templates_js_1 = require("../responses/templates.js");
const systemPrompt_js_1 = require("../config/systemPrompt.js");
const coreBrainIntegration_js_1 = require("../services/coreBrainIntegration.js");
const router = (0, express_1.Router)();
// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================
function validateRequest(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: result.error.issues,
            });
        }
        req.body = result.data;
        next();
    };
}
// ============================================================================
// ANTHROPIC CLIENT
// ============================================================================
let anthropicClient = null;
function getAnthropicClient() {
    if (!anthropicClient) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY not configured');
        }
        anthropicClient = new sdk_1.Anthropic({ apiKey });
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
router.post('/chat', async (req, res) => {
    try {
        const { message, userId, restaurantId, tone = 'default', context = {} } = req.body;
        if (!message || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: message, userId',
            });
        }
        // Load Core Brain context for personalization
        const coreBrain = (0, coreBrainIntegration_js_1.getCoreBrainClient)();
        let coreBrainContext = null;
        try {
            const userContext = await coreBrain.loadUserContext(userId, req.body.sessionId || '', restaurantId);
            if (userContext) {
                coreBrainContext = {
                    preferences: userContext.preferences,
                    loyalty: userContext.loyalty,
                    memories: userContext.memories,
                    diningHistory: userContext.diningHistory || [],
                };
                logger_1.logger.info('Core Brain context loaded', {
                    userId,
                    hasPreferences: !!coreBrainContext.preferences,
                    hasLoyalty: !!coreBrainContext.loyalty,
                    memoryCount: coreBrainContext.memories.length,
                });
            }
        }
        catch (coreBrainError) {
            logger_1.logger.warn('Failed to load Core Brain context', { error: coreBrainError, userId });
        }
        // Enhance context with Core Brain data
        const enhancedContext = {
            ...context,
            ...coreBrainContext?.preferences,
            dietaryContext: extractDietaryContext(coreBrainContext?.memories || []),
            favoriteCuisines: extractFavoriteCuisines(coreBrainContext?.diningHistory || []),
            loyaltyTier: coreBrainContext?.loyalty?.tier,
            loyaltyPoints: coreBrainContext?.loyalty?.points,
        };
        // Classify intent
        const classified = (0, culinaryIntents_js_1.classifyIntent)(message, enhancedContext);
        logger_1.logger.info(`Intent classified: ${classified.intent} (${classified.confidence})`);
        const menuService = (0, menuService_js_1.getMenuService)();
        const dietaryService = (0, dietaryService_js_1.getDietaryService)();
        const recommendationsService = (0, recommendations_js_1.getRecommendationsService)();
        const orderFlowHandler = (0, orderFlow_js_1.getOrderFlowHandler)();
        const expertiseService = (0, expertise_js_1.getCulinaryExpertiseService)();
        let response = '';
        let intentData = {};
        // Track if we should record this activity
        const activityToRecord = {
            action: classified.intent,
            agent: 'culinary-expert',
            topic: message.substring(0, 100),
        };
        // Handle intents
        switch (classified.intent) {
            case culinaryIntents_js_1.CulinaryIntent.GREETING:
                response = "Hello! I'm your culinary expert. I can help you explore our menu, find perfect recommendations, check dietary information, and assist with your order. What would you like today?";
                break;
            case culinaryIntents_js_1.CulinaryIntent.VIEW_MENU:
                if (restaurantId) {
                    const menu = await menuService.getRestaurantMenu(restaurantId);
                    if (menu) {
                        const categoryData = menu.categories.map(cat => ({
                            name: cat.name,
                            itemCount: cat.items.length,
                            items: cat.items,
                        }));
                        response = (0, templates_js_1.formatMenuBrowseResponse)(categoryData, tone);
                    }
                    else {
                        response = "I couldn't find the menu for this restaurant. Please check the restaurant ID.";
                    }
                }
                else {
                    response = "I need to know which restaurant you're at to show you the menu. Could you provide the restaurant ID?";
                }
                break;
            case culinaryIntents_js_1.CulinaryIntent.SEARCH_ITEMS:
                if (restaurantId) {
                    const searchResults = await menuService.searchMenuItems(restaurantId, {
                        searchQuery: message,
                    });
                    if (searchResults.items.length > 0) {
                        response = `Found ${searchResults.totalCount} items matching "${message}":\n\n`;
                        response += searchResults.items.slice(0, 5).map(item => (0, templates_js_1.formatMenuItemText)(item, tone)).join('\n\n');
                    }
                    else {
                        response = `I couldn't find unknown items matching "${message}". Try searching for a specific dish or ingredient!`;
                    }
                }
                else {
                    response = "I need a restaurant ID to search the menu. Which restaurant are you at?";
                }
                break;
            case culinaryIntents_js_1.CulinaryIntent.GET_RECOMMENDATION:
                if (restaurantId) {
                    const menu = await menuService.getRestaurantMenu(restaurantId);
                    if (menu) {
                        const allItems = menu.categories.flatMap(cat => cat.items);
                        const recommendations = await recommendationsService.getPersonalizedRecommendations(userId, allItems, {
                            ...classified.entities,
                            ...context,
                        });
                        response = (0, templates_js_1.formatRecommendationResponse)(recommendations, tone);
                    }
                    else {
                        response = "I couldn't access the menu. Please try again.";
                    }
                }
                else {
                    response = "Which restaurant would you like recommendations from?";
                }
                break;
            case culinaryIntents_js_1.CulinaryIntent.GET_PAIRING:
                if (restaurantId && classified.entities.itemId) {
                    const item = await menuService.getMenuItem(restaurantId, classified.entities.itemId);
                    if (item) {
                        const pairings = recommendationsService.getPairingSuggestions(item);
                        response = (0, templates_js_1.formatPairingResponse)(item.name, pairings, classified.entities.pairingType || 'wine');
                    }
                    else {
                        response = "I couldn't find that item. Could you be more specific?";
                    }
                }
                else {
                    response = "Which dish would you like pairing suggestions for?";
                }
                break;
            case culinaryIntents_js_1.CulinaryIntent.SET_DIETARY_RESTRICTION:
            case culinaryIntents_js_1.CulinaryIntent.CHECK_ALLERGENS:
                if (classified.entities.restrictions) {
                    const restrictions = classified.entities.restrictions;
                    for (const restriction of restrictions) {
                        await dietaryService.addRestriction(userId, restriction);
                    }
                    response = `I've noted your dietary requirements: ${restrictions.join(', ')}. I'll keep these in mind for all recommendations and will flag unknown dishes that may not be suitable.`;
                }
                else if (classified.entities.isAllergy && classified.entities.allergens) {
                    const allergens = classified.entities.allergens;
                    for (const allergen of allergens) {
                        await dietaryService.addAllergy(userId, allergen.toLowerCase().replace('-', '_'));
                    }
                    response = (0, templates_js_1.formatAllergenWarning)(allergens.map(a => ({
                        id: a.toLowerCase(),
                        name: a,
                        severity: 'severe',
                    })));
                    response += "\n\nYour allergy information has been saved. I'll flag unknown dishes containing these allergens.";
                }
                else {
                    response = "I want to make sure I understand your dietary needs correctly. Could you tell me about unknown allergies or dietary restrictions?";
                }
                break;
            case culinaryIntents_js_1.CulinaryIntent.GET_NUTRITION:
            case culinaryIntents_js_1.CulinaryIntent.GET_INGREDIENTS:
                if (restaurantId && classified.entities.itemId) {
                    const item = await menuService.getMenuItem(restaurantId, classified.entities.itemId);
                    if (item) {
                        if (classified.intent === culinaryIntents_js_1.CulinaryIntent.GET_NUTRITION) {
                            response = (0, templates_js_1.formatNutritionResponse)(item.name, {
                                calories: item.calories,
                            });
                        }
                        else {
                            response = (0, templates_js_1.formatIngredientsResponse)(item.name, item.ingredients, item.allergens);
                        }
                    }
                    else {
                        response = "I couldn't find that item. Could you specify which dish you're asking about?";
                    }
                }
                else {
                    response = "Which dish would you like to know more about?";
                }
                break;
            case culinaryIntents_js_1.CulinaryIntent.GET_CUISINE_INFO:
                if (classified.entities.cuisine) {
                    const cuisineInfo = expertiseService.getCuisineInfo(classified.entities.cuisine);
                    if (cuisineInfo) {
                        response = (0, templates_js_1.formatCuisineInfoResponse)(cuisineInfo.name, cuisineInfo.description, cuisineInfo.signatureDishes, cuisineInfo.keyIngredients);
                    }
                    else {
                        response = `I don't have detailed information about ${classified.entities.cuisine} cuisine. What else can I help you with?`;
                    }
                }
                else {
                    response = "Which cuisine would you like to learn about?";
                }
                break;
            case culinaryIntents_js_1.CulinaryIntent.ADD_TO_ORDER:
                if (restaurantId && classified.entities.itemId) {
                    const item = await menuService.getMenuItem(restaurantId, classified.entities.itemId);
                    if (item) {
                        const quantity = classified.entities.quantity || 1;
                        const result = await orderFlowHandler.addItem(userId, item, quantity);
                        response = result.message;
                    }
                    else {
                        response = "I couldn't find that item. Which dish would you like to add?";
                    }
                }
                else {
                    response = "Which dish would you like to add to your order?";
                }
                break;
            case culinaryIntents_js_1.CulinaryIntent.HELP:
                response = (0, templates_js_1.formatHelpResponse)();
                break;
            case culinaryIntents_js_1.CulinaryIntent.UNKNOWN:
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
                        system: systemPrompt_js_1.CULINARY_EXPERT_SYSTEM_PROMPT,
                        messages: [
                            {
                                role: 'user',
                                content: `User query: ${message}\n\nRestaurant: ${restaurantId || 'Not specified'}\nUser ID: ${userId}\n\nMenu context: ${menuContext ? JSON.stringify(menuContext.categories) : 'No menu context available'}\n\nPlease respond helpfully as a culinary expert.`,
                            },
                        ],
                    });
                    response = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : 'I understand you need help. Could you be more specific about what you\'re looking for?';
                }
                catch (aiError) {
                    logger_1.logger.error('AI response generation failed:', aiError);
                    response = "I'm here to help you explore our menu, get recommendations, or place an order. What would you like to know?";
                }
                break;
        }
        // Record activity in Core Brain (non-blocking)
        coreBrain.recordActivity(userId, activityToRecord).catch((err) => {
            logger_1.logger.warn('Failed to record activity in Core Brain', { error: err });
        });
        res.json({
            success: true,
            data: {
                response,
                intent: classified.intent,
                confidence: classified.confidence,
                ...intentData,
                // Include Core Brain context for client-side use
                context: {
                    hasPersonalization: !!coreBrainContext?.preferences,
                    loyaltyTier: coreBrainContext?.loyalty?.tier || null,
                    loyaltyPoints: coreBrainContext?.loyalty?.points || null,
                    dietaryContext: extractDietaryContext(coreBrainContext?.memories || []),
                },
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Chat endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Extract dietary context from user memories
 */
function extractDietaryContext(memories) {
    const dietary = [];
    for (const memory of memories) {
        const tags = memory.tags;
        if (tags?.includes('dietary') && memory.content) {
            dietary.push(memory.content);
        }
    }
    return [...new Set(dietary)];
}
/**
 * Extract favorite cuisines from dining history
 */
function extractFavoriteCuisines(diningHistory) {
    const cuisines = [];
    for (const memory of diningHistory) {
        const metadata = memory.metadata;
        if (metadata?.cuisine) {
            cuisines.push(metadata.cuisine);
        }
    }
    return [...new Set(cuisines)];
}
// ============================================================================
// MENU ENDPOINTS
// ============================================================================
/**
 * GET /api/culinary/menu/:restaurantId
 * Get full menu for a restaurant
 */
router.get('/menu/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const menuService = (0, menuService_js_1.getMenuService)();
        const menu = await menuService.getRestaurantMenu(restaurantId);
        if (!menu) {
            return res.status(404).json({
                success: false,
                error: 'Menu not found',
            });
        }
        res.json({
            success: true,
            data: menu,
        });
    }
    catch (error) {
        logger_1.logger.error('Get menu error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch menu',
        });
    }
});
/**
 * GET /api/culinary/menu/:restaurantId/items/:itemId
 * Get specific menu item details
 */
router.get('/menu/:restaurantId/items/:itemId', async (req, res) => {
    try {
        const { restaurantId, itemId } = req.params;
        const menuService = (0, menuService_js_1.getMenuService)();
        const item = await menuService.getMenuItem(restaurantId, itemId);
        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Item not found',
            });
        }
        res.json({
            success: true,
            data: item,
        });
    }
    catch (error) {
        logger_1.logger.error('Get item error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch item',
        });
    }
});
/**
 * POST /api/culinary/menu/:restaurantId/search
 * Search menu items
 */
router.post('/menu/:restaurantId/search', validateRequest(culinaryIntents_js_1.SearchItemsSchema), async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const filters = req.body;
        const menuService = (0, menuService_js_1.getMenuService)();
        const results = await menuService.searchMenuItems(restaurantId, filters);
        res.json({
            success: true,
            data: results,
        });
    }
    catch (error) {
        logger_1.logger.error('Search error:', error);
        res.status(500).json({
            success: false,
            error: 'Search failed',
        });
    }
});
// ============================================================================
// RECOMMENDATIONS ENDPOINTS
// ============================================================================
/**
 * POST /api/culinary/recommendations
 * Get personalized recommendations
 */
router.post('/recommendations', validateRequest(culinaryIntents_js_1.GetRecommendationSchema), async (req, res) => {
    try {
        const { restaurantId, userId, context, limit } = req.body;
        const menuService = (0, menuService_js_1.getMenuService)();
        const recommendationsService = (0, recommendations_js_1.getRecommendationsService)();
        const menu = await menuService.getRestaurantMenu(restaurantId);
        if (!menu) {
            return res.status(404).json({
                success: false,
                error: 'Restaurant not found',
            });
        }
        const allItems = menu.categories.flatMap(cat => cat.items);
        const recommendations = await recommendationsService.getPersonalizedRecommendations(userId, allItems, context, limit);
        res.json({
            success: true,
            data: recommendations,
        });
    }
    catch (error) {
        logger_1.logger.error('Recommendations error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate recommendations',
        });
    }
});
/**
 * GET /api/culinary/pairings/:restaurantId/:itemId
 * Get pairing suggestions for an item
 */
router.get('/pairings/:restaurantId/:itemId', async (req, res) => {
    try {
        const { restaurantId, itemId } = req.params;
        const { type } = req.query;
        const menuService = (0, menuService_js_1.getMenuService)();
        const recommendationsService = (0, recommendations_js_1.getRecommendationsService)();
        const item = await menuService.getMenuItem(restaurantId, itemId);
        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Item not found',
            });
        }
        const pairings = recommendationsService.getPairingSuggestions(item);
        res.json({
            success: true,
            data: {
                item: item.name,
                pairings,
                type: type || 'all',
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Pairings error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get pairings',
        });
    }
});
// ============================================================================
// DIETARY ENDPOINTS
// ============================================================================
/**
 * POST /api/culinary/dietary/restrictions
 * Set dietary restrictions
 */
router.post('/dietary/restrictions', validateRequest(culinaryIntents_js_1.SetDietaryRestrictionSchema), async (req, res) => {
    try {
        const { userId, restriction, enabled } = req.body;
        const dietaryService = (0, dietaryService_js_1.getDietaryService)();
        if (enabled) {
            await dietaryService.addRestriction(userId, restriction);
        }
        else {
            await dietaryService.removeRestriction(userId, restriction);
        }
        res.json({
            success: true,
            message: `Dietary restriction '${restriction}' ${enabled ? 'added' : 'removed'}`,
        });
    }
    catch (error) {
        logger_1.logger.error('Dietary restriction error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update dietary restriction',
        });
    }
});
/**
 * POST /api/culinary/dietary/allergies
 * Update allergy profile
 */
router.post('/dietary/allergies', validateRequest(culinaryIntents_js_1.UpdateAllergyProfileSchema), async (req, res) => {
    try {
        const { userId, allergies } = req.body;
        const dietaryService = (0, dietaryService_js_1.getDietaryService)();
        for (const allergy of allergies) {
            await dietaryService.addAllergy(userId, allergy.allergenId, allergy.severity, allergy.notes);
        }
        res.json({
            success: true,
            message: `Updated ${allergies.length} allergy profiles`,
        });
    }
    catch (error) {
        logger_1.logger.error('Allergy update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update allergy profile',
        });
    }
});
/**
 * GET /api/culinary/dietary/profile/:userId
 * Get user dietary profile
 */
router.get('/dietary/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const dietaryService = (0, dietaryService_js_1.getDietaryService)();
        const profile = await dietaryService.getUserProfile(userId);
        res.json({
            success: true,
            data: profile,
        });
    }
    catch (error) {
        logger_1.logger.error('Get dietary profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get dietary profile',
        });
    }
});
/**
 * POST /api/culinary/dietary/check
 * Check dish compatibility
 */
router.post('/dietary/check', validateRequest(culinaryIntents_js_1.CheckAllergensSchema), async (req, res) => {
    try {
        const { userId, itemId, description } = req.body;
        const dietaryService = (0, dietaryService_js_1.getDietaryService)();
        const menuService = (0, menuService_js_1.getMenuService)();
        let dishDescription = description || '';
        let dishAllergens = [];
        let dishDietaryTags = [];
        if (itemId && req.body.restaurantId) {
            const item = await menuService.getMenuItem(req.body.restaurantId, itemId);
            if (item) {
                dishDescription = item.description;
                dishAllergens = item.allergens;
                dishDietaryTags = item.dietaryTags;
            }
        }
        const result = await dietaryService.checkDishCompatibility(userId, dishDescription, dishAllergens, dishDietaryTags);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('Dietary check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check dietary compatibility',
        });
    }
});
// ============================================================================
// ORDER ENDPOINTS
// ============================================================================
/**
 * POST /api/culinary/orders/start
 * Start a new order
 */
router.post('/orders/start', async (req, res) => {
    try {
        const { userId, restaurantId } = req.body;
        if (!userId || !restaurantId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, restaurantId',
            });
        }
        const orderFlowHandler = (0, orderFlow_js_1.getOrderFlowHandler)();
        const result = await orderFlowHandler.startOrder(userId, restaurantId);
        res.json({
            success: result.success,
            data: result.state,
            message: result.message,
        });
    }
    catch (error) {
        logger_1.logger.error('Start order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start order',
        });
    }
});
/**
 * POST /api/culinary/orders/add-item
 * Add item to order
 */
router.post('/orders/add-item', async (req, res) => {
    try {
        const { userId, restaurantId, itemId, quantity, customizations, specialInstructions } = req.body;
        const menuService = (0, menuService_js_1.getMenuService)();
        const orderFlowHandler = (0, orderFlow_js_1.getOrderFlowHandler)();
        const item = await menuService.getMenuItem(restaurantId, itemId);
        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Item not found',
            });
        }
        const result = await orderFlowHandler.addItem(userId, item, quantity || 1, customizations || [], specialInstructions);
        res.json({
            success: result.success,
            data: result.state,
            message: result.message,
        });
    }
    catch (error) {
        logger_1.logger.error('Add item error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add item',
        });
    }
});
/**
 * POST /api/culinary/orders/place
 * Place order
 */
router.post('/orders/place', validateRequest(culinaryIntents_js_1.PlaceOrderSchema), async (req, res) => {
    try {
        const orderFlowHandler = (0, orderFlow_js_1.getOrderFlowHandler)();
        const result = await orderFlowHandler.placeOrder(req.body.userId);
        res.json({
            success: result.success,
            data: result.order,
            message: result.message,
        });
    }
    catch (error) {
        logger_1.logger.error('Place order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to place order',
        });
    }
});
/**
 * POST /api/culinary/orders/cancel
 * Cancel order
 */
router.post('/orders/cancel', async (req, res) => {
    try {
        const { userId, orderId } = req.body;
        const orderFlowHandler = (0, orderFlow_js_1.getOrderFlowHandler)();
        const result = await orderFlowHandler.cancelOrder(userId, orderId);
        res.json({
            success: result.success,
            data: result.order,
            message: result.message,
        });
    }
    catch (error) {
        logger_1.logger.error('Cancel order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel order',
        });
    }
});
/**
 * GET /api/culinary/orders/:userId
 * Get order history
 */
router.get('/orders/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { orderId } = req.query;
        const orderFlowHandler = (0, orderFlow_js_1.getOrderFlowHandler)();
        if (orderId) {
            const order = await orderFlowHandler.getOrderStatus(userId, orderId);
            res.json({
                success: true,
                data: order,
            });
        }
        else {
            const history = await orderFlowHandler.getOrderHistory(userId);
            res.json({
                success: true,
                data: history,
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get orders',
        });
    }
});
// ============================================================================
// EXPERTISE ENDPOINTS
// ============================================================================
/**
 * GET /api/culinary/expertise/cuisines
 * Get all available cuisines
 */
router.get('/expertise/cuisines', (req, res) => {
    try {
        const expertiseService = (0, expertise_js_1.getCulinaryExpertiseService)();
        const cuisines = expertiseService.getAllCuisines();
        res.json({
            success: true,
            data: cuisines,
        });
    }
    catch (error) {
        logger_1.logger.error('Get cuisines error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cuisines',
        });
    }
});
/**
 * GET /api/culinary/expertise/cuisines/:name
 * Get cuisine info
 */
router.get('/expertise/cuisines/:name', (req, res) => {
    try {
        const { name } = req.params;
        const expertiseService = (0, expertise_js_1.getCulinaryExpertiseService)();
        const cuisine = expertiseService.getCuisineInfo(decodeURIComponent(name));
        if (!cuisine) {
            return res.status(404).json({
                success: false,
                error: 'Cuisine not found',
            });
        }
        res.json({
            success: true,
            data: cuisine,
        });
    }
    catch (error) {
        logger_1.logger.error('Get cuisine error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cuisine',
        });
    }
});
/**
 * GET /api/culinary/expertise/dietary
 * Get all dietary tags
 */
router.get('/expertise/dietary', (req, res) => {
    try {
        const expertiseService = (0, expertise_js_1.getCulinaryExpertiseService)();
        const tags = expertiseService.getAllDietaryTags();
        res.json({
            success: true,
            data: tags,
        });
    }
    catch (error) {
        logger_1.logger.error('Get dietary tags error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get dietary tags',
        });
    }
});
/**
 * GET /api/culinary/expertise/summary
 * Get expertise summary
 */
router.get('/expertise/summary', (req, res) => {
    try {
        const expertiseService = (0, expertise_js_1.getCulinaryExpertiseService)();
        const summary = expertiseService.getExpertiseSummary();
        res.json({
            success: true,
            data: summary,
        });
    }
    catch (error) {
        logger_1.logger.error('Get expertise summary error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get expertise summary',
        });
    }
});
exports.default = router;
//# sourceMappingURL=culinary.routes.js.map