export declare const config: {
    readonly port: number;
    readonly nodeEnv: string;
    readonly mongodb: {
        readonly uri: string;
        readonly options: {
            readonly maxPoolSize: 10;
            readonly serverSelectionTimeoutMS: 5000;
            readonly socketTimeoutMS: 45000;
        };
    };
    readonly redis: {
        readonly url: string;
        readonly keyPrefix: "rez:context:";
    };
    readonly internalServiceTokens: any;
    readonly logging: {
        readonly level: string;
        readonly format: string;
    };
    readonly cors: {
        readonly origins: string[];
    };
    readonly rateLimit: {
        readonly windowMs: number;
        readonly maxRequests: number;
    };
};
export type Config = typeof config;
//# sourceMappingURL=index.d.ts.map