import mongoose, { Schema, Document } from 'mongoose';
import {
  SessionState,
  CartItem,
  MessageRecord,
  ConversationContext,
} from '../types/whatsapp';

export interface ISession extends Document {
  _id: mongoose.Types.ObjectId;
  sessionId: string;
  userId: string;
  merchantId?: string;
  phoneNumber: string;
  state: SessionState;
  context: ConversationContext;
  lastActivity: Date;
  createdAt: Date;
  expiresAt: Date;
  metadata: Record<string, unknown>;
  addToCart(item: CartItem): void;
  updateCartItem(productId: string, quantity: number): void;
  removeFromCart(productId: string): void;
  clearCart(): void;
  addMessage(role: 'user' | 'assistant' | 'system', content: string, messageId: string): void;
  getCartTotal(): number;
}

const CartItemSchema = new Schema<CartItem>(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    imageUrl: { type: String },
    variant: { type: Map, of: String },
    merchantId: { type: String, required: true },
  },
  { _id: false }
);

const MessageRecordSchema = new Schema<MessageRecord>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    messageId: { type: String, required: true },
  },
  { _id: false }
);

const ConversationContextSchema = new Schema<ConversationContext>(
  {
    cart: { type: [CartItemSchema], default: [] },
    currentProduct: {
      id: String,
      name: String,
      price: Number,
      imageUrl: String,
    },
    currentOrder: {
      id: String,
      status: String,
    },
    lastIntent: String,
    searchQuery: String,
    selectedCategory: String,
    conversationHistory: { type: [MessageRecordSchema], default: [] },
  },
  { _id: false }
);

const SessionSchema = new Schema<ISession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    merchantId: {
      type: String,
      index: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      enum: Object.values(SessionState),
      default: SessionState.IDLE,
    },
    context: {
      type: ConversationContextSchema,
      default: () => ({
        cart: [],
        conversationHistory: [],
      }),
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

// Indexes for efficient queries
SessionSchema.index({ userId: 1, merchantId: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
SessionSchema.index({ state: 1, lastActivity: 1 });

// Pre-save middleware to update lastActivity
SessionSchema.pre('save', function (next) {
  this.lastActivity = new Date();
  next();
});

// Instance methods
SessionSchema.methods.addToCart = function (item: CartItem): void {
  const existingIndex = this.context.cart.findIndex(
    (cartItem) => cartItem.productId === item.productId
  );

  if (existingIndex >= 0) {
    this.context.cart[existingIndex].quantity += item.quantity;
  } else {
    this.context.cart.push(item);
  }
};

SessionSchema.methods.updateCartItem = function (
  productId: string,
  quantity: number
): boolean {
  const item = this.context.cart.find((i) => i.productId === productId);
  if (!item) return false;

  if (quantity <= 0) {
    this.context.cart = this.context.cart.filter(
      (i) => i.productId !== productId
    );
  } else {
    item.quantity = quantity;
  }
  return true;
};

SessionSchema.methods.removeFromCart = function (productId: string): boolean {
  const initialLength = this.context.cart.length;
  this.context.cart = this.context.cart.filter(
    (i) => i.productId !== productId
  );
  return this.context.cart.length < initialLength;
};

SessionSchema.methods.clearCart = function (): void {
  this.context.cart = [];
};

SessionSchema.methods.getCartTotal = function (): number {
  return this.context.cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
};

SessionSchema.methods.addMessage = function (
  role: 'user' | 'assistant' | 'system',
  content: string,
  messageId: string
): void {
  this.context.conversationHistory.push({
    role,
    content,
    timestamp: new Date(),
    messageId,
  });

  // Keep only last 50 messages to prevent unbounded growth
  if (this.context.conversationHistory.length > 50) {
    this.context.conversationHistory =
      this.context.conversationHistory.slice(-50);
  }
};

// Static methods
SessionSchema.statics.findActiveByUser = function (
  userId: string,
  merchantId?: string
): Promise<ISession | null> {
  const query: Record<string, unknown> = {
    userId,
    expiresAt: { $gt: new Date() },
  };
  if (merchantId) {
    query.merchantId = merchantId;
  }
  return this.findOne(query).sort({ lastActivity: -1 });
};

SessionSchema.statics.findOrCreate = async function (
  sessionId: string,
  data: {
    userId: string;
    merchantId?: string;
    phoneNumber: string;
    sessionTimeoutHours?: number;
  }
): Promise<ISession> {
  const sessionTimeoutHours = data.sessionTimeoutHours || 24;
  const expiresAt = new Date(Date.now() + sessionTimeoutHours * 60 * 60 * 1000);

  let session = await this.findOne({ sessionId });

  if (!session) {
    session = await this.create({
      sessionId,
      userId: data.userId,
      merchantId: data.merchantId,
      phoneNumber: data.phoneNumber,
      state: SessionState.IDLE,
      context: { cart: [], conversationHistory: [] },
      lastActivity: new Date(),
      expiresAt,
    });
  }

  return session;
};

export const Session = mongoose.model<ISession>('Session', SessionSchema);
export default Session;
