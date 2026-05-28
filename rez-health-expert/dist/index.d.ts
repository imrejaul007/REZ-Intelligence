/**
 * REZ Health Expert Agent
 * Main entry point with TypeScript, Zod validation, and proper error handling
 */
import { Express } from 'express';
import { ServiceConfig } from './types/index';
declare const config: ServiceConfig;
declare const app: Express;
declare function startServer(): void;
export { app, startServer, config };
//# sourceMappingURL=index.d.ts.map