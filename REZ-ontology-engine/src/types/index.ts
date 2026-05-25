import { z } from 'zod';

export const EntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  class: z.string(),
  properties: z.record(z.unknown()).optional(),
  parent: z.string().optional()
});
export type Entity = z.infer<typeof EntitySchema>;

export const ClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  parent: z.string().optional(),
  properties: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'date', 'entity', 'array']),
    required: z.boolean().default(false)
  })),
  description: z.string().optional()
});
export type OntologyClass = z.infer<typeof ClassSchema>;

export const RelationSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.enum(['is_a', 'has_a', 'part_of', 'related_to', 'causes', 'depends_on']),
  properties: z.record(z.unknown()).optional()
});
export type Relation = z.infer<typeof RelationSchema>;

export const OntologyQuerySchema = z.object({
  entity: z.string(),
  query: z.string().optional(),
  depth: z.number().min(1).max(10).default(3)
});
export type OntologyQuery = z.infer<typeof OntologyQuerySchema>;
