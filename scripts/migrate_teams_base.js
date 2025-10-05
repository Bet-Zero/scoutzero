#!/usr/bin/env node
/* ========================================================================
   MIGRATION: Teams Base Collection Migration (All-in-One, Shadow Write)
   ------------------------------------------------------------------------
   Migrates /teams collection to /teams_base_vNext with season-keyed structure
   
   USAGE:
     node scripts/migrate_teams_base.js --dry-run              (default, preview only)
     node scripts/migrate_teams_base.js --write                (write to shadow collection)
     node scripts/migrate_teams_base.js --team=LAL             (single team)
     node scripts/migrate_teams_base.js --limit=5              (first N teams)
     node scripts/migrate_teams_base.js --seasons=2024-25,2025-26  (filter seasons)
   ===================================================================== */

import minimist from 'minimist';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { db, getDocs, collection, doc, setDoc, serverTimestamp } from '../scripts/firebaseConfig.node.js';
import teamCodeMapData from '../mapping/teamCodeMap.json' with { type: 'json' };
import { TEAM_COLOR_MAP } from '../src/utils/formatting/teamColors.js';

/* ========================================================================
   CLI ARGUMENTS & CONFIGURATION
   ======================================================================== */

const args = minimist(process.argv.slice(2));
const isDryRun = !args.write;
const targetTeam = args.team?.trim().toUpperCase();
const limit = args.limit ? parseInt(args.limit, 10) : null;
const seasonFilter = args.seasons?.split(',').map(s => s.trim()) || null;

const SOURCE_COLLECTION = 'teams';
const TARGET_COLLECTION = 'teams_base_vNext';
const BATCH_SIZE = 450;
const OUTPUT_DIR = './migration_output';

/* ========================================================================
   UTILITIES
   ======================================================================== */

// Generate stable hash for idempotency
function computeHash(obj) {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return createHash('sha1').update(str).digest('hex');
}

// Convert team id to standard code (e.g., 'lakers' -> 'LAL')
function teamIdToCode(teamId) {
  const entry = Object.values(teamCodeMapData).find(t => t.id === teamId);
  return entry?.teamCode || teamId.toUpperCase();
}

// Get team metadata from mapping
function getTeamMetadata(teamId) {
  const code = teamIdToCode(teamId);
  const mapData = teamCodeMapData[code] || {};
  const colors = TEAM_COLOR_MAP[teamId] || {};
  
  return {
    teamCode: code,
    teamId: teamId,
    market: mapData.market || '',
    name: mapData.name || '',
    abbreviation: mapData.abbreviation || code,
    conference: mapData.conference || 'Unknown',
    division: mapData.division || 'Unknown',
    colors: {
      primary: colors.primary,
      secondary: colors.secondary,
      accent: colors.tertiary ? [colors.tertiary] : []
    },
    logos: {} // Can be populated if logo URLs are available
  };
}

// Extract season key from year (2025 -> "2024-25")
function toSeasonKey(year) {
  const startYear = year - 1;
  const endYear = year % 100;
  return `${startYear}-${endYear.toString().padStart(2, '0')}`;
}

// Parse currency string to number
function parseCurrency(value) {
  if (typeof value === 'number') return Math.round(value);
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,M]/g, '');
    const num = parseFloat(cleaned);
    if (value.includes('M')) return Math.round(num * 1_000_000);
    return Math.round(num);
  }
  return 0;
}

// Normalize player roster entry
function normalizeRosterPlayer(player) {
  return {
    playerId: player.player_id || player.id || null,
    displayName: player.display_name || player.name || 'Unknown',
    position: player.position || player.bio?.Position || null,
    contractRef: player.contract_clean ? {
      source: 'contract_clean',
      playerId: player.player_id || player.id
    } : null
  };
}

