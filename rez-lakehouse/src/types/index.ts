/**
 * REZ Lakehouse - Types
 */

export interface DataLake {
  id: string;
  name: string;
  tables: DataTable[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DataTable {
  id: string;
  name: string;
  schema: TableSchema;
  partitions: string[];
  format: 'parquet' | 'delta' | 'iceberg';
  location: string;
  rowCount: number;
  sizeBytes: number;
  lastUpdated: Date;
}

export interface TableSchema {
  columns: Column[];
}

export interface Column {
  name: string;
  type: 'string' | 'int' | 'bigint' | 'float' | 'double' | 'boolean' | 'timestamp' | 'date';
  nullable: boolean;
  partitionKey?: boolean;
}

export interface ETLJob {
  id: string;
  name: string;
  source: DataSource;
  destination: DataTable;
  schedule: string; // cron
  lastRun: Date;
  status: 'active' | 'paused' | 'failed';
  rowsProcessed: number;
}

export interface DataSource {
  type: 'mongodb' | 'mysql' | 'postgres' | 'kafka' | 'api';
  connection: string;
  query?: string;
}

export interface DataPipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
  status: 'active' | 'paused';
  lastRun: Date;
}

export interface PipelineStage {
  id: string;
  type: 'extract' | 'transform' | 'load' | 'validate';
  config: Record<string, unknown>;
}

export interface AnalyticsView {
  id: string;
  name: string;
  sql: string;
  refreshSchedule: string;
  lastRefresh: Date;
}

export interface Metric {
  id: string;
  name: string;
  value: number;
  unit: string;
  dimensions: Record<string, string>;
  timestamp: Date;
}

export interface DataQuality {
  tableId: string;
  metrics: {
    nullCount: number;
    duplicateCount: number;
    freshness: number; // hours since last update
  };
  passed: boolean;
  checkedAt: Date;
}
