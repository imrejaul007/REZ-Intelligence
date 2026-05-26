import mongoose, { Document, Model } from 'mongoose';
import { IMemoryEntry } from '../types';
export declare enum MemoryType {
    SHORT_TERM = "short_term",
    LONG_TERM = "long_term",
    EPISODIC = "episodic",
    SEMANTIC = "semantic"
}
export interface IMemoryDocument extends IMemoryEntry, Document {
    _id: mongoose.Types.ObjectId;
    access(): Promise<void>;
    incrementAccess(): Promise<void>;
}
export interface IMemoryModel extends Model<IMemoryDocument> {
    deleteExpired(): Promise<number>;
    findByUser(userId: string, options?: {
        type?: MemoryType;
        limit?: number;
        skip?: number;
    }): Promise<IMemoryDocument[]>;
}
export declare const Memory: IMemoryModel;
export default Memory;
//# sourceMappingURL=UserMemory.d.ts.map