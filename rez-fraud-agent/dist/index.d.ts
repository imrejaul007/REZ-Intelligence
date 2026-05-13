import { Application } from 'express';
import { RedisClientType } from 'redis';
declare let redisClient: RedisClientType | null;
declare const app: Application;
export { app, redisClient };
//# sourceMappingURL=index.d.ts.map