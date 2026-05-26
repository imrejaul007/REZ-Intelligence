/**
 * Knowledge Base Service
 * Manages merchant-specific knowledge bases with strict isolation
 */

import { v4 as uuidv4 } from 'uuid';
import { KnowledgeBaseEntry } from '../types';

// In-memory store (use vector DB + MongoDB in production)
const knowledgeStore = new Map<string, KnowledgeBaseEntry[]>();

export class KnowledgeBaseService {
  /**
   * Add entry to knowledge base
   */
  addEntry(tenantId: string, entry: Omit<KnowledgeBaseEntry, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): KnowledgeBaseEntry {
    const fullEntry: KnowledgeBaseEntry = {
      ...entry,
      id: uuidv4(),
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const entries = knowledgeStore.get(tenantId) || [];
    entries.push(fullEntry);
    knowledgeStore.set(tenantId, entries);

    return fullEntry;
  }

  /**
   * Get entry by ID
   */
  getEntry(tenantId: string, entryId: string): KnowledgeBaseEntry | undefined {
    const entries = knowledgeStore.get(tenantId) || [];
    return entries.find(e => e.id === entryId);
  }

  /**
   * Update entry
   */
  updateEntry(tenantId: string, entryId: string, updates: Partial<KnowledgeBaseEntry>): KnowledgeBaseEntry | undefined {
    const entries = knowledgeStore.get(tenantId) || [];
    const index = entries.findIndex(e => e.id === entryId);

    if (index === -1) return undefined;

    entries[index] = {
      ...entries[index],
      ...updates,
      id: entryId,
      tenantId,
      updatedAt: new Date()
    };

    knowledgeStore.set(tenantId, entries);
    return entries[index];
  }

  /**
   * Delete entry
   */
  deleteEntry(tenantId: string, entryId: string): boolean {
    const entries = knowledgeStore.get(tenantId) || [];
    const filtered = entries.filter(e => e.id !== entryId);

    if (filtered.length === entries.length) return false;

    knowledgeStore.set(tenantId, filtered);
    return true;
  }

  /**
   * Search knowledge base
   */
  search(tenantId: string, query: string, limit = 10): KnowledgeBaseEntry[] {
    const entries = knowledgeStore.get(tenantId) || [];
    const queryLower = query.toLowerCase();

    return entries
      .filter(e => e.isActive && (
        e.question?.toLowerCase().includes(queryLower) ||
        e.answer?.toLowerCase().includes(queryLower) ||
        e.content.toLowerCase().includes(queryLower)
      ))
      .slice(0, limit);
  }

  /**
   * Get all entries for tenant
   */
  getAllEntries(tenantId: string): KnowledgeBaseEntry[] {
    return knowledgeStore.get(tenantId) || [];
  }

  /**
   * Get entries by category
   */
  getByCategory(tenantId: string, category: KnowledgeBaseEntry['category']): KnowledgeBaseEntry[] {
    const entries = knowledgeStore.get(tenantId) || [];
    return entries.filter(e => e.category === category && e.isActive);
  }

  /**
   * Bulk import entries
   */
  bulkImport(tenantId: string, entries: Array<Omit<KnowledgeBaseEntry, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>): KnowledgeBaseEntry[] {
    const now = new Date();
    const imported = entries.map(e => ({
      ...e,
      id: uuidv4(),
      tenantId,
      createdAt: now,
      updatedAt: now
    }));

    const existing = knowledgeStore.get(tenantId) || [];
    knowledgeStore.set(tenantId, [...existing, ...imported]);

    return imported;
  }

  /**
   * Get entry count
   */
  getCount(tenantId: string): number {
    return (knowledgeStore.get(tenantId) || []).length;
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
