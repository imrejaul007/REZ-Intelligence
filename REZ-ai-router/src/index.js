'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { createClient } = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const logger = require('../shared/logger');
const { errorHandler, asyncHandler } = require('../shared/errorHandler');

// Environment validation
const REQUIRED_ENV = ['REDIS_URL', 'INTERNAL_SERVICE_TOKEN'];
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    console.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// AI Providers
const PROVIDERS = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  GOOGLE: 'google',
  LOCAL: 'local'
};

// Model tiers for cost optimization
const MODEL_TIERS = {
  FAST: 'fast', // Cheapest, fastest (haiku, gpt-3.5-turbo)
  BALANCED: 'balanced', // Mid-tier (sonnet, gpt-4o-mini)
  POWERFUL: 'powerful', // Most capable (opus, gpt-4o)
  MAX: 'max' // Most expensive (o1, gpt-4-turbo)
};

// Default models per provider
const DEFAULT_MODELS = {
  [PROVIDERS.ANTHROPIC]: {
    [MODEL_TIERS.FAST]: 'claude-3-5-haiku-20241022',
    [MODEL_TIERS.BALANCED]: 'claude-3-5-sonnet-20241022',
    [MODEL_TIERS.POWERFUL]: 'claude-3-5-opus-20241022',
    [MODEL_TIERS.MAX]: 'claude-3-5-opus-20241022'
  },
  [PROVIDERS.OPENAI]: {
    [MODEL_TIERS.FAST]: 'gpt-4o-mini',
    [MODEL_TIERS.BALANCED]: 'gpt-4o-mini',
    [MODEL_TIERS.POWERFUL]: 'gpt-4o',
    [MODEL_TIERS.MAX]: 'gpt-4-turbo'
  },
  [PROVIDERS.GOOGLE]: {
    [MODEL_TIERS.FAST]: 'gemini-1.5-flash',
    [MODEL_TIERS.BALANCED]: 'gemini-1.5-flash',
    [MODEL_TIERS.POWERFUL]: 'gemini-1.5-pro',
    [MODEL_TIERS.MAX]: 'gemini-1.5-pro'
  }
};

// Cost per 1M tokens (approximate)
const MODEL_COSTS = {
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-opus-20241022': { input: 15, output: 75 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-pro': { input: 1.25, output: 5 }
};

// MongoDB Schema for tracking
const requestLogSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true, index: true },
  userId: String,
  provider: String,
  model: String,
  tier: String,
  prompt: String,
  promptTokens: Number,
  completionTokens: Number,
  totalTokens: Number,
  cost: Number,
  latency: Number,
  status: { type: String, enum: ['success', 'error', 'fallback'], default: 'success' },
  error: String,
  fallbackUsed: Boolean,
  fallbackFrom: String,
  fallbackTo: String
}, { timestamps: true });

requestLogSchema.index({ userId: 1, createdAt: -1 });
requestLogSchema.index({ provider: 1, createdAt: -1 });
requestLogSchema.index({ cost: 1 });

const RequestLog = mongoose.model('RequestLog', requestLogSchema);

// AI Router class
class AIRouter {
  constructor() {
    this.redis = null;
    this.keyIndex = {};
  }

  async init() {
    try {
      this.redis = createClient({ url: process.env.REDIS_URL });
      this.redis.on('error', err => logger.error('Redis error', { error: err.message }));
      await this.redis.connect();

      // Load API keys from env
      this.loadKeys();
      logger.info('AI Router initialized');
    } catch (err) {
      logger.warn('Redis connection failed', { error: err.message });
    }
  }

  loadKeys() {
    // Support multiple keys for rotation
    const anthropicKeys = this.parseKeys(process.env.ANTHROPIC_API_KEYS || process.env.ANTHROPIC_API_KEY);
    const openaiKeys = this.parseKeys(process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY);

    this.keyIndex = {
      [PROVIDERS.ANTHROPIC]: { keys: anthropicKeys, current: 0 },
      [PROVIDERS.OPENAI]: { keys: openaiKeys, current: 0 }
    };
  }

