import mongoose, { Document, Model } from 'mongoose';
import { ISession } from '../types';
export declare enum SessionState {
    ACTIVE = "active",
    PAUSED = "paused",
    ENDED = "ended"
}
export interface ISessionDocument extends ISession, Document {
    _id: mongoose.Types.ObjectId;
    touch(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    end(): Promise<void>;
    addContext(key: string, value: unknown): Promise<void>;
    removeContext(key: string): Promise<void>;
}
interface ISessionModel extends Model<ISessionDocument> {
    findActiveByUser(userId: string): Promise<ISessionDocument | null>;
    findByUser(userId: string, options?: {
        state?: SessionState;
        limit?: number;
        skip?: number;
    }): Promise<ISessionDocument[]>;
    findOrCreate(userId: string, agentId?: string): Promise<ISessionDocument>;
    endAllActive(userId: string): Promise<number>;
    cleanupStaleSessions(ttlSeconds: number): Promise<number>;
    getActiveCount(userId: string): Promise<number>;
}
export declare const Session: ISessionModel;
export default Session;
//# sourceMappingURL=SessionContext.d.ts.map