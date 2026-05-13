export declare const config: {
    NODE_ENV: "development" | "production" | "test";
    PORT: number;
    SERVICE_NAME: string;
    LOG_LEVEL: "error" | "warn" | "info" | "debug";
    MONGODB_URI: string;
    REDIS_URL: string;
    REDIS_DB: number;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    JWT_REFRESH_EXPIRES_IN: string;
    SHORT_TERM_MEMORY_TTL: number;
    LONG_TERM_MEMORY_RETENTION: number;
    MAX_SHORT_TERM_MEMORIES: number;
    EMBEDDING_MODEL: string;
    SESSION_TTL: number;
    MAX_CONCURRENT_SESSIONS: number;
    RATE_LIMIT_WINDOW: number;
    RATE_LIMIT_MAX: number;
    INTERNAL_SERVICE_TOKENS_JSON: string;
    CORS_ORIGINS: string;
    MONGODB_USER?: string | undefined;
    MONGODB_PASSWORD?: string | undefined;
    REDIS_PASSWORD?: string | undefined;
    OPENAI_API_KEY?: string | undefined;
    ANTHROPIC_API_KEY?: string | undefined;
};
export declare const isProduction: boolean;
export declare const isDevelopment: boolean;
export declare const isTest: boolean;
export declare function getMongoUri(): string;
export declare function getRedisConfig(): {
    url: string;
    password: string | undefined;
    db: number;
};
export declare function getInternalServiceTokens(): Record<string, string>;
export declare function getCorsOrigins(): string[];
export declare const paths: {
    root: string;
    dist: string;
    src: string;
};
export default config;
//# sourceMappingURL=index.d.ts.map