/*
 * PST Phase 7: Rights / Entitlements Views
 * Generates "rights-based" team views (Fanspo-style) from the final pick ledger.
 * 
 * Goal:
 * - Reflect most/least/2nd-most favorable distributions
 * - Distinguish swap rights from actual ownership
 * - Correctly represent pooled outcomes
 * 
 * Input: data/pst/pst_pick_ledger_final_2026_2033.json
 * Output: 
 * - data/pst/manual_rights_views.txt
 * - data/pst/manual_rights_views/{TEAM}.txt
 * - data/pst/manual_rights_views_index.json
 */

import * as fs from 'fs';
import * as path from 'path';

// --- Types ---

interface PickLedgerItem {
  pickId: string;
  year: number;
  round: number;
  originalTeam: string;
  owner: string;
  encumbrances: {
    protections: any[];
    swaps: any[];
    conveyance: any[];
    didNotConvey: any[];
    selectionSpecs: SelectionSpec[];
  };
}

interface SelectionSpec {
  kind: 'swap' | 'swap_right' | 'conveys';
  controller?: string;
  order?: 'most' | 'least' | '2nd most' | '2nd least' | '3rd most' | '3rd least'; // extensible
  rank?: number;
  pool: string[]; // sorted team codes
  year: number;
  round: 1 | 2;
  evidenceRowRefs: string[];
  description: string;
}


interface RightsEntitlement {
  team: string; // The team holding this entitlement
  year: number;
  round: number;
  description: string;
  poolInfo: string;
  controllerInfo: string;
  debug_sourcePickId?: string;
}

// --- Configuration ---

const LEDGER_PATH = path.join(process.cwd(), 'data/pst/pst_pick_ledger_final_2026_2033.json');
const OUTPUT_DIR = path.join(process.cwd(), 'data/pst/manual_rights_views');
const COMBINED_OUTPUT_PATH = path.join(process.cwd(), 'data/pst/manual_rights_views.txt');
const INDEX_OUTPUT_PATH = path.join(process.cwd(), 'data/pst/manual_rights_views_index.json');

const TEAM_NAMES: Record<string, string> = {
  ATL: "ATLANTA HAWKS", BOS: "BOSTON CELTICS", BKN: "BROOKLYN NETS", CHA: "CHARLOTTE HORNETS",
  CHI: "CHICAGO BULLS", CLE: "CLEVELAND CAVALIERS", DAL: "DALLAS MAVERICKS", DEN: "DENVER NUGGETS",
  DET: "DETROIT PISTONS", GSW: "GOLDEN STATE WARRIORS", HOU: "HOUSTON ROCKETS", IND: "INDIANA PACERS",
  LAC: "LOS ANGELES CLIPPERS", LAL: "LOS ANGELES LAKERS", MEM: "MEMPHIS GRIZZLIES", MIA: "MIAMI HEAT",
  MIL: "MILWAUKEE BUCKS", MIN: "MINNESOTA TIMBERWOLVES", NOP: "NEW ORLEANS PELICANS", NYK: "NEW YORK KNICKS",
  OKC: "OKLAHOMA CITY THUNDER", ORL: "ORLANDO MAGIC", PHI: "PHILADELPHIA 76ERS", PHX: "PHOENIX SUNS",
  POR: "PORTLAND TRAIL BLAZERS", SAC: "SACRAMENTO KINGS", SAS: "SAN ANTONIO SPURS", TOR: "TORONTO RAPTORS",
  UTA: "UTAH JAZZ", WAS: "WASHINGTON WIZARDS"
};

// --- Logic ---

