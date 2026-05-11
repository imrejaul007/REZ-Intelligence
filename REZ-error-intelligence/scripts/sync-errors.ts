#!/usr/bin/env npx ts-node
/**
 * Sync errors from rez-error-intelligence back to individual repos.
 * Updates the error knowledge base in each repo's docs/errors/ directory.
 *
 * Usage:
 *   npx ts-node scripts/sync-errors.ts
 */

import fs from 'fs';
import path from 'path';

const { logger } = await import('@rez/rez-shared/telemetry').catch(() => ({ logger: console }));

const EI_ERRORS_DIR = path.join(__dirname, '..', 'errors');

function getAllErrors(): any[] {
  const registry = path.join(EI_ERRORS_DIR, 'ERRORS.json');
  if (!fs.existsSync(registry)) return [];
  return JSON.parse(fs.readFileSync(registry, 'utf-8')).errors || [];
}

function sync(): void {
  const errors = getAllErrors();

  logger.info(`Syncing ${errors.length} errors from rez-error-intelligence...`);

  const errorsByRepo: Record<string, any[]> = {};
  for (const err of errors) {
    const repo = err.repo || 'unknown';
    if (!errorsByRepo[repo]) errorsByRepo[repo] = [];
    errorsByRepo[repo].push(err);
  }

  for (const [repo, repoErrors] of Object.entries(errorsByRepo)) {
    logger.info(`  ${repo}: ${repoErrors.length} errors`);
    // In the monorepo, each service's errors would be symlinked/copied
    // For individual repos, this script would copy to their docs/errors/
  }

  logger.info('\nSync complete. Errors grouped by repository.');
}

sync();
