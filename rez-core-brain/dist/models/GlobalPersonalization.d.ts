import mongoose, { Document, Model } from 'mongoose';
import { IUserPreferences, ILoyaltyProfile, IContextualData, IIntelligenceMetrics } from '../types';
export declare enum Tone {
    FORMAL = "formal",
    CASUAL = "casual",
    FRIENDLY = "friendly",
    PROFESSIONAL = "professional"
}
export declare enum PrivacyLevel {
    STRICT = "strict",
    BALANCED = "balanced",
    OPEN = "open"
}
export declare enum LoyaltyTier {
    BRONZE = "bronze",
    SILVER = "silver",
    GOLD = "gold",
    PLATINUM = "platinum",
    DIAMOND = "diamond"
}
export interface IUserPreferencesDocument extends IUserPreferences, Document {
    _id: mongoose.Types.ObjectId;
    updatePreference(key: string, value: unknown): Promise<void>;
    resetToDefaults(): Promise<void>;
}
declare const userPreferencesSchema: mongoose.Schema<IUserPreferencesDocument, mongoose.Model<IUserPreferencesDocument, any, any, any, mongoose.Document<unknown, any, IUserPreferencesDocument, any, {}> & IUserPreferencesDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, IUserPreferencesDocument, mongoose.Document<unknown, {}, mongoose.FlatRecord<IUserPreferencesDocument>, {}, mongoose.DefaultSchemaOptions> & mongoose.FlatRecord<IUserPreferencesDocument> & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}>;
export interface ILoyaltyProfileDocument extends ILoyaltyProfile, Document {
    _id: mongoose.Types.ObjectId;
    addPoints(points: number): Promise<void>;
    deductPoints(points: number): Promise<boolean>;
    upgradeTier(): Promise<void>;
    calculateLifetimeValue(): Promise<void>;
}
declare const loyaltyProfileSchema: mongoose.Schema<ILoyaltyProfileDocument, mongoose.Model<ILoyaltyProfileDocument, any, any, any, mongoose.Document<unknown, any, ILoyaltyProfileDocument, any, {}> & ILoyaltyProfileDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, ILoyaltyProfileDocument, mongoose.Document<unknown, {}, mongoose.FlatRecord<ILoyaltyProfileDocument>, {}, mongoose.DefaultSchemaOptions> & mongoose.FlatRecord<ILoyaltyProfileDocument> & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}>;
export interface IContextualDataDocument extends IContextualData, Document {
    _id: mongoose.Types.ObjectId;
    updateActivity(action: string, agent: string): Promise<void>;
    addActiveAgent(agentId: string): Promise<void>;
    removeActiveAgent(agentId: string): Promise<void>;
    addIntent(intent: string): Promise<void>;
}
declare const contextualDataSchema: mongoose.Schema<IContextualDataDocument, mongoose.Model<IContextualDataDocument, any, any, any, mongoose.Document<unknown, any, IContextualDataDocument, any, {}> & IContextualDataDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, IContextualDataDocument, mongoose.Document<unknown, {}, mongoose.FlatRecord<IContextualDataDocument>, {}, mongoose.DefaultSchemaOptions> & mongoose.FlatRecord<IContextualDataDocument> & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}>;
export interface IIntelligenceMetricsDocument extends IIntelligenceMetrics, Document {
    _id: mongoose.Types.ObjectId;
    recalculate(): Promise<void>;
}
declare const intelligenceMetricsSchema: mongoose.Schema<IIntelligenceMetricsDocument, mongoose.Model<IIntelligenceMetricsDocument, any, any, any, mongoose.Document<unknown, any, IIntelligenceMetricsDocument, any, {}> & IIntelligenceMetricsDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, IIntelligenceMetricsDocument, mongoose.Document<unknown, {}, mongoose.FlatRecord<IIntelligenceMetricsDocument>, {}, mongoose.DefaultSchemaOptions> & mongoose.FlatRecord<IIntelligenceMetricsDocument> & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}>;
export declare const UserPreferences: Model<IUserPreferencesDocument>;
export declare const LoyaltyProfile: Model<ILoyaltyProfileDocument>;
export declare const ContextualData: Model<IContextualDataDocument>;
export declare const IntelligenceMetrics: Model<IIntelligenceMetricsDocument>;
export { userPreferencesSchema, loyaltyProfileSchema, contextualDataSchema, intelligenceMetricsSchema, };
declare const _default: {
    UserPreferences: mongoose.Model<IUserPreferencesDocument, {}, {}, {}, mongoose.Document<unknown, {}, IUserPreferencesDocument, {}, {}> & IUserPreferencesDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    LoyaltyProfile: mongoose.Model<ILoyaltyProfileDocument, {}, {}, {}, mongoose.Document<unknown, {}, ILoyaltyProfileDocument, {}, {}> & ILoyaltyProfileDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    ContextualData: mongoose.Model<IContextualDataDocument, {}, {}, {}, mongoose.Document<unknown, {}, IContextualDataDocument, {}, {}> & IContextualDataDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    IntelligenceMetrics: mongoose.Model<IIntelligenceMetricsDocument, {}, {}, {}, mongoose.Document<unknown, {}, IIntelligenceMetricsDocument, {}, {}> & IIntelligenceMetricsDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
};
export default _default;
//# sourceMappingURL=GlobalPersonalization.d.ts.map