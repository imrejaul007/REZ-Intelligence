import { z } from 'zod';

export const DataType = z.enum([
  'user',
  'product',
  'order',
  'transaction',
  'merchant',
  'location',
  'event',
  'behavior',
  'custom'
]);
export type DataType = z.infer<typeof DataType>;

export const GeneratorType = z.enum([
  'tabular',
  'timeseries',
  'behavioral',
  'location',
  'text'
]);
export type GeneratorType = z.infer<typeof GeneratorType>;

export const SchemaFieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'date', 'email', 'phone', 'name', 'address', 'uuid', 'enum', 'array', 'object']),
  format: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  enum: z.array(z.string()).optional(),
  nullable: z.boolean().default(false),
  unique: z.boolean().default(false),
  default: z.union([z.string(), z.number(), z.boolean()]).optional()
});
export type SchemaField = z.infer<typeof SchemaFieldSchema>;

export const DatasetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  dataType: DataType,
  generatorType: GeneratorType,
  schema: z.array(SchemaFieldSchema),
  recordCount: z.number().min(1).max(100000).default(100),
  options: z.object({
    seed: z.number().optional(),
    preserveRelationships: z.boolean().default(false),
    anonymizePII: z.boolean().default(true),
    addNoise: z.boolean().default(false),
    noiseLevel: z.number().min(0).max(1).default(0.1)
  }).optional()
});
export type Dataset = z.infer<typeof DatasetSchema>;

export const AnonymizeRequestSchema = z.object({
  data: z.array(z.record(z.unknown())),
  fieldsToAnonymize: z.array(z.string()),
  fieldsToRemove: z.array(z.string()).optional(),
  preserveFormat: z.boolean().default(true),
  seed: z.number().optional()
});
export type AnonymizeRequest = z.infer<typeof AnonymizeRequestSchema>;

export const SyntheticDataRequestSchema = z.object({
  dataset: DatasetSchema,
  realDataSample: z.array(z.record(z.unknown())).optional(),
  targetStats: z.object({
    mean: z.record(z.number()).optional(),
    stdDev: z.record(z.number()).optional(),
    correlations: z.record(z.record(z.number())).optional(),
    distributions: z.record(z.enum(['normal', 'uniform', 'exponential', 'poisson', 'binomial'])).optional()
  }).optional()
});
export type SyntheticDataRequest = z.infer<typeof SyntheticDataRequestSchema>;

export interface GenerationResult {
  datasetId: string;
  name: string;
  recordCount: number;
  generatedAt: Date;
  schema: SchemaField[];
  data: Record<string, unknown>[];
  stats?: {
    fieldStats: Record<string, { min?: number; max?: number; mean?: number; unique?: number }>;
    totalSize: number;
    piiFields: string[];
  };
}

export interface DataQualityReport {
  datasetId: string;
  completeness: number;
  validity: number;
  consistency: number;
  privacyScore: number;
  distributionMatch: number;
  issues: string[];
  recommendations: string[];
}