  parseKeys(keys) {
    if (!keys) return [];
    if (typeof keys === 'string') {
      return keys.split(',').map(k => k.trim()).filter(Boolean);
    }
    return keys;
  }

  // Get next key (round-robin)
  getNextKey(provider) {
    const providerKeys = this.keyIndex[provider];
    if (!providerKeys || providerKeys.keys.length === 0) {
      return null;
    }
    const key = providerKeys.keys[providerKeys.current];
    providerKeys.current = (providerKeys.current + 1) % providerKeys.keys.length;
    return key;
  }

  // Route request to appropriate model
  async route(options) {
    const {
      userId,
      prompt,
      systemPrompt,
      tier = MODEL_TIERS.BALANCED,
      preferredProvider,
      fallback = true,
      maxCost = 1.0,
      timeout = 60000
    } = options;

    const requestId = uuidv4();
    const startTime = Date.now();

    // Select provider
    let provider = preferredProvider || PROVIDERS.ANTHROPIC;

    // Get model
    let model = DEFAULT_MODELS[provider]?.[tier];

    // If preferred provider fails, try fallback
    if (fallback) {
      const providers = [provider, ...Object.values(PROVIDERS).filter(p => p !== provider)];

      for (const p of providers) {
        try {
          const result = await this.callProvider(p, model, prompt, systemPrompt, {
            requestId,
            userId,
            timeout
          });

          // Log success
          await this.logRequest({
            ...result,
            requestId,
            userId,
            provider: p,
            model,
            tier,
            latency: Date.now() - startTime,
            status: 'success'
          });

          return result;
        } catch (err) {
          logger.warn(`Provider ${p} failed, trying fallback`, {
            requestId,
            error: err.message
          });

          // Try next provider
          const nextModel = DEFAULT_MODELS[p]?.[tier];
          if (nextModel && p !== provider) {
            model = nextModel;
          }
        }
      }
    } else {
      try {
        const result = await this.callProvider(provider, model, prompt, systemPrompt, {
          requestId,
          userId,
          timeout
        });

        await this.logRequest({
          ...result,
          requestId,
          userId,
          provider,
          model,
          tier,
          latency: Date.now() - startTime,
          status: 'success'
        });

        return result;
      } catch (err) {
        await this.logRequest({
          requestId,
          userId,
          provider,
          model,
          tier,
          latency: Date.now() - startTime,
          status: 'error',
          error: err.message
        });
        throw err;
      }
    }

    throw new Error('All AI providers failed');
  }

  // Call specific provider
  async callProvider(provider, model, prompt, systemPrompt, options = {}) {
    const { requestId, userId, timeout } = options;

    switch (provider) {
      case PROVIDERS.ANTHROPIC:
        return this.callAnthropic(model, prompt, systemPrompt, requestId, timeout);
      case PROVIDERS.OPENAI:
        return this.callOpenAI(model, prompt, systemPrompt, requestId, timeout);
      case PROVIDERS.GOOGLE:
        return this.callGoogle(model, prompt, systemPrompt, requestId, timeout);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async callAnthropic(model, prompt, systemPrompt, requestId, timeout) {
    const apiKey = this.getNextKey(PROVIDERS.ANTHROPIC);
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        timeout
      }
    );

    const usage = response.data.usage;
    const cost = this.calculateCost(model, usage.input_tokens, usage.output_tokens);

    return {
      content: response.data.content[0].text,
      provider: PROVIDERS.ANTHROPIC,
      model,
      promptTokens: usage.input_tokens,
      completionTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
      cost,
      stopReason: response.data.stop_reason
    };
  }

  async callOpenAI(model, prompt, systemPrompt, requestId, timeout) {
    const apiKey = this.getNextKey(PROVIDERS.OPENAI);
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      { model, messages, max_tokens: 4096 },
      {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        timeout
      }
    );

    const usage = response.data.usage;
    const cost = this.calculateCost(model, usage.prompt_tokens, usage.completion_tokens);

