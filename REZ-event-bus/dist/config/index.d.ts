/**
 * Configuration Module
 * Centralized configuration management with environment variables
 */
export declare const config: {
    readonly server: {
        readonly port: number;
        readonly nodeEnv: string;
        readonly corsOrigins: string[];
    };
    readonly redis: {
        readonly url: string;
        readonly keyPrefix: string;
        readonly maxRetriesPerRequest: 3;
        readonly retryStrategy: (times: number) => number | null;
    };
    readonly kafka: {
        readonly brokers: string[];
        readonly clientId: string;
        readonly groupId: string;
        readonly sessionTimeout: number;
        readonly heartbeatInterval: number;
        readonly topic: "rez-events";
        readonly consumer: {
            readonly sessionTimeout: number;
            readonly heartbeatInterval: number;
        };
        readonly producer: {
            readonly allowAutoTopicCreation: true;
            readonly transactionTimeout: 30000;
        };
    };
    readonly auth: {
        readonly internalServiceTokens: Record<string, string>;
    };
    readonly logging: {
        readonly level: string;
        readonly format: string;
    };
    readonly eventBus: {
        readonly retentionHours: number;
        readonly maxPayloadSize: number;
        readonly maxSubscriptionsPerClient: number;
        readonly healthCheckInterval: number;
    };
};
export type Config = typeof config;
export type ServerConfig = typeof config.server;
export type RedisConfig = typeof config.redis;
export type KafkaConfig = typeof config.kafka;
export type AuthConfig = typeof config.auth;
export type LoggingConfig = typeof config.logging;
export type EventBusConfig = typeof config.eventBus;
export default config;
//# sourceMappingURL=index.d.ts.map