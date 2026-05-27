import { trainingExporter } from '../services/trainingExporter.js';
import logger from './utils/logger.js';
import { ExportRequest } from '../utils/validators.js';

export interface ExportPipelineResult {
  batchId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
}

export class ExportPipeline {
  async run(
    request: ExportRequest,
    versionId?: string
  ): Promise<ExportPipelineResult> {
    logger.info('Starting export pipeline', { request });

    try {
      const result = await trainingExporter.createExport(request, versionId);

      return {
        batchId: result.batchId,
        status: 'pending',
        message: 'Export job created and queued for processing',
      };
    } catch (error) {
      logger.error('Export pipeline failed', { error: (error as Error).message });
      throw error;
    }
  }

  async runScheduled(): Promise<ExportPipelineResult> {
    const request: ExportRequest = {
      format: 'jsonl',
      includeMetadata: true,
      filters: {
        minConfidence: 0.7,
        hasOutcome: true,
      },
    };

    return this.run(request);
  }

  async runForVersion(
    versionId: string,
    filters?: ExportRequest['filters']
  ): Promise<ExportPipelineResult> {
    const request: ExportRequest = {
      format: 'jsonl',
      includeMetadata: true,
      filters: filters || {},
    };

    return this.run(request, versionId);
  }

  async getStatus(batchId: string): Promise<{
    status: string;
    progress?: number;
    sampleCount?: number;
    error?: string;
  }> {
    const batch = await trainingExporter.getExportStatus(batchId);

    if (!batch) {
      return { status: 'not_found' };
    }

    return {
      status: batch.status,
      sampleCount: batch.sampleCount,
      error: batch.error?.message,
    };
  }
}

export const exportPipeline = new ExportPipeline();
