#!/usr/bin/env node
/**
 * Script to fix Math.random() ID generation vulnerabilities
 * Replace Math.random() based IDs with crypto.randomUUID()
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Patterns to replace (ordered by specificity)
const replacements = [
  // sessionId generation
  {
    pattern: /`sess_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`/g,
    replacement: '`sess_${crypto.randomUUID()}`',
    description: 'Session ID'
  },
  // conversationId generation
  {
    pattern: /`conv_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`/g,
    replacement: '`conv_${crypto.randomUUID()}`',
    description: 'Conversation ID'
  },
  // messageId generation
  {
    pattern: /`msg_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`/g,
    replacement: '`msg_${crypto.randomUUID()}`',
    description: 'Message ID'
  },
  // eventId generation
  {
    pattern: /`evt_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`/g,
    replacement: '`evt_${crypto.randomUUID()}`',
    description: 'Event ID'
  },
  // Twilio SID generation
  {
    pattern: /`SM\$\{Date\.now\(\)\}\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`/g,
    replacement: '`SM${crypto.randomUUID().replace(/-/g, \'\')}`',
    description: 'Twilio SID'
  },
  // Generic ID generation
  {
    pattern: /`\w+_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`/g,
    replacement: '`${crypto.randomUUID()}`',
    description: 'Generic ID'
  },
];

// Non-critical patterns (ML/random sampling - these are OK)
const skipPatterns = [
  /Math\.floor\(Math\.random\(\) \* .*\.length\)/g, // array random selection
  /Math\.random\(\) \* .* \+ .*/g, // ML simulations
  /Math\.random\(\) - 0\.5/g, // shuffling
  /0\.\d+ \+ Math\.random\(\) \* \d+\.\d+/g, // ML metrics
  /Math\.max\(.*Math\.random\(\).*\)/g, // ML calculations
  /Math\.min\(.*Math\.random\(\).*\)/g, // ML calculations
  /const .* = .* \+ Math\.random\(\).*/g, // analytics mock data
  /change: .* \+ Math\.random\(\).*/g, // analytics mock data
];

function shouldSkip(line) {
  return skipPatterns.some(p => p.test(line));
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  const fixes = [];

  // Check if crypto is imported
  const needsCryptoImport = /`\w+_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`/.test(content) ||
                            /`SM\$\{Date\.now\(\)\}\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`/.test(content);

  if (needsCryptoImport && !content.includes("import crypto from 'crypto'")) {
    // Add crypto import at the top
    if (content.includes("from 'crypto'")) {
      // Already has crypto import, modify it
      content = content.replace(/import .* from 'crypto';/, "import crypto from 'crypto';");
    } else {
      // Add new import
      const lines = content.split('\n');
      const importIndex = lines.findIndex(l => l.startsWith('import ') && !l.startsWith('import type'));
      if (importIndex !== -1) {
        lines.splice(importIndex, 0, "import crypto from 'crypto';");
        content = lines.join('\n');
      }
    }
    modified = true;
    fixes.push('Added crypto import');
  }

  // Apply replacements
  for (const { pattern, replacement, description } of replacements) {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      modified = true;
      fixes.push(`${description}: ${matches.length} fix(es)`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    return fixes;
  }
  return null;
}

const servicesDir = path.join(__dirname, '..');
const services = fs.readdirSync(servicesDir).filter(f => {
  return fs.statSync(path.join(servicesDir, f)).isDirectory() &&
         fs.existsSync(path.join(servicesDir, f, 'src'));
});

console.log('Scanning for Math.random() ID generation vulnerabilities...\n');

let totalFiles = 0;
let totalFixes = 0;

for (const service of services) {
  const srcDir = path.join(servicesDir, service, 'src');

  function scanDir(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDir(fullPath);
        continue;
      }

      if (!file.endsWith('.ts')) continue;

      const fixes = fixFile(fullPath);
      if (fixes) {
        totalFiles++;
        console.log(`\n[${service}] ${path.relative(srcDir, fullPath)}`);
        fixes.forEach(f => {
          console.log(`  ✓ ${f}`);
          totalFixes++;
        });
      }
    }
  }

  try {
    scanDir(srcDir);
  } catch (e) {
    // Directory doesn't exist or is empty
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Fixed ${totalFixes} issues in ${totalFiles} files`);
console.log('='.repeat(60));
