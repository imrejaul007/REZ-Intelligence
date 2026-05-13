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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = exports.SessionState = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Session state enum
var SessionState;
(function (SessionState) {
    SessionState["ACTIVE"] = "active";
    SessionState["PAUSED"] = "paused";
    SessionState["ENDED"] = "ended";
})(SessionState || (exports.SessionState = SessionState = {}));
// Session schema
const sessionSchema = new mongoose_1.Schema({
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
    agentId: {
        type: String,
        index: true,
    },
    startTime: {
        type: Date,
        required: true,
        default: Date.now,
    },
    endTime: {
        type: Date,
    },
    context: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    state: {
        type: String,
        enum: Object.values(SessionState),
        default: SessionState.ACTIVE,
        index: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
    },
}, {
    timestamps: true,
    collection: 'sessions',
});
// Compound indexes
sessionSchema.index({ userId: 1, state: 1 });
sessionSchema.index({ userId: 1, startTime: -1 });
sessionSchema.index({ agentId: 1, state: 1 });
sessionSchema.index({ endTime: 1 }, { expireAfterSeconds: 0 }); // Auto-cleanup
// Virtuals
sessionSchema.virtual('duration').get(function () {
    if (!this.endTime) {
        return Date.now() - this.startTime.getTime();
    }
    return this.endTime.getTime() - this.startTime.getTime();
});
sessionSchema.virtual('isActive').get(function () {
    return this.state === SessionState.ACTIVE;
});
sessionSchema.virtual('isPaused').get(function () {
    return this.state === SessionState.PAUSED;
});
// Methods
sessionSchema.methods.touch = async function () {
    this.startTime = new Date();
    await this.save();
};
sessionSchema.methods.pause = async function () {
    if (this.state !== SessionState.ACTIVE) {
        throw new Error(`Cannot pause session in state: ${this.state}`);
    }
    this.state = SessionState.PAUSED;
    await this.save();
};
sessionSchema.methods.resume = async function () {
    if (this.state !== SessionState.PAUSED) {
        throw new Error(`Cannot resume session in state: ${this.state}`);
    }
    this.state = SessionState.ACTIVE;
    await this.save();
};
sessionSchema.methods.end = async function () {
    if (this.state === SessionState.ENDED) {
        throw new Error('Session is already ended');
    }
    this.state = SessionState.ENDED;
    this.endTime = new Date();
    await this.save();
};
sessionSchema.methods.addContext = async function (key, value) {
    this.context = {
        ...this.context,
        [key]: value,
    };
    await this.save();
};
sessionSchema.methods.removeContext = async function (key) {
    const context = this.context;
    delete context[key];
    this.context = context;
    await this.save();
};
// Static methods
sessionSchema.statics.findActiveByUser = function (userId) {
    return this.findOne({
        userId,
        state: SessionState.ACTIVE,
    }).sort({ startTime: -1 });
};
sessionSchema.statics.findByUser = function (userId, options = {}) {
    const query = { userId };
    if (options.state) {
        query.state = options.state;
    }
    return this.find(query)
        .sort({ startTime: -1 })
        .skip(options.skip || 0)
        .limit(options.limit || 20);
};
sessionSchema.statics.findOrCreate = async function (userId, agentId) {
    let session = await this.findActiveByUser(userId);
    if (!session) {
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        session = await this.create({
            id: sessionId,
            userId,
            agentId,
            startTime: new Date(),
            state: SessionState.ACTIVE,
            context: {},
        });
    }
    return session;
};
sessionSchema.statics.endAllActive = async function (userId) {
    const result = await this.updateMany({
        userId,
        state: SessionState.ACTIVE,
    }, {
        $set: {
            state: SessionState.ENDED,
            endTime: new Date(),
        },
    });
    return result.modifiedCount;
};
sessionSchema.statics.cleanupStaleSessions = async function (ttlSeconds) {
    const cutoff = new Date(Date.now() - ttlSeconds * 1000);
    const result = await this.updateMany({
        state: SessionState.ACTIVE,
        startTime: { $lt: cutoff },
    }, {
        $set: {
            state: SessionState.ENDED,
            endTime: new Date(),
        },
    });
    return result.modifiedCount;
};
sessionSchema.statics.getActiveCount = async function (userId) {
    return this.countDocuments({
        userId,
        state: SessionState.ACTIVE,
    });
};
// Pre-save hook
sessionSchema.pre('save', function (next) {
    if (!this.id) {
        this.id = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    next();
});
// Create and export model
exports.Session = mongoose_1.default.model('Session', sessionSchema);
exports.default = exports.Session;
//# sourceMappingURL=SessionContext.js.map