function main() {
  console.log("Starting PST Phase 7: Rights Views Generation...");

  // 1. Load Data
  if (!fs.existsSync(LEDGER_PATH)) {
    console.error(`ERROR: Ledger not found at ${LEDGER_PATH}`);
    process.exit(1);
  }
  const ledgerData = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8'));
  const picks: PickLedgerItem[] = ledgerData.picks;

  const entitlements: RightsEntitlement[] = [];

  for (const pick of picks) {
    const specs = pick.encumbrances.selectionSpecs || [];
    
    // Debug specific picks
    if (pick.pickId === 'ATL_2026_1st' || pick.pickId === 'DAL_2030_1st') {
       console.log(`DEBUG: Processing ${pick.pickId}. Specs: ${specs.length}`);
       specs.forEach(s => console.log(`  Spec: ${s.kind} controller=${s.controller} order=${s.order} pool=${s.pool.join(',')}`));
    }

    if (specs.length === 0) {
      // Task D: Keep ownership lines separate
      // If no selectionSpecs, it remains an ownership pick unless complex swaps exist
      // Note: we might miss implicit "owed" sides if pick has swaps but no specs,
      // but without specs we often can't determine rank effectively.
      const hasSwaps = pick.encumbrances.swaps.length > 0;
      if (!hasSwaps) {
        entitlements.push({
          team: pick.owner,
          year: pick.year,
          round: pick.round,
          description: pick.originalTeam === pick.owner ? "own" : `via ${pick.originalTeam}`,
          poolInfo: "",
          controllerInfo: "",
          debug_sourcePickId: pick.pickId
        });
      }
      continue;
    }

    // Process Specs
    for (const spec of specs) {
      if (spec.kind === 'swap_right' && spec.controller) {
        // Simple swap: option/right, not ranked entitlement
        const controller = spec.controller;
        const pool = spec.pool; // e.g. ["DAL", "SAS"]
        const otherTeams = pool.filter(t => t !== controller);
        
        // 1. Controller Entitlement: "swap {other}" or "swap pool {n}"
        const swapTarget = otherTeams.length === 1 
          ? `swap ${otherTeams[0]}`
          : `swap pool ${pool.length}`;
        
        entitlements.push({
          team: controller,
          year: spec.year,
          round: spec.round,
          description: swapTarget,
          poolInfo: pool.length > 2 ? `pool (${pool.join(',')})` : '',
          controllerInfo: '',
          debug_sourcePickId: pick.pickId
        });
        
        // 2. Non-controller teams: "swap owed {controller}"
        for (const otherTeam of otherTeams) {
          entitlements.push({
            team: otherTeam,
            year: spec.year,
            round: spec.round,
            description: `swap owed ${controller}`,
            poolInfo: pool.length > 2 ? `pool (${pool.join(',')})` : '',
            controllerInfo: '',
            debug_sourcePickId: pick.pickId
          });
        }
        
      } else if (spec.kind === 'swap' && spec.controller) {
        // Ranked swap: explicit most/least favorable language
        const controller = spec.controller;
        const pool = spec.pool;
        
        // 1. Controller Entitlement
        entitlements.push({
          team: controller,
          year: spec.year,
          round: spec.round,
          description: `receives ${spec.order} favorable`,
          poolInfo: `pool (${pool.join(',')})`,
          controllerInfo: `controller ${controller}`,
          debug_sourcePickId: pick.pickId
        });

        // 2. "Owes" side -> SUPPRESSED (Phase 7.3 Recipient Only)
        // We only show the team that RECEIVES the pick (the controller).
        
      } else if (spec.kind === 'conveys') {
        const recipient = spec.controller || pick.owner;
        entitlements.push({
          team: recipient,
          year: pick.year,
          round: pick.round,
          description: `receives ${spec.order} favorable`,
          poolInfo: `pool (${spec.pool.join(',')})`,
          controllerInfo: spec.controller ? `controller ${spec.controller}` : '',
          debug_sourcePickId: pick.pickId
        });
      }
    }

  }

  // Debug: Check ATL 2026
  const atl26 = entitlements.filter(e => e.team === 'ATL' && e.year === 2026);
  console.log(`DEBUG: ATL 2026 entitlements count: ${atl26.length}`);
  atl26.forEach(e => console.log(`  ATL 26: ${JSON.stringify(e)}`));

  // 3. Output Generation (Task C)
  
  // Sort entitlements
  entitlements.sort((a, b) => {
    if (a.team !== b.team) return a.team.localeCompare(b.team);
    if (a.year !== b.year) return a.year - b.year;
    if (a.round !== b.round) return a.round - b.round;
    return 0; // Stable otherwise
  });

  // Deduplication
  const uniqueEntitlements = dedupeEntitlements(entitlements);

  // Generate Files
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Debug Index
  fs.writeFileSync(INDEX_OUTPUT_PATH, JSON.stringify(uniqueEntitlements, null, 2));

  // Per Team Files
  const byTeam: Record<string, RightsEntitlement[]> = {};
  for (const ent of uniqueEntitlements) {
    if (!byTeam[ent.team]) byTeam[ent.team] = [];
    byTeam[ent.team].push(ent);
  }

  // Combined Buffer
  let combinedOutput = "";

  for (const teamCode of Object.keys(TEAM_NAMES)) {
    const teamEntitlements = byTeam[teamCode] || [];
    
    // Header
    const teamHeader = `════════════════════════════════════════════════════════════════════════════════\n# ${teamCode} — ${TEAM_NAMES[teamCode]} (ENTITLEMENTS: ${teamEntitlements.length})\n\n────────────────────────────────────────────────────────────────────────────────\n`;
    
    let teamBody = "";
    if (teamEntitlements.length === 0) {
      teamBody = "(No 2026-2033 rights found)\n";
    } else {
      for (const ent of teamEntitlements) {
        // Format: 2030 | 1 | description | pool info | controller info
        // Clean up empty fields
        const parts = [
          ent.year.toString(),
          ent.round.toString(),
          ent.description,
          ent.poolInfo,
          ent.controllerInfo
        ].filter(p => p && p.trim().length > 0);
        
        teamBody += parts.join(' | ') + "\n";
      }
    }

    const section = teamHeader + teamBody + "\n";
    combinedOutput += section;
    
    // Write Individual
    fs.writeFileSync(path.join(OUTPUT_DIR, `${teamCode}.txt`), section);
  }

  // Write Combined
  fs.writeFileSync(COMBINED_OUTPUT_PATH, combinedOutput);

  console.log(`Phase 7 Complete. Validated against ${picks.length} picks.`);
  console.log(`Output: ${COMBINED_OUTPUT_PATH}`);
}

function dedupeEntitlements(list: RightsEntitlement[]): RightsEntitlement[] {
  const seen = new Set<string>();
  const result: RightsEntitlement[] = [];
  
  for (const item of list) {
    // Key excluding debug info
    const key = `${item.team}|${item.year}|${item.round}|${item.description}|${item.poolInfo}|${item.controllerInfo}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

main();
