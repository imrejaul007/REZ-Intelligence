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
export declare const Session: Model<ISessionDocument>;
export default Session;
//# sourceMappingURL=SessionContext.d.ts.map