    return {
      content: response.data.choices[0].message.content,
      provider: PROVIDERS.OPENAI,
      model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      cost,
      stopReason: response.data.choices[0].finish_reason
    };
  }

  async callGoogle(model, prompt, systemPrompt, requestId, timeout) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key not configured');
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        generationConfig: { maxOutputTokens: 4096 }
      },
      {
        params: { key: apiKey },
        timeout
      }
    );

    const usage = response.data.usageMetadata;
    const cost = this.calculateCost(model, usage.promptTokenCount || 0, usage.candidatesTokenCount || 0);

    return {
      content: response.data.candidates[0].content.parts[0].text,
      provider: PROVIDERS.GOOGLE,
      model,
      promptTokens: usage.promptTokenCount || 0,
      completionTokens: usage.candidatesTokenCount || 0,
      totalTokens: (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0),
      cost,
      stopReason: response.data.candidates[0].finishReason
    };
  }

  calculateCost(model, promptTokens, completionTokens) {
    const costs = MODEL_COSTS[model] || { input: 1, output: 5 };
    return (
      (promptTokens / 1000000) * costs.input +
      (completionTokens / 1000000) * costs.output
    );
  }

  async logRequest(data) {
    try {
      await RequestLog.create({
        requestId: data.requestId,
        userId: data.userId,
        provider: data.provider,
        model: data.model,
        tier: data.tier,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.totalTokens,
        cost: data.cost,
        latency: data.latency,
        status: data.status,
        error: data.error,
        fallbackUsed: data.status === 'fallback',
        fallbackFrom: data.fallbackFrom,
        fallbackTo: data.fallbackTo
      });
    } catch (err) {
      logger.error('Failed to log request', { error: err.message });
    }
  }

  // Get usage analytics
  async getUsageAnalytics(options = {}) {
    const { startDate, endDate, userId, provider } = options;

    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    if (userId) match.userId = userId;
    if (provider) match.provider = provider;

    const [summary, byProvider, byModel, byUser] = await Promise.all([
      RequestLog.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            totalCost: { $sum: '$cost' },
            totalTokens: { $sum: '$totalTokens' },
            avgLatency: { $avg: '$latency' },
            errorRate: {
              $avg: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] }
            }
          }
        }
      ]),
      RequestLog.aggregate([
        { $match: match },
        { $group: { _id: '$provider', count: { $sum: 1 }, cost: { $sum: '$cost' } } }
      ]),
      RequestLog.aggregate([
        { $match: match },
        { $group: { _id: '$model', count: { $sum: 1 }, cost: { $sum: '$cost' } } }
      ]),
      RequestLog.aggregate([
        { $match: match, userId: { $exists: true } },
        { $group: { _id: '$userId', count: { $sum: 1 }, cost: { $sum: '$cost' } } },
        { $sort: { cost: -1 } },
        { $limit: 10 }
      ])
    ]);

    return {
      summary: summary[0] || { totalRequests: 0, totalCost: 0, totalTokens: 0 },
      byProvider,
      byModel,
      topUsers: byUser
    };
  }
}

const aiRouter = new AIRouter();

// Express app
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  logger.info(`${req.method} ${req.path}`, { requestId: req.requestId });
  next();
});

app.use((req, res, next) => {
  const publicPaths = ['/health', '/ready'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  const token = req.headers['x-internal-token'];
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ai-router',
    providers: Object.values(PROVIDERS),
    tiers: Object.values(MODEL_TIERS),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', (req, res) => {
  res.json({
    status: 'ready',
    keysConfigured: {
      anthropic: (aiRouter.keyIndex[PROVIDERS.ANTHROPIC]?.keys.length || 0) > 0,
      openai: (aiRouter.keyIndex[PROVIDERS.OPENAI]?.keys.length || 0) > 0,
      google: !!process.env.GOOGLE_API_KEY
    }
  });
});

// Main AI request endpoint
app.post('/api/ai/generate', asyncHandler(async (req, res) => {
  const {
    userId,
    prompt,
    systemPrompt,
    tier = MODEL_TIERS.BALANCED,
    provider,
    fallback = true,
    maxCost
  } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'prompt required' });
  }

  const result = await aiRouter.route({
    userId,
    prompt,
    systemPrompt,
    tier,
    preferredProvider: provider,
    fallback,
    maxCost
  });

  res.json({
    success: true,
    content: result.content,
    usage: {
      provider: result.provider,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      totalTokens: result.totalTokens,
      cost: result.cost
    }
  });
}));

