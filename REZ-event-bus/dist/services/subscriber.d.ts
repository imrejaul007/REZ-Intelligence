/**
 * Subscriber Service
 * Manages event subscriptions and delivery
 */
import { ISubscription, SubscriptionCreatePayload, SubscriptionUpdatePayload, DeliveryResult } from '../models/Subscription';
import { IEvent } from '../models/Event';
/**
 * Delivery Handler Function
 */
export type DeliveryHandler = (event: IEvent, subscription: ISubscription) => Promise<DeliveryResult>;
/**
 * Subscriber Service
 */
export declare class SubscriberService {
    private subscriptions;
    private eventTypeSubscriptions;
    private subscriberRedis;
    private deliveryHandlers;
    private isRunning;
    constructor();
    /**
     * Initialize the subscriber service
     */
    initialize(): Promise<void>;
    /**
     * Load subscriptions from Redis
     */
    private loadSubscriptions;
    /**
     * Add subscription to internal maps
     */
    private addSubscriptionToMaps;
    /**
     * Create a new subscription
     */
    subscribe(payload: SubscriptionCreatePayload): Promise<ISubscription>;
    /**
     * Update an existing subscription
     */
    updateSubscription(subscriptionId: string, updates: SubscriptionUpdatePayload): Promise<ISubscription>;
    /**
     * Delete a subscription
     */
    unsubscribe(subscriptionId: string): Promise<void>;
    /**
     * Get subscription by ID
     */
    getSubscription(subscriptionId: string): ISubscription | undefined;
    /**
     * Get subscriptions by subscriber ID
     */
    getSubscriptionsBySubscriber(subscriberId: string): ISubscription[];
    /**
     * Get subscriptions by event type
     */
    getSubscriptionsByEventType(eventType: string): ISubscription[];
    /**
     * Register a delivery handler
     */
    registerDeliveryHandler(name: string, handler: DeliveryHandler): void;
    /**
     * Handle incoming event
     */
    handleEvent(event: IEvent): Promise<DeliveryResult[]>;
    /**
     * Deliver event to subscription
     */
    private deliverEvent;
    /**
     * Check if event matches subscription filter
     */
    private matchesFilter;
    /**
     * Get nested value from object
     */
    private getNestedValue;
    /**
     * Update subscription in Redis
     */
    private updateSubscriptionInRedis;
    /**
     * Get service statistics
     */
    getStats(): {
        totalSubscriptions: number;
        activeSubscriptions: number;
        pausedSubscriptions: number;
        failedSubscriptions: number;
        subscriptionsByEventType: Record<string, number>;
    };
    /**
     * Shutdown service
     */
    shutdown(): Promise<void>;
}
export declare const subscriberService: SubscriberService;
export default subscriberService;
//# sourceMappingURL=subscriber.d.ts.map