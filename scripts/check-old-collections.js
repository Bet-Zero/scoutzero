#!/usr/bin/env node
/**
 * check-old-collections.js
 * 
 * Checks if any code is still reading from old Firestore collections:
 * - /teams
 * - /players (legacy)
 * 
 * Run this before deleting old collections to ensure nothing breaks.
 */

const { readFileSync } = require('fs');
const { execSync } = require('child_process');

console.log('🔍 Checking for references to old Firestore collections...\n');

// Check for direct collection references
const patterns = [
  { pattern: /collection\([^)]*['"]teams['"]/g, name: 'collection("teams")' },
  { pattern: /doc\([^)]*['"]teams['"]/g, name: 'doc("teams")' },
  { pattern: /['"]\/teams['"]/g, name: '"teams" path' },
  { pattern: /collection\([^)]*['"]players['"]/g, name: 'collection("players")' },
  { pattern: /doc\([^)]*['"]players['"]/g, name: 'doc("players")' },
];

let foundAny = false;

for (const { pattern, name } of patterns) {
  try {
    const result = execSync(
      `grep -r "${pattern.source}" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" || true`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );
    
    if (result.trim()) {
      console.log(`⚠️  Found references to ${name}:`);
      const lines = result.trim().split('\n').filter(Boolean);
      lines.forEach(line => {
        const [file, ...rest] = line.split(':');
        console.log(`   ${file}: ${rest.join(':')}`);
      });
      console.log('');
      foundAny = true;
    }
  } catch (err) {
    // grep returns non-zero if no matches, which is fine
  }
}

// Check diagnostic component (this is OK, it's just for checking)
console.log('📋 Note: FirestoreDataDiagnostic.jsx mentions old collections for diagnostic purposes - this is OK.\n');

if (!foundAny) {
  console.log('✅ No active code references found to old collections!');
  console.log('   Safe to delete /teams and /players collections.\n');
} else {
  console.log('⚠️  Found references above. Review before deleting collections.\n');
}

console.log('💡 To verify in Firestore:');
console.log('   1. Check if /teams collection exists');
console.log('   2. Check if /players collection exists');
console.log('   3. If they exist and you want to delete them:');
console.log('      - Export them first as backup');
console.log('      - Delete after confirming nothing breaks\n');


