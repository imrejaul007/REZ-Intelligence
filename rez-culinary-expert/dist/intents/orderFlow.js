"use strict";
/**
 * Order Flow Handler
 * Manages the state machine for order processing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderFlowHandler = exports.OrderStep = exports.OrderStatus = void 0;
exports.getOrderFlowHandler = getOrderFlowHandler;
const logger_js_1 = require("./utils/logger.js");
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "pending";
    OrderStatus["CONFIRMED"] = "confirmed";
    OrderStatus["PREPARING"] = "preparing";
    OrderStatus["READY"] = "ready";
    OrderStatus["OUT_FOR_DELIVERY"] = "out_for_delivery";
    OrderStatus["DELIVERED"] = "delivered";
    OrderStatus["CANCELLED"] = "cancelled";
    OrderStatus["REFUNDED"] = "refunded";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var OrderStep;
(function (OrderStep) {
    OrderStep["START"] = "start";
    OrderStep["SELECT_ITEMS"] = "select_items";
    OrderStep["CUSTOMIZE_ITEM"] = "customize_item";
    OrderStep["REVIEW_ORDER"] = "review_order";
    OrderStep["ADD_DELIVERY_INFO"] = "add_delivery_info";
    OrderStep["CONFIRM_ORDER"] = "confirm_order";
    OrderStep["PAYMENT"] = "payment";
    OrderStep["PLACED"] = "placed";
    OrderStep["COMPLETED"] = "completed";
})(OrderStep || (exports.OrderStep = OrderStep = {}));
class OrderFlowHandler {
    db = null;
    redis = null;
    ordersCollection = null;
    flowStateCollection = null;
    initialized = false;
    FLOW_STATE_TTL = 1800; // 30 minutes
    async initialize(mongoClient, redis) {
        this.db = mongoClient.db('rez_culinary');
        this.redis = redis;
        this.ordersCollection = this.db.collection('orders');
        this.flowStateCollection = this.db.collection('order_flow_states');
        // Create indexes
        await this.ordersCollection.createIndex({ id: 1 }, { unique: true });
        await this.ordersCollection.createIndex({ userId: 1 });
        await this.ordersCollection.createIndex({ restaurantId: 1 });
        await this.ordersCollection.createIndex({ status: 1 });
        await this.ordersCollection.createIndex({ createdAt: -1 });
        await this.flowStateCollection.createIndex({ userId: 1 }, { unique: true });
        this.initialized = true;
        logger_js_1.logger.info('OrderFlowHandler initialized');
    }
    /**
     * Start a new order flow
     */
    async startOrder(userId, restaurantId) {
        if (!this.flowStateCollection) {
            return { success: false, message: 'Order service not initialized' };
        }
        // Check if user has pending order
        const existingState = await this.getFlowState(userId);
        if (existingState) {
            return {
                success: true,
                state: existingState,
                message: 'You have an existing order in progress',
                nextStep: existingState.currentStep,
            };
        }
        const initialState = {
            userId,
            restaurantId,
            currentStep: OrderStep.SELECT_ITEMS,
            customizations: [],
            pickup: false,
        };
        await this.saveFlowState(initialState);
        return {
            success: true,
            state: initialState,
            message: 'Order started! Browse the menu and add items to your order.',
            nextStep: OrderStep.SELECT_ITEMS,
            actions: [{ type: 'add_item' }],
        };
    }
    /**
     * Add item to order
     */
    async addItem(userId, item, quantity = 1, customizations = [], specialInstructions) {
        const state = await this.getFlowState(userId);
        if (!state) {
            return { success: false, message: 'No active order. Please start a new order.' };
        }
        // Validate item belongs to same restaurant
        if (state.restaurantId !== item.id.split('_')[0]) {
            return { success: false, message: 'Item is from a different restaurant. Please complete or cancel current order first.' };
        }
        // Calculate subtotal
        const customizationTotal = customizations.reduce((sum, c) => sum + c.priceAdjustment, 0);
        const itemSubtotal = (item.price + customizationTotal) * quantity;
        const orderItem = {
            id: `${item.id}_${Date.now()}`,
            itemId: item.id,
            name: item.name,
            price: item.price,
            quantity,
            customizations,
            specialInstructions,
            subtotal: itemSubtotal,
        };
        // Store pending item
        state.pendingItem = {
            itemId: item.id,
            quantity,
            customizations,
            specialInstructions,
        };
        await this.saveFlowState(state);
        return {
            success: true,
            state,
            message: `Added ${quantity}x ${item.name} to your order${customizations.length > 0 ? ' with customizations' : ''}. ${specialInstructions ? `Note: ${specialInstructions}` : ''}`,
            nextStep: OrderStep.SELECT_ITEMS,
            actions: [
                { type: 'customize_item', payload: { itemId: item.id } },
                { type: 'continue', payload: { action: 'add_more' } },
                { type: 'continue', payload: { action: 'review' } },
            ],
        };
    }
    /**
     * Review current order
     */
    async reviewOrder(userId) {
        if (!this.ordersCollection) {
            return { success: false, items: [], subtotal: 0, message: 'Order service not initialized' };
        }
        // Get the most recent order for this user
        const order = await this.ordersCollection
            .find({ userId, status: OrderStatus.PENDING })
            .sort({ createdAt: -1 })
            .limit(1)
            .toArray();
        if (order.length === 0) {
            return { success: false, items: [], subtotal: 0, message: 'No active order found' };
        }
        const currentOrder = order[0];
        const subtotal = currentOrder.items.reduce((sum, item) => sum + item.subtotal, 0);
        return {
            success: true,
            items: currentOrder.items,
            subtotal,
            message: this.formatOrderSummary(currentOrder),
        };
    }
    /**
     * Set delivery or pickup preference
     */
    async setDeliveryPreference(userId, pickup, address) {
        const state = await this.getFlowState(userId);
        if (!state) {
            return { success: false, message: 'No active order. Please start a new order.' };
        }
        if (!pickup && !address) {
            return { success: false, message: 'Please provide delivery address' };
        }
        state.pickup = pickup;
        state.deliveryAddress = address;
        state.currentStep = OrderStep.CONFIRM_ORDER;
        await this.saveFlowState(state);
        const addressText = pickup ? 'for pickup' : `to ${address?.street}, ${address?.city}`;
        return {
            success: true,
            state,
            message: `Got it! Your order is ${addressText}. Ready to confirm?`,
            nextStep: OrderStep.CONFIRM_ORDER,
        };
    }
    /**
     * Set payment method
     */
    async setPaymentMethod(userId, method) {
        const state = await this.getFlowState(userId);
        if (!state) {
            return { success: false, message: 'No active order. Please start a new order.' };
        }
        state.paymentMethod = method;
        state.currentStep = OrderStep.PAYMENT;
        await this.saveFlowState(state);
        return {
            success: true,
            state,
            message: `Payment method set to ${method}. Ready to place order?`,
            nextStep: OrderStep.PAYMENT,
        };
    }
    /**
     * Set tip amount
     */
    async setTip(userId, tip) {
        const state = await this.getFlowState(userId);
        if (!state) {
            return { success: false, message: 'No active order. Please start a new order.' };
        }
        state.tip = tip;
        await this.saveFlowState(state);
        return {
            success: true,
            state,
            message: `Tip set to $${tip.toFixed(2)}`,
        };
    }
    /**
     * Place the order
     */
    async placeOrder(userId) {
        if (!this.flowStateCollection || !this.ordersCollection) {
            return { success: false, message: 'Order service not initialized' };
        }
        const state = await this.getFlowState(userId);
        if (!state) {
            return { success: false, message: 'No active order. Please start a new order.' };
        }
        // Get pending order items
        const pendingOrder = await this.ordersCollection
            .findOne({ userId, status: OrderStatus.PENDING });
        if (!pendingOrder || pendingOrder.items.length === 0) {
            return { success: false, message: 'No items in order. Please add items before placing.' };
        }
        // Validate required fields
        if (!state.paymentMethod) {
            return {
                success: false,
                message: 'Please select a payment method',
                nextStep: OrderStep.PAYMENT,
            };
        }
        if (!state.pickup && !state.deliveryAddress) {
            return {
                success: false,
                message: 'Please provide delivery address',
                nextStep: OrderStep.ADD_DELIVERY_INFO,
            };
        }
        // Calculate totals
        const subtotal = pendingOrder.items.reduce((sum, item) => sum + item.subtotal, 0);
        const tax = subtotal * 0.08; // 8% tax
        const deliveryFee = state.pickup ? 0 : 5.99;
        const tip = state.tip || 0;
        const total = subtotal + tax + deliveryFee + tip;
        // Update order
        const updateResult = await this.ordersCollection.findOneAndUpdate({ userId, status: OrderStatus.PENDING }, {
            $set: {
                status: OrderStatus.CONFIRMED,
                step: OrderStep.PLACED,
                deliveryAddress: state.deliveryAddress,
                pickup: state.pickup,
                paymentMethod: state.paymentMethod,
                tip,
                subtotal,
                tax,
                deliveryFee,
                total,
                placedAt: new Date(),
                updatedAt: new Date(),
            },
        }, { returnDocument: 'after' });
        // Clear flow state
        await this.clearFlowState(userId);
        if (!updateResult) {
            return { success: false, message: 'Failed to place order. Please try again.' };
        }
        return {
            success: true,
            order: updateResult,
            message: `Order #${updateResult.id} placed successfully! Estimated ready time: ${updateResult.estimatedReadyTime?.toLocaleTimeString() || '15-20 minutes'}`,
            nextStep: OrderStep.PLACED,
        };
    }
    /**
     * Cancel order
     */
    async cancelOrder(userId, orderId) {
        if (!this.ordersCollection) {
            return { success: false, message: 'Order service not initialized' };
        }
        const query = { userId, status: { $in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] } };
        if (orderId) {
            query.id = orderId;
        }
        const result = await this.ordersCollection.findOneAndUpdate(query, {
            $set: {
                status: OrderStatus.CANCELLED,
                updatedAt: new Date(),
            },
        }, { returnDocument: 'after' });
        if (!result) {
            return { success: false, message: 'No cancellable order found' };
        }
        // Clear flow state
        await this.clearFlowState(userId);
        return {
            success: true,
            order: result,
            message: 'Order cancelled successfully',
        };
    }
    /**
     * Modify pending order item
     */
    async modifyOrderItem(userId, orderItemId, modifications) {
        if (!this.ordersCollection) {
            return { success: false, message: 'Order service not initialized' };
        }
        const order = await this.ordersCollection.findOne({
            userId,
            status: OrderStatus.PENDING,
        });
        if (!order) {
            return { success: false, message: 'No active order found' };
        }
        const itemIndex = order.items.findIndex(item => item.id === orderItemId);
        if (itemIndex === -1) {
            return { success: false, message: 'Item not found in order' };
        }
        const item = order.items[itemIndex];
        // Update item
        if (modifications.quantity !== undefined) {
            item.quantity = modifications.quantity;
        }
        if (modifications.customizations !== undefined) {
            item.customizations = modifications.customizations;
        }
        if (modifications.specialInstructions !== undefined) {
            item.specialInstructions = modifications.specialInstructions;
        }
        // Recalculate subtotal
        const customizationTotal = item.customizations.reduce((sum, c) => sum + c.priceAdjustment, 0);
        item.subtotal = (item.price + customizationTotal) * item.quantity;
        order.items[itemIndex] = item;
        // Update order
        await this.ordersCollection.updateOne({ userId, status: OrderStatus.PENDING }, {
            $set: {
                items: order.items,
                updatedAt: new Date(),
            },
        });
        return {
            success: true,
            message: `Updated ${item.name} in your order`,
        };
    }
    /**
     * Remove item from order
     */
    async removeOrderItem(userId, orderItemId) {
        if (!this.ordersCollection) {
            return { success: false, message: 'Order service not initialized' };
        }
        const order = await this.ordersCollection.findOne({
            userId,
            status: OrderStatus.PENDING,
        });
        if (!order) {
            return { success: false, message: 'No active order found' };
        }
        const itemIndex = order.items.findIndex(item => item.id === orderItemId);
        if (itemIndex === -1) {
            return { success: false, message: 'Item not found in order' };
        }
        const removedItem = order.items[itemIndex];
        order.items.splice(itemIndex, 1);
        if (order.items.length === 0) {
            // Cancel order if no items left
            return this.cancelOrder(userId);
        }
        await this.ordersCollection.updateOne({ userId, status: OrderStatus.PENDING }, {
            $set: {
                items: order.items,
                updatedAt: new Date(),
            },
        });
        return {
            success: true,
            message: `Removed ${removedItem.name} from your order`,
        };
    }
    /**
     * Get current order status
     */
    async getOrderStatus(userId, orderId) {
        if (!this.ordersCollection)
            return null;
        const query = { userId };
        if (orderId) {
            query.id = orderId;
        }
        else {
            query.status = { $in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY] };
        }
        return this.ordersCollection.findOne(query, { sort: { createdAt: -1 } });
    }
    /**
     * Get order history
     */
    async getOrderHistory(userId, limit = 10) {
        if (!this.ordersCollection)
            return [];
        return this.ordersCollection
            .find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();
    }
    // Helper methods
    async getFlowState(userId) {
        if (!this.flowStateCollection)
            return null;
        const cached = await this.redis?.get(`orderflow:${userId}`);
        if (cached) {
            return JSON.parse(cached);
        }
        const state = await this.flowStateCollection.findOne({ userId });
        if (state && this.redis) {
            await this.redis.set(`orderflow:${userId}`, JSON.stringify(state), 'EX', this.FLOW_STATE_TTL);
        }
        return state;
    }
    async saveFlowState(state) {
        if (!this.flowStateCollection)
            return;
        await this.flowStateCollection.updateOne({ userId: state.userId }, { $set: state }, { upsert: true });
        if (this.redis) {
            await this.redis.set(`orderflow:${state.userId}`, JSON.stringify(state), 'EX', this.FLOW_STATE_TTL);
        }
    }
    async clearFlowState(userId) {
        if (!this.flowStateCollection)
            return;
        await this.flowStateCollection.deleteOne({ userId });
        if (this.redis) {
            await this.redis.del(`orderflow:${userId}`);
        }
    }
    formatOrderSummary(order) {
        const lines = [`Order #${order.id}:`, ...order.items.map(item => `  - ${item.quantity}x ${item.name} = $${item.subtotal.toFixed(2)}`)];
        return lines.join('\n');
    }
    /**
     * Validate order state transitions
     */
    canTransition(from, to) {
        const validTransitions = {
            [OrderStep.START]: [OrderStep.SELECT_ITEMS],
            [OrderStep.SELECT_ITEMS]: [OrderStep.CUSTOMIZE_ITEM, OrderStep.REVIEW_ORDER],
            [OrderStep.CUSTOMIZE_ITEM]: [OrderStep.SELECT_ITEMS, OrderStep.REVIEW_ORDER],
            [OrderStep.REVIEW_ORDER]: [OrderStep.SELECT_ITEMS, OrderStep.ADD_DELIVERY_INFO, OrderStep.CONFIRM_ORDER],
            [OrderStep.ADD_DELIVERY_INFO]: [OrderStep.CONFIRM_ORDER, OrderStep.REVIEW_ORDER],
            [OrderStep.CONFIRM_ORDER]: [OrderStep.PAYMENT, OrderStep.REVIEW_ORDER],
            [OrderStep.PAYMENT]: [OrderStep.PLACED, OrderStep.CONFIRM_ORDER],
            [OrderStep.PLACED]: [OrderStep.COMPLETED],
            [OrderStep.COMPLETED]: [],
        };
        return validTransitions[from]?.includes(to) ?? false;
    }
}
exports.OrderFlowHandler = OrderFlowHandler;
// Singleton instance
let orderFlowHandler = null;
function getOrderFlowHandler() {
    if (!orderFlowHandler) {
        orderFlowHandler = new OrderFlowHandler();
    }
    return orderFlowHandler;
}
//# sourceMappingURL=orderFlow.js.map