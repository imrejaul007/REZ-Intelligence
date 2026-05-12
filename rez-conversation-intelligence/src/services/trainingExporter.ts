import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { ConversationSample, TrainingBatch, ModelVersion } from '../models/index.js';
import logger from '../utils/logger.js';
import { config } from '../config/index.js';
import { ExportRequest } from '../utils/validators.js';

export interface ExportResult {
  batchId: string;
  versionId: string;
  filePath: string;
  fileSize: number;
  sampleCount: number;
  checksum: string;
  statistics: {
    totalConversations: number;
    totalMessages: number;
    intentDistribution: Record<string, number>;
    sentimentDistribution: Record<string, number>;
    channelDistribution: Record<string, number>;
    outcomeDistribution: Record<string, number>;
  };
}

export class TrainingExporter {
  private exportDir: string;

  constructor() {
    this.exportDir = path.join(process.cwd(), 'exports');
    this.ensureExportDir();
  }

  private async ensureExportDir(): Promise<void> {
    try {
      await fs.mkdir(this.exportDir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async createExport(
    request: ExportRequest,
    versionId?: string
  ): Promise<ExportResult> {
    const batchId = uuidv4();

    // Create or get model version
    const modelVersion = await this.getOrCreateModelVersion(versionId);

    // Create batch record
    const batch = new TrainingBatch({
      batchId,
      versionId: modelVersion.versionId,
      status: 'pending',
      format: request.format,
      filters: {
        channels: request.filters?.channels,
        intents: request.filters?.intents,
        sentiment: request.filters?.sentiment,
        minConfidence: request.filters?.minConfidence,
        hasOutcome: request.filters?.hasOutcome,
        startDate: request.startDate ? new Date(request.startDate) : undefined,
        endDate: request.endDate ? new Date(request.endDate) : undefined,
      },
      sampleCount: 0,
      statistics: {
        totalConversations: 0,
        totalMessages: 0,
        intentDistribution: {},
        sentimentDistribution: {},
        channelDistribution: {},
        outcomeDistribution: {},
      },
    });

    await batch.save();

    // Process export asynchronously
    this.processExport(batchId, request).catch((error) => {
      logger.error('Export processing failed', {
        batchId,
        error: error.message,
      });
    });

    return {
      batchId,
      versionId: modelVersion.versionId,
      filePath: '',
      fileSize: 0,
      sampleCount: 0,
      checksum: '',
      statistics: batch.statistics,
    };
  }

  private async processExport(batchId: string, request: ExportRequest): Promise<void> {
    const batch = await TrainingBatch.findOne({ batchId });

    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    try {
      batch.status = 'processing';
      await batch.save();

      // Build query
      const query = this.buildQuery(request);
      const conversations = await ConversationSample.find(query)
        .lean()
        .limit(config.EXPORT_BATCH_SIZE);

      if (conversations.length === 0) {
        batch.status = 'completed';
        batch.sampleCount = 0;
        await batch.save();
        return;
      }

      // Process and export
      const filePath = await this.writeExportFile(batchId, conversations, request.format, request.includeMetadata);
      const stats = this.calculateStatistics(conversations);
      const checksum = await this.calculateChecksum(filePath);
      const fileSize = (await fs.stat(filePath)).size;

      // Update batch
      batch.status = 'completed';
      batch.filePath = filePath;
      batch.fileSize = fileSize;
      batch.checksum = checksum;
      batch.sampleCount = conversations.length;
      batch.statistics = stats;
      batch.completedAt = new Date();
      await batch.save();

      // Update model version
      await ModelVersion.findOneAndUpdate(
        { versionId: batch.versionId },
        {
          $set: {
            'trainingData.sampleCount': batch.sampleCount,
            'trainingData.conversationCount': stats.totalConversations,
          },
        }
      );

      logger.info('Export completed', {
        batchId,
        sampleCount: batch.sampleCount,
        fileSize,
      });
    } catch (error) {
      batch.status = 'failed';
      batch.error = {
        message: (error as Error).message,
        stack: (error as Error).stack,
      };
      await batch.save();

      logger.error('Export failed', {
        batchId,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  private buildQuery(request: ExportRequest): Record<string, unknown> {
    const query: Record<string, unknown> = {
      isLabeled: true,
      status: { $ne: 'archived' },
    };

    if (request.filters?.channels?.length) {
      query.channel = { $in: request.filters.channels };
    }

    if (request.filters?.intents?.length) {
      query['extractedIntents.name'] = { $in: request.filters.intents };
    }

    if (request.filters?.sentiment?.length) {
      query['aggregatedSentiment.label'] = { $in: request.filters.sentiment };
    }

    if (request.filters?.minConfidence) {
      query['extractedIntents.confidence'] = { $gte: request.filters.minConfidence };
    }

    if (request.filters?.hasOutcome !== undefined) {
      if (request.filters.hasOutcome) {
        query.outcome = { $exists: true, $ne: null };
      } else {
        query.$or = [
          { outcome: { $exists: false } },
          { outcome: null },
        ];
      }
    }

    if (request.startDate) {
      query.createdAt = { $gte: new Date(request.startDate) };
    }

    if (request.endDate) {
      query.createdAt = {
        ...((query.createdAt as Record<string, unknown>) || {}),
        $lte: new Date(request.endDate),
      };
    }

    return query;
  }

  private async writeExportFile(
    batchId: string,
    conversations: Record<string, unknown>[],
    format: 'json' | 'jsonl' | 'csv',
    includeMetadata: boolean
  ): Promise<string> {
    const fileName = `${batchId}.${format}`;
    const filePath = path.join(this.exportDir, fileName);

    switch (format) {
      case 'json':
        await this.writeJsonFile(filePath, conversations, includeMetadata);
        break;
      case 'jsonl':
        await this.writeJsonlFile(filePath, conversations, includeMetadata);
        break;
      case 'csv':
        await this.writeCsvFile(filePath, conversations, includeMetadata);
        break;
    }

    return filePath;
  }

  private async writeJsonFile(
    filePath: string,
    conversations: Record<string, unknown>[],
    includeMetadata: boolean
  ): Promise<void> {
    const exportData = conversations.map((conv) =>
      this.transformConversation(conv, includeMetadata)
    );
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
  }

  private async writeJsonlFile(
    filePath: string,
    conversations: Record<string, unknown>[],
    includeMetadata: boolean
  ): Promise<void> {
    const lines = conversations.map((conv) =>
      JSON.stringify(this.transformConversation(conv, includeMetadata))
    );
    await fs.writeFile(filePath, lines.join('\n'));
  }

  private async writeCsvFile(
    filePath: string,
    conversations: Record<string, unknown>[],
    includeMetadata: boolean
  ): Promise<void> {
    const headers = [
      'conversationId',
      'channel',
      'createdAt',
      'topIntent',
      'intentConfidence',
      'sentimentLabel',
      'sentimentScore',
      'hasOutcome',
      'outcomeSuccess',
      'messageCount',
      'userMessageCount',
      'agentMessageCount',
    ];

    if (includeMetadata) {
      headers.push('sessionId', 'userId', 'appId');
    }

    const rows = conversations.map((conv) => {
      const row = [
        conv.conversationId as string,
        conv.channel as string,
        (conv.createdAt as Date).toISOString(),
        this.getTopIntent(conv),
        this.getTopIntentConfidence(conv).toString(),
        (conv.aggregatedSentiment as Record<string, unknown>)?.label as string || 'neutral',
        ((conv.aggregatedSentiment as Record<string, unknown>)?.score as number || 0).toString(),
        (conv.outcome ? 'true' : 'false'),
        (conv.outcome && (conv.outcome as Record<string, unknown>)?.success ? 'true' : 'false'),
        ((conv.messages as unknown[])?.length || 0).toString(),
        this.countUserMessages(conv).toString(),
        this.countAgentMessages(conv).toString(),
      ];

      if (includeMetadata) {
        row.push(
          conv.sessionId as string,
          ((conv.context as Record<string, unknown>)?.userId as string) || '',
          ((conv.context as Record<string, unknown>)?.appId as string) || ''
        );
      }

      return row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',');
    });

    const content = [headers.join(','), ...rows].join('\n');
    await fs.writeFile(filePath, content);
  }

  private transformConversation(
    conv: Record<string, unknown>,
    includeMetadata: boolean
  ): Record<string, unknown> {
    const transformed: Record<string, unknown> = {
      id: conv.conversationId,
      channel: conv.channel,
      created_at: conv.createdAt,
      top_intent: this.getTopIntent(conv),
      top_intent_confidence: this.getTopIntentConfidence(conv),
      all_intents: (conv.extractedIntents as Array<Record<string, unknown>>)?.map((i) => ({
        name: i.name,
        confidence: i.confidence,
      })) || [],
      sentiment: {
        label: (conv.aggregatedSentiment as Record<string, unknown>)?.label || 'neutral',
        score: (conv.aggregatedSentiment as Record<string, unknown>)?.score || 0,
      },
      outcome: conv.outcome,
      messages: (conv.messages as Array<Record<string, unknown>>)?.map((m) => ({
        role: m.senderType,
        content: m.content,
        timestamp: m.timestamp,
        intent: m.intent,
        sentiment: m.sentiment,
      })) || [],
    };

    if (includeMetadata) {
      transformed.metadata = {
        sessionId: conv.sessionId,
        ...(conv.context as Record<string, unknown>),
        ...(conv.metadata as Record<string, unknown>),
      };
    }

    return transformed;
  }

  private getTopIntent(conv: Record<string, unknown>): string {
    const intents = conv.extractedIntents as Array<Record<string, unknown>>;
    if (!intents || intents.length === 0) return 'unknown';
    return intents.sort((a, b) =>
      (b.confidence as number) - (a.confidence as number)
    )[0].name as string;
  }

  private getTopIntentConfidence(conv: Record<string, unknown>): number {
    const intents = conv.extractedIntents as Array<Record<string, unknown>>;
    if (!intents || intents.length === 0) return 0;
    return Math.max(...intents.map((i) => i.confidence as number));
  }

  private countUserMessages(conv: Record<string, unknown>): number {
    const messages = conv.messages as Array<Record<string, unknown>>;
    if (!messages) return 0;
    return messages.filter((m) => m.senderType === 'user').length;
  }

  private countAgentMessages(conv: Record<string, unknown>): number {
    const messages = conv.messages as Array<Record<string, unknown>>;
    if (!messages) return 0;
    return messages.filter((m) => ['agent', 'bot'].includes(m.senderType as string)).length;
  }

  private calculateStatistics(
    conversations: Record<string, unknown>[]
  ): Record<string, Record<string, number>> {
    const stats = {
      totalConversations: conversations.length,
      totalMessages: 0,
      intentDistribution: {} as Record<string, number>,
      sentimentDistribution: { positive: 0, neutral: 0, negative: 0 } as Record<string, number>,
      channelDistribution: {} as Record<string, number>,
      outcomeDistribution: { successful: 0, failed: 0, unknown: 0 } as Record<string, number>,
    };

    for (const conv of conversations) {
      const messages = conv.messages as Array<Record<string, unknown>>;
      stats.totalMessages += messages?.length || 0;

      const channel = conv.channel as string;
      stats.channelDistribution[channel] = (stats.channelDistribution[channel] || 0) + 1;

      const sentiment = (conv.aggregatedSentiment as Record<string, unknown>)?.label as string || 'neutral';
      stats.sentimentDistribution[sentiment] = (stats.sentimentDistribution[sentiment] || 0) + 1;

      const intents = conv.extractedIntents as Array<Record<string, unknown>>;
      if (intents?.length) {
        const topIntent = intents.sort((a, b) =>
          (b.confidence as number) - (a.confidence as number)
        )[0].name as string;
        stats.intentDistribution[topIntent] = (stats.intentDistribution[topIntent] || 0) + 1;
      }

      const outcome = conv.outcome as Record<string, unknown>;
      if (outcome?.success === true) stats.outcomeDistribution.successful++;
      else if (outcome?.success === false) stats.outcomeDistribution.failed++;
      else stats.outcomeDistribution.unknown++;
    }

    return stats;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  }

  private async getOrCreateModelVersion(existingVersionId?: string): Promise<typeof ModelVersion.prototype> {
    if (existingVersionId) {
      const existing = await ModelVersion.findOne({ versionId: existingVersionId });
      if (existing) return existing;
    }

    const versionNumber = await ModelVersion.incrementVersion();
    const versionId = uuidv4();

    const modelVersion = new ModelVersion({
      versionId,
      versionNumber,
      description: `Training export ${new Date().toISOString()}`,
      trainingData: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate: new Date(),
        sampleCount: 0,
        conversationCount: 0,
        uniqueIntents: 0,
        uniqueEntities: 0,
      },
      status: 'draft',
    });

    await modelVersion.save();
    return modelVersion;
  }

  async getExportStatus(batchId: string): Promise<typeof TrainingBatch.prototype | null> {
    return TrainingBatch.findOne({ batchId });
  }

  async downloadExport(batchId: string): Promise<{
    filePath: string;
    fileSize: number;
    checksum: string;
  } | null> {
    const batch = await TrainingBatch.findOne({ batchId });

    if (!batch || batch.status !== 'completed' || !batch.filePath) {
      return null;
    }

    return {
      filePath: batch.filePath,
      fileSize: batch.fileSize || 0,
      checksum: batch.checksum || '',
    };
  }

  async listExports(limit = 20): Promise<typeof TrainingBatch.prototype[]> {
    return TrainingBatch.find()
      .sort({ createdAt: -1 })
      .limit(limit);
  }
}

export const trainingExporter = new TrainingExporter();
