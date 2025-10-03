#!/usr/bin/env node
/* Enhanced Firestore migration runner (Phase 1 - Production Ready) */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { transforms } = require('./transforms');
const { validateTarget } = require('./validate_target');

// Initialize Firebase
if (!admin.apps.length) { admin.initializeApp(); }
const db = admin.firestore();

// Constants
const BATCH_SIZE = 450; // Safety margin below Firestore's 500 limit
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Parse command line arguments
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--dry-run' || key === '--shadow' || key === '--backup') {
      args[key.slice(2)] = true;
      continue;
    }
    if (key.startsWith('--')) {
      args[key.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

// Load mapping configuration
function loadMapping(mappingPath) {
  const raw = fs.readFileSync(mappingPath, 'utf8');
  const mapping = JSON.parse(raw);
  mapping.placeholders = mapping.placeholders || {
    seasonId: '2025-26',
    contractId: 'std_202425'
  };
  return mapping;
}

// Apply placeholders to path
function applyPlaceholders(str, placeholders) {
  return str.replaceAll('{seasonId}', placeholders.seasonId)
    .replaceAll('{contractId}', placeholders.contractId);
}

// Get value by path
function getByPath(obj, path) {
  if (obj == null) return undefined;
  const normalized = String(path).replace(/\[['"]([^'"]+)['"]\]/g, '.$1');
  return normalized.split('.').filter(Boolean).reduce((current, key) => 
    current ? current[key] : undefined, obj);
}

// Set value by path
function setByPath(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

// Map document from legacy to new structure
function mapDoc(legacy, mapping) {
  const targetDoc = {};
  const warnings = [];
  
  for (const row of mapping.mappings) {
    try {
      const targetPath = applyPlaceholders(row.to, mapping.placeholders);
      const sourcePath = row.from;
      const rawValue = getByPath(legacy, sourcePath);
      
      const transformFn = transforms[row.transform || 'copy'] || transforms.copy;
      const transformedValue = transformFn(rawValue, {
        legacy,
        row,
        toPath: targetPath,
        fromPath: sourcePath,
        placeholders: mapping.placeholders
      });
      
      if (transformedValue !== undefined) {
        setByPath(targetDoc, targetPath, transformedValue);
      }
    } catch (error) {
      warnings.push(`${row.to}<-${row.from}: ${error.message}`);
    }
  }
  
  return { targetDoc, warnings };
}

// Retry with exponential backoff
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
      console.log(`  ⚠️ Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Create backup of source collection
async function createBackup(sourceCollection, backupPath) {
  console.log('📦 Creating backup...');
  
  const snapshot = await sourceCollection.get();
  const backup = {};
  
  snapshot.docs.forEach(doc => {
    backup[doc.id] = doc.data();
  });
  
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`✅ Backup created: ${backupPath} (${snapshot.size} documents)`);
  
  return snapshot.size;
}

// Validate edge cases
function validateEdgeCases(targetDoc, playerId) {
  const issues = [];
  
  // Check for rookie data (minimal bio)
  if (targetDoc.bio && !targetDoc.bio.draft) {
    issues.push('Missing draft info (possible rookie)');
  }
  
  // Check for free agent
  if (targetDoc.bio?.display?.freeAgentYear && 
      targetDoc.bio.display.freeAgentYear <= new Date().getFullYear()) {
    issues.push('Free agent - verify contract data');
  }
  
  // Check for complex contracts (options, incentives)
  if (targetDoc.contracts) {
    const contractIds = Object.keys(targetDoc.contracts);
    contractIds.forEach(contractId => {
      const contract = targetDoc.contracts[contractId];
      if (contract.options && contract.options.length > 0) {
        issues.push(`Contract has ${contract.options.length} options`);
      }
      if (contract.incentives && 
          (contract.incentives.likely > 0 || contract.incentives.unlikely > 0)) {
        issues.push('Contract has incentives');
      }
    });
  }
  
  // Check season data consistency
  if (targetDoc.seasons) {
    const seasonIds = Object.keys(targetDoc.seasons);
    if (seasonIds.length === 0) {
      issues.push('No season data');
    }
  }
  
  return issues;
}

// Process batch of documents
async function processBatch(batch, docs, mapping, dstCollection, isDryRun) {
  const results = { ok: 0, fail: 0, warnings: 0, edgeCases: 0 };
  const batchOps = [];
  
  for (const doc of docs) {
    const legacy = doc.data();
    const playerId = doc.id;
    
    // Transform document
    const { targetDoc, warnings } = mapDoc(legacy, mapping);
    
    // Validate target
    const validationErrors = validateTarget(targetDoc);
    if (validationErrors.length) {
      console.error(`❌ VALIDATION ${playerId}:`, validationErrors);
      results.fail++;
      continue;
    }
    
    // Check edge cases
    const edgeCaseIssues = validateEdgeCases(targetDoc, playerId);
    if (edgeCaseIssues.length > 0) {
      console.log(`⚠️  EDGE CASE ${playerId}:`, edgeCaseIssues.join(', '));
      results.edgeCases++;
    }
    
    if (warnings.length > 0) {
      console.log(`⚠️  WARNINGS ${playerId} (${warnings.length}):`, warnings.slice(0, 3).join('; '));
      results.warnings++;
    }
    
    if (isDryRun) {
      console.log(`✓ DRY ${playerId}`);
      results.ok++;
    } else {
      batchOps.push({ ref: dstCollection.doc(playerId), data: targetDoc });
      results.ok++;
    }
  }
  
  // Commit batch if not dry run
  if (!isDryRun && batchOps.length > 0) {
    for (const op of batchOps) {
      batch.set(op.ref, op.data, { merge: true });
    }
    
    await retryWithBackoff(async () => {
      await batch.commit();
      console.log(`✅ Batch committed: ${batchOps.length} documents`);
    });
  }
  
  return results;
}

// Main migration function
async function main() {
  console.log('🚀 Enhanced Firestore Migration (Phase 1)');
  console.log('==========================================\n');
  
  const args = parseArgs(process.argv);
  const mappingPath = args.mapping || path.resolve('./mapping_phase1_FINAL.json');
  const mapping = loadMapping(mappingPath);
  
  console.log('📋 Configuration:');
  console.log(`   Mapping: ${mappingPath}`);
  console.log(`   Season: ${mapping.placeholders.seasonId}`);
  console.log(`   Contract ID: ${mapping.placeholders.contractId}`);
  console.log(`   Mode: ${args['dry-run'] ? 'DRY RUN' : (args.shadow ? 'SHADOW' : 'LIVE')}`);
  console.log('');
  
  // Source and destination collections
  const srcCollection = db.collection('players');
  const dstCollectionName = args.shadow ? 'players_v2_shadow' : 'players_v2';
  const dstCollection = db.collection(dstCollectionName);
  
  // Create backup if requested
  if (args.backup && !args['dry-run']) {
    const backupPath = path.resolve(`./backup_players_${Date.now()}.json`);
    await createBackup(srcCollection, backupPath);
    console.log('');
  }
  
  // Build query
  let query = srcCollection.orderBy(admin.firestore.FieldPath.documentId());
  if (args.startAfter) query = query.startAfter(args.startAfter);
  if (args.limit) query = query.limit(Number(args.limit));
  
  // Get all documents
  console.log('📥 Fetching documents...');
  const snapshot = await query.get();
  console.log(`   Found: ${snapshot.size} documents\n`);
  
  if (snapshot.size === 0) {
    console.log('⚠️  No documents to migrate');
    return;
  }
  
  // Process in batches
  console.log('🔄 Processing documents...\n');
  const totalResults = { ok: 0, fail: 0, warnings: 0, edgeCases: 0 };
  const docs = snapshot.docs;
  
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batchDocs = docs.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(docs.length / BATCH_SIZE);
    
    console.log(`📦 Batch ${batchNum}/${totalBatches} (${batchDocs.length} documents):`);
    
    const batch = db.batch();
    const batchResults = await processBatch(
      batch, 
      batchDocs, 
      mapping, 
      dstCollection, 
      args['dry-run']
    );
    
    totalResults.ok += batchResults.ok;
    totalResults.fail += batchResults.fail;
    totalResults.warnings += batchResults.warnings;
    totalResults.edgeCases += batchResults.edgeCases;
    
    console.log('');
  }
  
  // Summary
  console.log('==========================================');
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Success: ${totalResults.ok}`);
  console.log(`   ❌ Failed: ${totalResults.fail}`);
  console.log(`   ⚠️  Warnings: ${totalResults.warnings}`);
  console.log(`   🔍 Edge Cases: ${totalResults.edgeCases}`);
  console.log('');
  
  if (totalResults.fail > 0) {
    console.log('⚠️  Some documents failed validation - review errors above');
    process.exit(1);
  }
  
  if (totalResults.edgeCases > 0) {
    console.log('ℹ️  Edge cases detected - manual review recommended');
  }
  
  if (args['dry-run']) {
    console.log('✅ Dry run completed - no data written to Firestore');
  } else {
    console.log(`✅ Migration completed successfully to ${dstCollectionName}`);
    if (!args.shadow) {
      console.log('');
      console.log('⚠️  NEXT STEPS:');
      console.log('   1. Verify data in Firebase Console');
      console.log('   2. Update frontend code to use players_v2 collection');
      console.log('   3. Test application thoroughly');
      console.log('   4. Monitor for 48 hours before removing old collection');
    }
  }
}

// Run migration
main().catch(error => {
  console.error('💥 Migration failed:', error);
  process.exit(1);
});