// Streaming endpoint
app.post('/api/ai/generate/stream', asyncHandler(async (req, res) => {
  const { prompt, systemPrompt, provider = PROVIDERS.ANTHROPIC, tier = MODEL_TIERS.BALANCED } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'prompt required' });
  }

  // For streaming, we set headers and stream response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const apiKey = aiRouter.getNextKey(provider);
    const model = DEFAULT_MODELS[provider]?.[tier] || DEFAULT_MODELS[PROVIDERS.ANTHROPIC][tier];

    if (provider === PROVIDERS.ANTHROPIC) {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
          stream: true
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          responseType: 'stream'
        }
      );

      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              res.write('data: [DONE]\n\n');
            } else {
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  res.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      });

      response.data.on('end', () => {
        res.end();
      });

      response.data.on('error', (err) => {
        logger.error('Stream error', { error: err.message });
        res.end();
      });
    } else {
      // Non-streaming fallback for now
      const result = await aiRouter.route({ prompt, systemPrompt, preferredProvider: provider, tier: tier });
      res.write(`data: ${JSON.stringify({ text: result.content, done: true })}\n\n`);
      res.end();
    }
  } catch (err) {
    logger.error('Stream failed', { error: err.message });
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}));

// Get cost estimate
app.post('/api/ai/estimate', asyncHandler(async (req, res) => {
  const { prompt, tier = MODEL_TIERS.BALANCED, provider } = req.body;

  const providers = provider ? [provider] : Object.values(PROVIDERS);

  const estimates = providers.map(p => {
    const model = DEFAULT_MODELS[p]?.[tier];
    const costs = MODEL_COSTS[model] || { input: 1, output: 5 };

    // Rough estimate: assume 4 chars per token
    const estimatedPromptTokens = Math.ceil(prompt.length / 4);
    const estimatedOutputTokens = 500; // Default assumption

    return {
      provider: p,
      model,
      estimatedCost: (
        (estimatedPromptTokens / 1000000) * costs.input +
        (estimatedOutputTokens / 1000000) * costs.output
      )
    };
  });

  res.json({ success: true, estimates });
}));

// Analytics
app.get('/api/ai/analytics', asyncHandler(async (req, res) => {
  const { startDate, endDate, userId, provider } = req.query;

  const analytics = await aiRouter.getUsageAnalytics({
    startDate,
    endDate,
    userId,
    provider
  });

  res.json({ success: true, analytics });
}));

// Provider health check
app.get('/api/ai/health/:provider', asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const startTime = Date.now();

  try {
    let healthy = false;
    switch (provider) {
      case PROVIDERS.ANTHROPIC:
        const anthropicKey = aiRouter.getNextKey(PROVIDERS.ANTHROPIC);
        if (anthropicKey) {
          await axios.post(
            'https://api.anthropic.com/v1/messages',
            { model: 'claude-3-5-haiku-20241022', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] },
            { headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' }, timeout: 5000 }
          );
          healthy = true;
        }
        break;
      case PROVIDERS.OPENAI:
        const openaiKey = aiRouter.getNextKey(PROVIDERS.OPENAI);
        if (openaiKey) {
          await axios.post(
            'https://api.openai.com/v1/chat/completions',
            { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }], max_tokens: 10 },
            { headers: { 'Authorization': `Bearer ${openaiKey}` }, timeout: 5000 }
          );
          healthy = true;
        }
        break;
    }

    res.json({
      success: true,
      provider,
      healthy,
      latency: Date.now() - startTime
    });
  } catch (err) {
    res.json({
      success: true,
      provider,
      healthy: false,
      error: err.message,
      latency: Date.now() - startTime
    });
  }
}));

app.use(errorHandler);

const PORT = process.env.PORT || 4052;

async function start() {
  try {
    await aiRouter.init();
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      logger.info('Connected to MongoDB');
    }
    app.listen(PORT, () => {
      logger.info(`AI Router started on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();
