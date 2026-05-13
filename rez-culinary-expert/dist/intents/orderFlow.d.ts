/**
 * Order Flow Handler
 * Manages the state machine for order processing
 */
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import { MenuItem } from '../services/menuService.js';
export declare enum OrderStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    PREPARING = "preparing",
    READY = "ready",
    OUT_FOR_DELIVERY = "out_for_delivery",
    DELIVERED = "delivered",
    CANCELLED = "cancelled",
    REFUNDED = "refunded"
}
export declare enum OrderStep {
    START = "start",
    SELECT_ITEMS = "select_items",
    CUSTOMIZE_ITEM = "customize_item",
    REVIEW_ORDER = "review_order",
    ADD_DELIVERY_INFO = "add_delivery_info",
    CONFIRM_ORDER = "confirm_order",
    PAYMENT = "payment",
    PLACED = "placed",
    COMPLETED = "completed"
}
export interface OrderItem {
    id: string;
    itemId: string;
    name: string;
    price: number;
    quantity: number;
    customizations: {
        customizationId: string;
        customizationName: string;
        optionId: string;
        optionName: string;
        priceAdjustment: number;
    }[];
    specialInstructions?: string;
    subtotal: number;
}
export interface Order {
    id: string;
    userId: string;
    restaurantId: string;
    items: OrderItem[];
    status: OrderStatus;
    step: OrderStep;
    deliveryAddress?: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        instructions?: string;
    };
    pickup: boolean;
    subtotal: number;
    tax: number;
    deliveryFee: number;
    tip: number;
    total: number;
    paymentMethod?: 'card' | 'wallet' | 'cash';
    paymentStatus?: 'pending' | 'completed' | 'failed' | 'refunded';
    placedAt?: Date;
    estimatedReadyTime?: Date;
    actualReadyTime?: Date;
    deliveredAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface OrderFlowState {
    userId: string;
    restaurantId: string;
    currentStep: OrderStep;
    pendingItem?: {
        itemId: string;
        quantity: number;
        customizations: OrderItem['customizations'];
        specialInstructions?: string;
    };
    deliveryAddress?: Order['deliveryAddress'];
    pickup: boolean;
    tip?: number;
    paymentMethod?: 'card' | 'wallet' | 'cash';
}
export interface OrderFlowResult {
    success: boolean;
    state?: OrderFlowState;
    order?: Order;
    message: string;
    nextStep?: OrderStep;
    actions?: OrderFlowAction[];
}
export interface OrderFlowAction {
    type: 'add_item' | 'customize_item' | 'remove_item' | 'update_quantity' | 'continue' | 'cancel' | 'confirm' | 'modify';
    payload?: Record<string, unknown>;
}
export declare class OrderFlowHandler {
    private db;
    private redis;
    private ordersCollection;
    private flowStateCollection;
    private initialized;
    private readonly FLOW_STATE_TTL;
    initialize(mongoClient: MongoClient, redis: Redis): Promise<void>;
    /**
     * Start a new order flow
     */
    startOrder(userId: string, restaurantId: string): Promise<OrderFlowResult>;
    /**
     * Add item to order
     */
    addItem(userId: string, item: MenuItem, quantity?: number, customizations?: OrderItem['customizations'], specialInstructions?: string): Promise<OrderFlowResult>;
    /**
     * Review current order
     */
    reviewOrder(userId: string): Promise<{
        success: boolean;
        items: OrderItem[];
        subtotal: number;
        message: string;
    }>;
    /**
     * Set delivery or pickup preference
     */
    setDeliveryPreference(userId: string, pickup: boolean, address?: Order['deliveryAddress']): Promise<OrderFlowResult>;
    /**
     * Set payment method
     */
    setPaymentMethod(userId: string, method: 'card' | 'wallet' | 'cash'): Promise<OrderFlowResult>;
    /**
     * Set tip amount
     */
    setTip(userId: string, tip: number): Promise<OrderFlowResult>;
    /**
     * Place the order
     */
    placeOrder(userId: string): Promise<OrderFlowResult>;
    /**
     * Cancel order
     */
    cancelOrder(userId: string, orderId?: string): Promise<OrderFlowResult>;
    /**
     * Modify pending order item
     */
    modifyOrderItem(userId: string, orderItemId: string, modifications: {
        quantity?: number;
        customizations?: OrderItem['customizations'];
        specialInstructions?: string;
    }): Promise<OrderFlowResult>;
    /**
     * Remove item from order
     */
    removeOrderItem(userId: string, orderItemId: string): Promise<OrderFlowResult>;
    /**
     * Get current order status
     */
    getOrderStatus(userId: string, orderId?: string): Promise<Order | null>;
    /**
     * Get order history
     */
    getOrderHistory(userId: string, limit?: number): Promise<Order[]>;
    private getFlowState;
    private saveFlowState;
    private clearFlowState;
    private formatOrderSummary;
    /**
     * Validate order state transitions
     */
    canTransition(from: OrderStep, to: OrderStep): boolean;
}
export declare function getOrderFlowHandler(): OrderFlowHandler;
export type { OrderFlowHandler };
//# sourceMappingURL=orderFlow.d.ts.map