import { v4 as uuidv4 } from 'uuid';
import { SearchRecord } from '../types.js';

// In-memory search history store
const searchHistory: Record<string, SearchRecord[]> = {};

export class MemoryEngine {
  async store(userId: string, query: string, context: Record<string, unknown>): Promise<{ success: boolean }> {
    if (!searchHistory[userId]) {
      searchHistory[userId] = [];
    }

    searchHistory[userId].push({
      id: uuidv4(),
      query,
      context,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  async getContext(userId: string): Promise<{ recentSearches: SearchRecord[]; totalSearches: number }> {
    const history = searchHistory[userId] || [];
    return {
      recentSearches: history.slice(-5),
      totalSearches: history.length,
    };
  }

  getSearchHistory(userId: string): SearchRecord[] {
    return searchHistory[userId] || [];
  }

  clearHistory(): void {
    Object.keys(searchHistory).forEach((key) => delete searchHistory[key]);
  }
}

export const memoryEngine = new MemoryEngine();
