#!/usr/bin/env tsx
/**
 * FILE: team-scrape/draft-picks/scripts/pst/pst_phase_8_build_entitlement_assets.ts
 * PURPOSE: Generate Entitlement Assets from the Pick Ledger.
 * 
 * Implements the Spec defined in docs/team-scrape/PST_PHASE_8_ENTITLEMENT_ASSETS_MASTER_SPEC.md.
 * Transforms raw picks and selectionSpecs into tradeable Entitlement Assets.
 *
 * TRADE MACHINE CONTRACT:
 * - The Trade Machine consumes `EntitlementAsset` objects ONLY (from the output JSON).
 * - "Base Picks" (pick_ownership) are immutable slots, not directly traded.
 * - Entitlements (clean ownership, conveyance, swap) sit "on top" of Base Picks.
 * - Resolution (Entitlement -> Slot) happens post-lottery.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { TeamCode } from './pst_pick_rule_parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');
const DATA_DIR = path.join(PROJECT_ROOT, 'data/pst');

// Input File
const LEDGER_PATH = path.join(DATA_DIR, 'pst_pick_ledger_final_2026_2033.json');

// Output Files
const OUTPUT_ASSETS_PATH = path.join(DATA_DIR, 'pst_entitlement_assets_2026_2033.json');
const OUTPUT_BY_TEAM_PATH = path.join(DATA_DIR, 'pst_entitlements_by_team_2026_2033.json');

type EntitlementKind = 'pick_ownership' | 'conveyance_right' | 'swap_right';

interface EntitlementAsset {
  id: string;
  holderTeam: string;
  seasonYear: number;
  round: 1 | 2;
  kind: EntitlementKind;
  description: string;
  
  // pick_ownership
  underlyingPickId?: string;
  
  // conveyance_right
  poolUnderlyingPickIds?: string[];
  receivesRank?: number[];
  receivesComparator?: 'more_favorable' | 'less_favorable' | 'middle';
  
  // swap_right
  swapControllerPickId?: string;
  swapTargetDefinition?: string;
  
  // Metadata
  evidenceRowRefs: string[];
  sourceUrl?: string;
  
  // Phase 8.1: Physical Slot Metadata (pick_ownership only)
  underlyingStatus?: 'pooled' | 'encumbered' | 'clean';
  coveredByEntitlementIds?: string[];
  
  // Internal (removed before save if needed, but useful for dedup logic)
  _hashSource?: string;
}

// Ledger Types (simplified)
interface LedgerPick {
  pickId: string;
  year: number;
  round: 1 | 2;
  originalTeam: string;
  owner: string;
  encumbrances: {
    selectionSpecs: SelectionSpec[];
    protections: any[];
  };
  evidenceRowRefs: string[];
}

interface SelectionSpec {
  kind: 'swap' | 'swap_right' | 'conveys';
  controller?: string;
  order?: 'most' | 'least';
  rank?: number;
  pool: string[];
  year: number;
  round: 1 | 2;
  description: string;
  evidenceRowRefs: string[];
}

// Helpers
function generateHash(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
}

function normalizeComparator(order?: 'most' | 'least'): 'more_favorable' | 'less_favorable' | undefined {
  if (order === 'most') return 'more_favorable';
  if (order === 'least') return 'less_favorable';
  return undefined;
}

function main() {
  console.log('Loading ledger...');
  const ledgerRaw = fs.readFileSync(LEDGER_PATH, 'utf-8');
  const ledger = JSON.parse(ledgerRaw) as { picks: LedgerPick[] };
  
  const allAssets: EntitlementAsset[] = [];
  const seenHashes = new Set<string>();
  
  console.log(`Processing ${ledger.picks.length} picks...`);
  
  // Iterate all picks
  for (const pick of ledger.picks) {
    const { pickId, owner, year, round, encumbrances } = pick;
    const specs = encumbrances.selectionSpecs || [];
    
    // 1. Process Selection Specs -> Generated Entitlements
    for (const spec of specs) {
      let holder = spec.controller;
      if (!holder) {
         // Fallback: If controller is missing (common for 'conveys'), assume the pick owner holds the right.
         // This is critical for cases like HOU 2029 where 'conveys' specs are attached to HOU-owned picks 
         // but lack an explicit controller field in the ledger.
         holder = pick.owner;
      }
      
      const poolIds = spec.pool.map(team => `${team}_${year}_${round === 1 ? '1st' : '2nd'}`);
      
      let kind: EntitlementKind;
      let asset: Partial<EntitlementAsset> = {};
      
      // HOU-style Separable Split Check
      // Pattern: "Rank 2 of 3" where holder is in the pool.
      // This mathematically splits into:
      // 1. Conveyance: Best of (Others)
      // 2. Swap Right: Holder vs Worst of (Others)
      if (spec.kind === 'conveys' && spec.pool.length === 3 && spec.rank === 2 && spec.pool.includes(holder)) {
        const others = spec.pool.filter(t => t !== holder).sort();
        if (others.length === 2) {
           // Asset 1: Conveyance (Best of Others)
           const convHashContent = [holder, year, round, 'conveyance_right', others.join(','), '1-more_favorable'].join('|');
           const convId = `ent:${holder}:${year}:${round}:conv:${generateHash(convHashContent)}`;
           
           if (!seenHashes.has(convId)) {
             seenHashes.add(convId);
             allAssets.push({
               id: convId,
               holderTeam: holder,
               seasonYear: year,
               round,
               kind: 'conveyance_right',
               description: `Most favorable of ${others.join(', ')}`,
               evidenceRowRefs: spec.evidenceRowRefs,
               poolUnderlyingPickIds: others.map(t => `${t}_${year}_${round === 1 ? '1st' : '2nd'}`),
               receivesRank: [1],
               receivesComparator: 'more_favorable'
             });
           }
           
           // Asset 2: Swap Right (Holder vs Worst of Others)
           // "Right to swap HOU vs Less Favorable of (DAL, PHX)"
           const swapHashContent = [holder, year, round, "swap_right", `target=less(${others.join(',')})`].join('|');
           const swapId = `ent:${holder}:${year}:${round}:swap:${generateHash(swapHashContent)}`;
           
           if (!seenHashes.has(swapId)) {
              seenHashes.add(swapId);
              allAssets.push({
                id: swapId,
                holderTeam: holder,
                seasonYear: year,
                round,
                kind: 'swap_right',
                description: `Swap Right: ${holder} vs (Less favorable of ${others.join(', ')})`,
                evidenceRowRefs: spec.evidenceRowRefs,
                swapControllerPickId: `${holder}_${year}_${round === 1 ? '1st' : '2nd'}`,
                swapTargetDefinition: `Less favorable of ${others.join(', ')}`,
                // We assume the pool includes all 3 for audit, but swapTarget defines the actual logic
                poolUnderlyingPickIds: spec.pool.map(t => `${t}_${year}_${round === 1 ? '1st' : '2nd'}`)
              });
           }
           
           continue; // Skip standard generation
        }
      }

      if (spec.kind === 'swap_right') {
        kind = 'swap_right';
        // For swap_right, controller holds option to swap THEIR pick
        const controllerPickId = `${holder}_${year}_${round === 1 ? '1st' : '2nd'}`;
        
        asset = {
          swapControllerPickId: controllerPickId,
          // Refine description to be generic if possible, but spec.description is usually good
          swapTargetDefinition: `Option to swap with ${spec.pool.filter(t => t !== holder).join('/')} pool`,
          // We can use the spec description directly or standardized
          description: spec.description || `Swap option: ${holder} vs pool` // Fallback
        };
      } else {
        // 'swap' (Ranked) or 'conveys' -> Conveyance Right
        kind = 'conveyance_right';
        asset = {
          poolUnderlyingPickIds: poolIds,
          receivesRank: spec.rank ? [spec.rank] : [1],
          receivesComparator: normalizeComparator(spec.order),
          // Description
          description: spec.description // e.g. "Most favorable of HOU, DAL, PHX"
        };
      }
      
      // Generate Content Hash for Dedup
      const hashContent = [
        holder,
        year,
        round,
        kind,
        // Sort pool for consistency
        poolIds.sort().join(','),
        // For conveyance, include rank/order
        kind === 'conveyance_right' ? `${asset.receivesRank?.join(',')}-${asset.receivesComparator}` : 'opt',
      ].join('|');
      
      const hash = generateHash(hashContent);
      const id = `ent:${holder}:${year}:${round}:${kind === 'conveyance_right' ? 'conv' : 'swap'}:${hash}`;
      
      if (!seenHashes.has(id)) {
        seenHashes.add(id);
        allAssets.push({
          id,
          holderTeam: holder,
          seasonYear: year,
          round,
          kind,
          description: asset.description || 'Unknown Entitlement',
          evidenceRowRefs: spec.evidenceRowRefs,
          ...asset
        } as EntitlementAsset);
      }
    }
  }

  // 2. Post-Process: Determine Pick Ownership (Residual)
  // We re-iterate picks to see if the OWNER is "covered" by a conveyance entitlement they hold.
  
  for (const pick of ledger.picks) {
    const { pickId, owner, year, round } = pick;
    
    // Check if 'owner' holds a conveyance_right that includes this pickId
    // AND that conveyance right is effectively 'claiming' this pick slot.
    // Logic: If I hold "Most Favorable of (Me, You)", I don't hold "Me" separately.
    // If I hold "Least Favorable of (Me, You)", I don't hold "Me" separately.
    // Basically, if I have any pooled conveyance right involving my pick, that right supersedes simple ownership.
    
    // Determine status for Phase 8.1
    const coveredByEntitlements = allAssets.filter(asset => 
      asset.holderTeam === owner &&
      asset.kind === 'conveyance_right' &&
      asset.poolUnderlyingPickIds?.includes(pickId)
    );
    
    let underlyingStatus: 'pooled' | 'encumbered' | 'clean' = 'clean';
    if (coveredByEntitlements.length > 0) {
      underlyingStatus = 'pooled';
    } else if ((pick.encumbrances.swaps && pick.encumbrances.swaps.length > 0) || (pick.encumbrances.selectionSpecs && pick.encumbrances.selectionSpecs.length > 0)) {
      underlyingStatus = 'encumbered';
    }
    
    // Always Generate Simple Ownership Entitlement (Phase 8.1)
    const hashContent = `own|${pickId}`;
    const hash = generateHash(hashContent);
    const id = `ent:${owner}:${year}:${round}:own:${hash}`;
    
    if (!seenHashes.has(id)) {
      seenHashes.add(id);
      
      // Check for protection metadata
      const protections = pick.encumbrances.protections;
      let desc = `${owner} ${year} ${round === 1 ? '1st' : '2nd'} Round Pick`;
      if (pick.originalTeam !== owner) {
        desc += ` (via ${pick.originalTeam})`; // Simplified via logic
      }
      if (protections.length > 0) {
          desc += ` [Protected]`;
      }

      allAssets.push({
        id,
        holderTeam: owner,
        seasonYear: year,
        round,
        kind: 'pick_ownership',
        underlyingPickId: pickId,
        description: desc,
        evidenceRowRefs: pick.evidenceRowRefs,
        underlyingStatus,
        coveredByEntitlementIds: coveredByEntitlements.length > 0 ? coveredByEntitlements.map(e => e.id) : undefined
      } as EntitlementAsset);
    }
  }
  
  // Sort assets by Year -> Holder -> ID
  allAssets.sort((a, b) => {
    if (a.seasonYear !== b.seasonYear) return a.seasonYear - b.seasonYear;
    if (a.holderTeam !== b.holderTeam) return a.holderTeam.localeCompare(b.holderTeam);
    return a.id.localeCompare(b.id);
  });
  
  // Group by Team
  const byTeam: Record<string, EntitlementAsset[]> = {};
  for (const asset of allAssets) {
    if (!byTeam[asset.holderTeam]) byTeam[asset.holderTeam] = [];
    byTeam[asset.holderTeam].push(asset);
  }
  
  // Write Outputs
  fs.writeFileSync(OUTPUT_ASSETS_PATH, JSON.stringify({
    meta: {
      generatedAt: new Date().toISOString(),
      count: allAssets.length
    },
    assets: allAssets
  }, null, 2));
  
  fs.writeFileSync(OUTPUT_BY_TEAM_PATH, JSON.stringify(byTeam, null, 2));
  
  console.log(`Generated ${allAssets.length} entitlement assets.`);
  console.log(`Written to ${OUTPUT_ASSETS_PATH} and ${OUTPUT_BY_TEAM_PATH}`);
}

main();
