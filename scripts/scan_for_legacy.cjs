#!/usr/bin/env node
/**
 * Legacy Field Scanner
 * 
 * Scans src/ directory for forbidden legacy field names and patterns.
 * Exits with non-zero status if any legacy tokens are found.
 * 
 * Usage: node scripts/scan_for_legacy.js
 */

const fs = require('fs');
const path = require('path');

// Forbidden patterns (regex)
const FORBIDDEN_PATTERNS = [
  { pattern: /\bAAV\b/, name: 'AAV (use averageAnnualValue)' },
  { pattern: /\boverall_grade\b/, name: 'overall_grade (use overallGrade)' },
  { pattern: /\bfreeAgencyType\b/, name: 'freeAgencyType (use freeAgentType)' },
  { pattern: /\bfreeAgencyYear\b/, name: 'freeAgencyYear (use freeAgentYear)' },
  { pattern: /\bdisplay_name\b/, name: 'display_name (use bio.displayName)' },
  { pattern: /collection\(db,\s*['"]players['"]\)/, name: "collection(db, 'players') - use PLAYERS_COLLECTION constant" },
];

// Required patterns (must exist)
const REQUIRED_PATTERNS = [
  { pattern: /\baverageAnnualValue\b/, name: 'averageAnnualValue' },
  { pattern: /\boverallGrade\b/, name: 'overallGrade' },
  { pattern: /\bfreeAgentType\b/, name: 'freeAgentType' },
  { pattern: /\bfreeAgentYear\b/, name: 'freeAgentYear' },
  { pattern: /\bPLAYERS_COLLECTION\b/, name: 'PLAYERS_COLLECTION' },
];

const srcDir = path.join(__dirname, '..', 'src');
const violations = [];
const requiredFound = new Set();

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(srcDir, filePath);

  // Check forbidden patterns
  FORBIDDEN_PATTERNS.forEach(({ pattern, name }) => {
    const matches = content.match(new RegExp(pattern, 'g'));
    if (matches) {
      violations.push({
        file: relPath,
        pattern: name,
        count: matches.length,
      });
    }
  });

  // Check required patterns
  REQUIRED_PATTERNS.forEach(({ pattern, name }) => {
    if (pattern.test(content)) {
      requiredFound.add(name);
    }
  });
}

function scanDirectory(dir) {
  const items = fs.readdirSync(dir);

  items.forEach((item) => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (stat.isFile() && /\.(js|jsx|ts|tsx)$/.test(item)) {
      scanFile(fullPath);
    }
  });
}

// Run the scan
console.log('🔍 Scanning for legacy field patterns in src/...\n');
scanDirectory(srcDir);

// Report violations
let exitCode = 0;

if (violations.length > 0) {
  console.error('❌ Found forbidden legacy patterns:\n');
  violations.forEach(({ file, pattern, count }) => {
    console.error(`   ${file}: ${pattern} (${count} occurrence${count > 1 ? 's' : ''})`);
  });
  console.error('\n');
  exitCode = 1;
} else {
  console.log('✅ No forbidden legacy patterns found\n');
}

// Check required patterns
const missingRequired = REQUIRED_PATTERNS
  .map(({ name }) => name)
  .filter((name) => !requiredFound.has(name));

if (missingRequired.length > 0) {
  console.log('⚠️  Missing required v2 patterns:');
  missingRequired.forEach((name) => {
    console.log(`   - ${name}`);
  });
  console.log('\n');
  // Don't fail on missing patterns, just warn
} else {
  console.log('✅ All required v2 patterns found\n');
}

// Summary
console.log('📊 Scan Summary:');
console.log(`   Files scanned: ${countFiles(srcDir)}`);
console.log(`   Violations: ${violations.length}`);
console.log(`   Required patterns found: ${requiredFound.size}/${REQUIRED_PATTERNS.length}`);

process.exit(exitCode);

function countFiles(dir) {
  let count = 0;
  const items = fs.readdirSync(dir);

  items.forEach((item) => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      count += countFiles(fullPath);
    } else if (stat.isFile() && /\.(js|jsx|ts|tsx)$/.test(item)) {
      count++;
    }
  });

  return count;
}
