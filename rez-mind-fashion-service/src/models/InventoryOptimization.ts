import mongoose, { Schema, model, Document } from 'mongoose';
import { IInventoryOptimization } from '../types';

export interface InventoryOptimizationDocument extends Omit<IInventoryOptimization, '_id'>, Document {}

const inventoryOptimizationSchema = new Schema<InventoryOptimizationDocument>({
  optimizationId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  productId: String,
  category: { type: String, required: true, index: true },
  currentStock: { type: Number, required: true },
  recommendation: {
    type: { type: String, enum: ['reorder', 'discount', 'maintain', 'discontinue'], required: true },
    quantity: Number,
    suggestedPrice: Number,
    urgency: { type: String, enum: ['low', 'medium', 'high'], required: true },
    reason: String,
  },
  forecast: {
    demand: Number,
    daysUntilStockout: Number,
    confidence: Number,
  },
  alternatives: [{
    productId: String,
    name: String,
    score: Number,
  }],
}, { timestamps: true });

inventoryOptimizationSchema.pre('save', function (next) {
  if (!this.optimizationId) this.optimizationId = `INO-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  next();
});

inventoryOptimizationSchema.set('toJSON', { virtuals: true, transform: (_doc, ret) => { delete ret._id; delete ret.__v; return ret; } });

export const InventoryOptimization = model<InventoryOptimizationDocument>('InventoryOptimization', inventoryOptimizationSchema);