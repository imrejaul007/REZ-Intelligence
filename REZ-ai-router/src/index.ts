import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

import { logger } from './utils/logger';
import { asyncHandler, errorMiddleware, notFoundMiddleware } from './utils/errorHandler';
import {
  GenerateRequestSchema,
  EstimateRequestSchema,
  AnalyticsQuerySchema,
  AIProvider,
  RouteOptions,
} from './types';
import {
  PROVIDERS,
  MODEL_TIERS,
  DEFAULT_MODELS,
  MODEL_COSTS,
  PUBLIC_PATHS,
  REQUIRED_ENV,
} from './constants';
import { aiRouter, AIRouter } from './services/AIRouter';

// Environment validation
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    logger.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// Express app
const app: Express = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request ID middleware
app.use((req: Request, res: Response, next) => {
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  logger.info(`${req.method} ${req.path}`, { requestId: req.requestId });
  next();
});

// Authentication middleware
app.use((req: Request, res: Response, next) => {
  const publicPaths = PUBLIC_PATHS;
  if (publicPaths.some((p) => req.path.startsWith(p))) return next();

  const token = req.headers['x-internal-token'];
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ai-router',
    providers: Object.values(PROVIDERS),
    tiers: Object.values(MODEL_TIERS),
    timestamp: new Date().toISOString(),
  });
});

// Readiness check
app.get('/ready', (req: Request, res: Response) => {
  res.json({
    status: 'ready',
    keysConfigured: {
      anthropic: aiRouter.isProviderConfigured(PROVIDERS.ANTHROPIC),
      openai: aiRouter.isProviderConfigured(PROVIDERS.OPENAI),
      google: aiRouter.isProviderConfigured(PROVIDERS.GOOGLE),
    },
  });
});

// Main AI request endpoint
app.post(
  '/api/ai/generate',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = GenerateRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const {
      userId,
      prompt,
      systemPrompt,
      tier,
      provider,
      fallback,
      maxCost,
    } = parseResult.data;

    const result = await aiRouter.route({
      userId,
      prompt,
      systemPrompt,
      tier,
      preferredProvider: provider,
      fallback,
      maxCost,
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
        cost: result.cost,
      },
    });
  })
);

// Streaming endpoint
app.post(
  '/api/ai/generate/stream',
  asyncHandler(async (req: Request, res: Response) => {
    const { prompt, systemPrompt, provider = PROVIDERS.ANTHROPIC, tier = MODEL_TIERS.BALANCED } =
      req.body;

    if (!prompt) {
      res.status(400).json({ error: 'prompt required' });
      return;
    }

    // For streaming, we set headers and stream response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const apiKey = aiRouter.getNextKey
        ? (aiRouter as unknown as { getNextKey: (p: AIProvider) => string | null }).getNextKey(provider)
        : null;
      const model =
        DEFAULT_MODELS[provider]?.[tier] || DEFAULT_MODELS[PROVIDERS.ANTHROPIC][tier];

      if (provider === PROVIDERS.ANTHROPIC) {
        const response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
          },
          {
            headers: {
              'x-api-key': apiKey || '',
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true',
              'Content-Type': 'application/json',
            },
            responseType: 'stream',
          }
        );

        response.data.on('data', (chunk: Buffer) => {
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
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
        });

        response.data.on('end', () => {
          res.end();
        });

        response.data.on('error', (err: Error) => {
          logger.error('Stream error', { error: err.message });
          res.end();
        });
      } else {
        // Non-streaming fallback for now
        const result = await aiRouter.route({ prompt, systemPrompt, preferredProvider: provider, tier });
        res.write(`data: ${JSON.stringify({ text: result.content, done: true })}\n\n`);
        res.end();
      }
    } catch (err) {
      logger.error('Stream failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
      res.end();
    }
  })
);

// Get cost estimate
app.post(
  '/api/ai/estimate',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = EstimateRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const { prompt, tier, provider } = parseResult.data;

    const providers = provider
      ? [provider]
      : (Object.values(PROVIDERS) as AIProvider[]);

    const estimates = providers.map((p) => {
      const model = DEFAULT_MODELS[p]?.[tier];
      const costs = MODEL_COSTS[model || ''] || { input: 1, output: 5 };

      // Rough estimate: assume 4 chars per token
      const estimatedPromptTokens = Math.ceil(prompt.length / 4);
      const estimatedOutputTokens = 500; // Default assumption

      return {
        provider: p,
        model,
        estimatedCost:
          (estimatedPromptTokens / 1000000) * costs.input +
          (estimatedOutputTokens / 1000000) * costs.output,
      };
    });

    res.json({ success: true, estimates });
  })
);

// Analytics
app.get(
  '/api/ai/analytics',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = AnalyticsQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        validationErrors: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    const analytics = await aiRouter.getUsageAnalytics(parseResult.data);

    res.json({ success: true, analytics });
  })
);

// Provider health check
app.get(
  '/api/ai/health/:provider',
  asyncHandler(async (req: Request, res: Response) => {
    const { provider } = req.params;

    const providerEnum = provider as AIProvider;
    if (!Object.values(PROVIDERS).includes(providerEnum)) {
      res.status(400).json({
        success: false,
        error: `Unknown provider: ${provider}`,
      });
      return;
    }

    const health = await aiRouter.checkProviderHealth(providerEnum);

    res.json({
      success: true,
      provider,
      ...health,
    });
  })
);

// Error handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

const PORT = parseInt(process.env.PORT || '4052', 10);

async function start(): Promise<void> {
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
    logger.error('Startup failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    process.exit(1);
  }
}

start();