// Extract salary rows from contract data
function extractSalaryRows(player) {
  const rows = [];
  const contractClean = player.contract_clean;
  
  if (!contractClean?.salaries_by_year) return rows;
  
  for (const [yearStr, salaryData] of Object.entries(contractClean.salaries_by_year)) {
    const year = parseInt(yearStr, 10);
    if (isNaN(year)) continue;
    
    const amount = parseCurrency(salaryData.salary || 0);
    let type = 'base';
    
    if (salaryData.option === 'Team') type = 'option_team';
    else if (salaryData.option === 'Player') type = 'option_player';
    else if (salaryData.guaranteed === false) type = 'non_guaranteed';
    
    rows.push({
      playerId: player.player_id || player.id,
      year,
      amount,
      type,
      notes: salaryData.source || null
    });
  }
  
  return rows;
}

// Build totals by year from salary rows
function computeTotalsByYear(salaryRows, deadMoney = [], capHolds = []) {
  const totals = {};
  
  for (const row of salaryRows) {
    const yearStr = row.year.toString();
    if (!totals[yearStr]) {
      totals[yearStr] = { payroll: 0, deadMoney: 0, capHolds: 0 };
    }
    
    if (row.type === 'dead') {
      totals[yearStr].deadMoney += row.amount;
    } else if (row.type === 'cap_hold') {
      totals[yearStr].capHolds += row.amount;
    } else {
      totals[yearStr].payroll += row.amount;
    }
  }
  
  // Add standalone dead money
  for (const dead of deadMoney) {
    const yearStr = dead.year.toString();
    if (!totals[yearStr]) {
      totals[yearStr] = { payroll: 0, deadMoney: 0, capHolds: 0 };
    }
    totals[yearStr].deadMoney += dead.amount;
  }
  
  // Add cap holds
  for (const hold of capHolds) {
    // Cap holds typically apply to the current/next season
    // This is simplified; real logic would need FA year context
    const yearStr = new Date().getFullYear().toString();
    if (!totals[yearStr]) {
      totals[yearStr] = { payroll: 0, deadMoney: 0, capHolds: 0 };
    }
    totals[yearStr].capHolds += hold.amount;
  }
  
  return totals;
}

// Parse pick protection string
function parsePickProtection(protectionStr) {
  if (!protectionStr || typeof protectionStr !== 'string') return null;
  
  // Clean up common patterns
  const cleaned = protectionStr
    .replace(/top[- ]?(\d+)/i, 'Top-$1')
    .replace(/lottery/i, 'Lottery')
    .replace(/unprotected/i, 'Unprotected');
  
  return cleaned.trim();
}

/* ========================================================================
   TRANSFORMATION LOGIC
   ======================================================================== */

