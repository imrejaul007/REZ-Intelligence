"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Memory = exports.MemoryType = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importStar(require("mongoose"));
// Memory types enum
var MemoryType;
(function (MemoryType) {
    MemoryType["SHORT_TERM"] = "short_term";
    MemoryType["LONG_TERM"] = "long_term";
    MemoryType["EPISODIC"] = "episodic";
    MemoryType["SEMANTIC"] = "semantic";
})(MemoryType || (exports.MemoryType = MemoryType = {}));
// Memory schema
const memorySchema = new mongoose_1.Schema({
    id: {
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
    type: {
        type: String,
        enum: Object.values(MemoryType),
        required: true,
        index: true,
    },
    content: {
        type: String,
        required: true,
    },
    embedding: {
        type: [Number],
        select: false, // Don't include in queries by default for performance
    },
    importance: {
        type: Number,
        required: true,
        min: 0,
        max: 10,
        default: 5,
    },
    accessCount: {
        type: Number,
        default: 0,
    },
    lastAccessed: {
        type: Date,
    },
    expiresAt: {
        type: Date,
        index: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    tags: {
        type: [String],
        index: true,
    },
    source: {
        type: String,
    },
}, {
    timestamps: true,
    collection: 'memories',
});
// Compound indexes for efficient queries
memorySchema.index({ userId: 1, type: 1 });
memorySchema.index({ userId: 1, createdAt: -1 });
memorySchema.index({ userId: 1, importance: -1 });
memorySchema.index({ userId: 1, tags: 1 });
memorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
// Virtual for checking if memory is expired
memorySchema.virtual('isExpired').get(function () {
    if (!this.expiresAt)
        return false;
    return new Date() > this.expiresAt;
});
// Virtual for age in hours
memorySchema.virtual('ageInHours').get(function () {
    const now = new Date();
    const created = this.createdAt;
    return (now.getTime() - created.getTime()) / (1000 * 60 * 60);
});
// Methods
memorySchema.methods.access = async function () {
    this.lastAccessed = new Date();
    await this.save();
};
memorySchema.methods.incrementAccess = async function () {
    this.accessCount += 1;
    this.lastAccessed = new Date();
    await this.save();
};
// Static methods
memorySchema.statics.findByUser = function (userId, options = {}) {
    const query = { userId };
    if (options.type) {
        query.type = options.type;
    }
    const sortField = options.sort?.field || 'createdAt';
    const sortOrder = options.sort?.order === 'asc' ? 1 : -1;
    return this.find(query)
        .sort({ [sortField]: sortOrder })
        .skip(options.skip || 0)
        .limit(options.limit || 50);
};
memorySchema.statics.findByTags = function (userId, tags, options = {}) {
    return this.find({
        userId,
        tags: { $in: tags },
    })
        .sort({ importance: -1, createdAt: -1 })
        .limit(options.limit || 50);
};
memorySchema.statics.findRecent = function (userId, limit = 10) {
    return this.find({ userId })
        .sort({ lastAccessed: -1, createdAt: -1 })
        .limit(limit);
};
memorySchema.statics.deleteExpired = async function () {
    const result = await this.deleteMany({
        expiresAt: { $lt: new Date() },
    });
    return result.deletedCount;
};
memorySchema.statics.consolidateMemories = async function (userId) {
    // Move high-importance short-term memories to long-term
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const result = await this.updateMany({
        userId,
        type: MemoryType.SHORT_TERM,
        importance: { $gte: 7 },
        createdAt: { $lt: thirtyDaysAgo },
    }, {
        $set: { type: MemoryType.LONG_TERM },
    });
    return result.modifiedCount;
};
// Pre-save hook for validation
memorySchema.pre('save', function (next) {
    // Auto-generate ID if not provided
    if (!this.id) {
        this.id = `${crypto_1.default.randomUUID()}`;
    }
    // Set default expiration for short-term memories
    if (this.type === MemoryType.SHORT_TERM && !this.expiresAt) {
        const ttl = parseInt(process.env.SHORT_TERM_MEMORY_TTL || '3600', 10);
        this.expiresAt = new Date(Date.now() + ttl * 1000);
    }
    next();
});
// Create and export model
exports.Memory = mongoose_1.default.model('Memory', memorySchema);
// Index for semantic search (vector operations would need MongoDB Atlas or a plugin)
memorySchema.index({ embedding: '2dsphere' });
exports.default = exports.Memory;
//# sourceMappingURL=UserMemory.js.map