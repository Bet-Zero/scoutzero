#!/usr/bin/env node

/**
 * Legacy Token Scanner
 * 
 * Scans src/ directory for forbidden legacy field names and patterns.
 * Fails the build if any are found.
 */

const fs = require('fs');
const path = require('path');

// Forbidden tokens and their descriptions
const FORBIDDEN_PATTERNS = [
  { pattern: /\bAAV\b/g, name: 'AAV', replacement: 'averageAnnualValue' },
  { pattern: /\boverall_grade\b/g, name: 'overall_grade', replacement: 'overallGrade' },
  { pattern: /\bfreeAgencyType\b/g, name: 'freeAgencyType', replacement: 'freeAgentType' },
  { pattern: /\bfreeAgencyYear\b/g, name: 'freeAgencyYear', replacement: 'freeAgentYear' },
  { pattern: /\bdisplay_name\b/g, name: 'display_name', replacement: 'bio.displayName' },
  { pattern: /collection\(['"]players['"]\)/g, name: "collection('players')", replacement: 'PLAYERS_COLLECTION constant' },
];

// File extensions to scan
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

// Directories to skip
const SKIP_DIRS = ['node_modules', 'dist', 'build', '.git', 'coverage'];

/**
 * Recursively scan directory for files
 */
function* walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.includes(file)) {
        yield* walkDir(filePath);
      }
    } else if (EXTENSIONS.some(ext => file.endsWith(ext))) {
      yield filePath;
    }
  }
}

/**
 * Scan a file for forbidden patterns
 */
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const violations = [];
  
  for (const { pattern, name, replacement } of FORBIDDEN_PATTERNS) {
    let match;
    pattern.lastIndex = 0; // Reset regex state
    
    while ((match = pattern.exec(content)) !== null) {
      const lines = content.substring(0, match.index).split('\n');
      const line = lines.length;
      const column = lines[lines.length - 1].length + 1;
      
      violations.push({
        file: filePath,
        line,
        column,
        token: name,
        replacement,
        context: content.split('\n')[line - 1].trim()
      });
    }
  }
  
  return violations;
}

/**
 * Main execution
 */
function main() {
  const srcDir = path.join(process.cwd(), 'src');
  
  if (!fs.existsSync(srcDir)) {
    console.error('❌ Error: src/ directory not found');
    process.exit(1);
  }
  
  console.log('🔍 Scanning for legacy tokens in src/...\n');
  
  const allViolations = [];
  
  for (const filePath of walkDir(srcDir)) {
    const violations = scanFile(filePath);
    allViolations.push(...violations);
  }
  
  if (allViolations.length === 0) {
    console.log('✅ No legacy tokens found! Codebase is clean.\n');
    process.exit(0);
  }
  
  console.error(`❌ Found ${allViolations.length} legacy token(s):\n`);
  
  // Group violations by file
  const byFile = {};
  for (const v of allViolations) {
    if (!byFile[v.file]) byFile[v.file] = [];
    byFile[v.file].push(v);
  }
  
  for (const [file, violations] of Object.entries(byFile)) {
    const relPath = path.relative(process.cwd(), file);
    console.error(`\n📄 ${relPath}:`);
    
    for (const v of violations) {
      console.error(`   Line ${v.line}:${v.column} - "${v.token}" should be "${v.replacement}"`);
      console.error(`      ${v.context}`);
    }
  }
  
  console.error('\n❌ Build failed: Remove all legacy tokens before continuing.\n');
  process.exit(1);
}

main();