function transformTeamDoc(legacyDoc) {
  const teamId = legacyDoc.id;
  const data = legacyDoc.data();
  const meta = getTeamMetadata(teamId);
  
  const warnings = [];
  const seasons = {};
  
  // Extract capSheet data
  const capSheet = data.capSheet || {};
  const players = capSheet.players || [];
  
  // Determine available seasons from player contracts
  const seasonYears = new Set();
  for (const player of players) {
    if (player.contract_clean?.salaries_by_year) {
      for (const year of Object.keys(player.contract_clean.salaries_by_year)) {
        seasonYears.add(parseInt(year, 10));
      }
    }
  }
  
  // If no seasons found, default to current year
  if (seasonYears.size === 0) {
    const currentYear = new Date().getFullYear();
    seasonYears.add(currentYear);
    warnings.push(`${teamId}: No season data found, defaulting to ${currentYear}`);
  }
  
  // Build season-keyed structure
  for (const year of Array.from(seasonYears).sort()) {
    const seasonKey = toSeasonKey(year);
    
    // Filter players for this season
    const seasonPlayers = players.filter(p => {
      return p.contract_clean?.salaries_by_year?.[year] != null;
    });
    
    // Build roster
    const roster = {
      players: seasonPlayers.map(normalizeRosterPlayer),
      twoWays: players.filter(p => p.status === '2-Way' || p.contract?.type === 'Two-Way')
        .map(p => p.player_id || p.id).filter(Boolean),
      inactiveList: [],
      updatedAt: serverTimestamp()
    };
    
    // Build cap sheet
    const allSalaryRows = [];
    for (const player of players) {
      allSalaryRows.push(...extractSalaryRows(player));
    }
    
    const salaryRowsForYear = allSalaryRows.filter(r => r.year === year);
    
    const cap = {
      salaryRows: salaryRowsForYear,
      totalsByYear: computeTotalsByYear(allSalaryRows),
      exceptions: data.exceptions || [],
      aprons: {
        hardCapActive: false,
        apron1Breached: false,
        apron2Breached: false
      },
      tpes: data.tradeExceptions || [],
      deadMoney: [],
      capHolds: [],
      rights: [],
      updatedAt: serverTimestamp()
    };
    
    // Build picks ledger (if available)
    const picks = {
      incoming: data.picks?.incoming || [],
      outgoing: data.picks?.outgoing || [],
      updatedAt: serverTimestamp()
    };
    
    // Normalize pick protection
    picks.incoming = picks.incoming.map(p => ({
      ...p,
      protection: parsePickProtection(p.protection)
    }));
    picks.outgoing = picks.outgoing.map(p => ({
      ...p,
      protection: parsePickProtection(p.protection)
    }));
    
    seasons[seasonKey] = {
      roster,
      cap,
      picks,
      transactions: data.transactions || [],
      notes: data.notes || '',
      updatedAt: serverTimestamp()
    };
  }
  
  return {
    transformed: {
      meta: {
        ...meta,
        updatedAt: serverTimestamp()
      },
      seasons
    },
    warnings
  };
}

/* ========================================================================
   MIGRATION EXECUTION
   ======================================================================== */

async function runMigration() {
  console.log('🚀 Teams Base Migration');
  console.log('='.repeat(60));
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (preview only)' : 'WRITE (to shadow collection)'}`);
  console.log(`Source: /${SOURCE_COLLECTION}`);
  console.log(`Target: /${TARGET_COLLECTION}`);
  if (targetTeam) console.log(`Filter: Single team = ${targetTeam}`);
  if (limit) console.log(`Limit: ${limit} teams`);
  if (seasonFilter) console.log(`Seasons: ${seasonFilter.join(', ')}`);
  console.log('='.repeat(60));
  console.log('');
  
  // Create output directory
  await mkdir(OUTPUT_DIR, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const warnings = [];
  const results = {
    scanned: 0,
    transformed: 0,
    skippedIdentical: 0,
    written: 0,
    errors: 0
  };
  
  // Read source collection
  const snapshot = await getDocs(collection(db, SOURCE_COLLECTION));
  console.log(`📦 Loaded ${snapshot.docs.length} teams from /${SOURCE_COLLECTION}`);
  console.log('');
  
  let processed = 0;
  const previews = [];
  
  for (const docSnap of snapshot.docs) {
    results.scanned++;
    
    // Apply filters
    const teamId = docSnap.id;
    const teamCode = teamIdToCode(teamId);
    
    if (targetTeam && teamCode !== targetTeam) continue;
    if (limit && processed >= limit) break;
    
    try {
      // Transform
      const { transformed, warnings: docWarnings } = transformTeamDoc(docSnap);
      results.transformed++;
      
      // Apply season filter if specified
      if (seasonFilter) {
        const filteredSeasons = {};
        for (const seasonKey of seasonFilter) {
          if (transformed.seasons[seasonKey]) {
            filteredSeasons[seasonKey] = transformed.seasons[seasonKey];
          }
        }
        transformed.seasons = filteredSeasons;
      }
      
      // Compute hash for idempotency
      const docHash = computeHash(transformed);
      
      // Check if already exists with same hash
      const targetRef = doc(db, TARGET_COLLECTION, teamCode);
      let skipIdentical = false;
      
      if (!isDryRun) {
        try {
          const existingSnap = await targetRef.get();
          if (existingSnap.exists()) {
            const existingHash = computeHash(existingSnap.data());
            if (existingHash === docHash) {
              skipIdentical = true;
              results.skippedIdentical++;
            }
          }
        } catch (err) {
          // Ignore - doc doesn't exist yet
        }
      }
      
      // Write to shadow collection
      if (!isDryRun && !skipIdentical) {
        await setDoc(targetRef, transformed);
        results.written++;
      }
      
      // Store warnings
      if (docWarnings.length > 0) {
        warnings.push(...docWarnings);
      }
      
      // Prepare preview
      const preview = {
        teamCode,
        teamId,
        seasons: Object.keys(transformed.seasons).sort(),
        playerCount: Object.values(transformed.seasons)[0]?.roster?.players?.length || 0,
        hash: docHash.substring(0, 8),
        status: skipIdentical ? 'SKIPPED (identical)' : (isDryRun ? 'PREVIEW' : 'WRITTEN')
      };
      previews.push(preview);
      
      // Console output
      const statusIcon = skipIdentical ? '⏭️' : (isDryRun ? '🔍' : '✅');
      console.log(`${statusIcon} ${teamCode.padEnd(4)} | Seasons: ${preview.seasons.join(', ').padEnd(20)} | Players: ${preview.playerCount.toString().padStart(2)} | ${preview.status}`);
      
      // Save artifacts
      const beforePath = path.join(OUTPUT_DIR, `${teamCode}.before.json`);
      const afterPath = path.join(OUTPUT_DIR, `${teamCode}.after.json`);
      
      await writeFile(beforePath, JSON.stringify(docSnap.data(), null, 2));
      await writeFile(afterPath, JSON.stringify(transformed, null, 2));
      
      processed++;
      
    } catch (error) {
      console.error(`❌ Error processing ${teamId}:`, error.message);
      warnings.push(`${teamId}: ERROR - ${error.message}`);
      results.errors++;
    }
  }
  
  // Write preview NDJSON
  const previewPath = path.join(OUTPUT_DIR, `preview_${timestamp}.ndjson`);
  const previewContent = previews.map(p => JSON.stringify(p)).join('\n');
  await writeFile(previewPath, previewContent);
  
  // Write warnings log
  if (warnings.length > 0) {
    const warningsPath = path.join(OUTPUT_DIR, `warnings_${timestamp}.log`);
    await writeFile(warningsPath, warnings.join('\n'));
  }
  
  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Scanned:          ${results.scanned}`);
  console.log(`Transformed:      ${results.transformed}`);
  console.log(`Skipped (same):   ${results.skippedIdentical}`);
  console.log(`Written:          ${results.written}`);
  console.log(`Errors:           ${results.errors}`);
  console.log(`Warnings:         ${warnings.length}`);
  console.log('');
  console.log(`📁 Output saved to: ${OUTPUT_DIR}/`);
  console.log(`   - preview_${timestamp}.ndjson`);
  if (warnings.length > 0) {
    console.log(`   - warnings_${timestamp}.log`);
  }
  console.log('   - {TEAM}.before.json (for each team)');
  console.log('   - {TEAM}.after.json (for each team)');
  console.log('='.repeat(60));
  
  if (warnings.length > 0) {
    console.log('');
    console.log('⚠️  WARNINGS:');
    warnings.slice(0, 10).forEach(w => console.log(`   ${w}`));
    if (warnings.length > 10) {
      console.log(`   ... and ${warnings.length - 10} more (see warnings log)`);
    }
  }
  
  console.log('');
  if (isDryRun) {
    console.log('💡 This was a DRY-RUN. Run with --write to commit changes.');
  } else {
    console.log(`✅ Migration complete! Data written to /${TARGET_COLLECTION}`);
  }
}

/* ========================================================================
   ENTRY POINT
   ======================================================================== */

runMigration().catch(err => {
  console.error('');
  console.error('💥 MIGRATION FAILED');
  console.error('='.repeat(60));
  console.error(err);
  process.exit(1);
});
