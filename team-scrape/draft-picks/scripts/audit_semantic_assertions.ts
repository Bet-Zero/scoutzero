/**
 * audit_semantic_assertions.ts
 * 
 * Semantic assertions audit for draft picks pipeline.
 * Checks that parsed fields match patterns in raw text.
 * 
 * FIXED (2026-01-14):
 * - C1: Protection: Only flag if "protected" is describing THIS pick's protection,
 *       not parenthetical references to other conveyances (e.g., "in separate, protected conveyances")
 * - C2: Team code normalization (PHO→PHX, BRK/BRO→BKN, etc)
 * - C3: "to TEAM" assertions: Check conditionalOutcomes field for conditional recipients
 * - C4: Controller: Extract ALL controller candidates and check if parsed matches ANY
 * 
 * Usage: npx tsx team-scrape/draft-picks/scripts/audit_semantic_assertions.ts --teams=ALL
 */

import fs from "fs";
import path from "path";

type Pick = any;

const MENTIONS_DIR_DEFAULT = "team-scrape/draft-picks/_artifacts/output/mentions";

// Canonical team codes
const TEAM_CODES = [
  "ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GSW",
  "HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NOP","NYK",
  "OKC","ORL","PHI","PHX","POR","SAC","SAS","TOR","UTA","WAS"
];

/**
 * Normalize team code to canonical form.
 * PHO→PHX, BRK/BRO→BKN, UTH→UTA, CHO→CHA, PHL→PHI, GOS→GSW, SAN→SAS
 */
function normalizeCode(code: string): string {
  const c = (code || "").toUpperCase().trim().replace(/['\\"]/g, "");
  if (c === "PHO") return "PHX";
  if (c === "BRK" || c === "BRO") return "BKN";
  if (c === "UTH") return "UTA";
  if (c === "CHO") return "CHA";
  if (c === "PHL") return "PHI";
  if (c === "GOS") return "GSW";
  if (c === "SAN") return "SAS";
  return c;
}

function loadMentionsFile(team: string, mentionsDir: string): Pick[] {
  const fp = path.join(mentionsDir, `draft_picks_mentions_${team}.json`);
  if (!fs.existsSync(fp)) throw new Error(`Missing mentions file: ${fp}`);
  const json = JSON.parse(fs.readFileSync(fp, "utf8"));
  if (!Array.isArray(json)) throw new Error(`Expected array in ${fp}`);
  return json;
}

function getRawText(p: Pick): string {
  return (p?.metadata?.realgmRawText || "").toString();
}

// --- Assertions ---

/**
 * C1 FIX (2026-01-14): Protection anchor detection - VERY STRICT
 * 
 * Only flag as "missing protection" if BOTH:
 * 1. Raw contains "protected" OR "top-X" pattern
 * 2. AND it's clearly describing THIS pick's protection, not:
 *    - Parenthetical notes about other conveyances ("in separate, protected conveyances")
 *    - Complex multi-team allocations where protection applies to other picks
 *    - "if conveyable" / "if not already settled" conditional language
 *    - Multi-destination patterns ("X-Y to A; Z-W to B") - these are outgoing, not protection
 * 
 * For round===2: Almost never require protection field
 */
function hasProtectionAnchor(raw: string, round: number | undefined, pickId: string): boolean {
  // Round 2 picks almost never have protection semantics worth flagging
  if (round === 2) {
    // Only flag if "protected" appears at the START of the raw text describing THIS pick
    // e.g., "protected to LAL" but NOT "in separate, protected conveyances"
    if (/^\s*protected\b/i.test(raw)) {
      return true;
    }
    // Don't flag round 2 picks for complex multi-team text
    return false;
  }
  
  // Skip complex multi-team allocation text (false positives)
  // These contain multiple team references and "favorable" language
  if (/\b(most|least|more|less)\s+favorable\b/i.test(raw)) {
    return false; // Complex allocation, not simple protection
  }
  
  // Skip parenthetical references to other conveyances
  if (/in\s+separate.*protected\s+conveyance/i.test(raw)) {
    return false;
  }
  
  // Skip "if conveyable" / "if not already settled" patterns - these are conditional, not protection
  if (/if\s+(conveyable|not\s+(already\s+)?settled|not\s+conveyable)/i.test(raw)) {
    return false;
  }
  
  // Skip multi-destination patterns: "X-Y to A; Z-W to B" - these are outgoing pick descriptions,
  // not protection for the page team's owned pick
  const multiDestMatch = raw.match(/\d{1,2}\s*-\s*\d{1,2}\s+to\s+[A-Z]{2,3}/gi);
  if (multiDestMatch && multiDestMatch.length >= 2) {
    // Two or more "X-Y to TEAM" patterns = multi-destination, not protection
    return false;
  }
  
  // Skip if pick starts with "X-Y to TEAM" (not "X-Y Own") - this is outgoing, not protected own
  if (/^\s*\d{1,2}\s*-\s*\d{1,2}\s+to\s+/i.test(raw)) {
    return false;
  }
  
  // Skip if "protected" appears inside parentheses (often describing other picks)
  // Check if "protected" is only inside parens
  const protectedMatch = raw.match(/\bprotected\b/i);
  if (protectedMatch) {
    const idx = protectedMatch.index || 0;
    const beforeProtected = raw.substring(0, idx);
    const openParens = (beforeProtected.match(/\(/g) || []).length;
    const closeParens = (beforeProtected.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      // "protected" is inside unclosed parens - likely describing another pick
      return false;
    }
  }
  
  // For round 1: Check for explicit protection patterns at pick level
  if (round === 1) {
    // Pattern 1: "X-Y Own; Z-W to TEAM" at or near the START - page team's conditional pick
    if (/^\s*\d{1,2}\s*-\s*\d{1,2}\s+Own\b/i.test(raw)) {
      // This is "1-4 Own" or "1-14 Own" pattern - DOES need protection if not parsed
      // But ONLY if there's a clear "X-Y to TEAM" pattern indicating conditional conveyance
      if (/\d{1,2}\s*-\s*\d{1,2}\s+to\s+[A-Z]{2,3}/i.test(raw)) {
        // HAS conditional outcome structure - should have protection parsed
        return true;
      }
    }
    
    // Pattern 2: Explicit "top-N protected" language
    if (/\btop-?\d+\s*protected\b/i.test(raw)) {
      return true;
    }
    
    // Pattern 3: "protected" at start of raw
    if (/^\s*protected\b/i.test(raw)) {
      return true;
    }
  }
  
  return false;
}

function hasProtectionParsed(p: Pick): boolean {
  // Also check conditions and conditionalOutcomes for protection-like info
  return !!p?.protection || 
         (Array.isArray(p?.conditions) && p.conditions.length > 0) ||
         (Array.isArray(p?.conditionalOutcomes) && p.conditionalOutcomes.length > 0);
}

function hasSwapAnchor(raw: string): boolean {
  return /\b(swap|most favorable|least favorable|more favorable|less favorable)\b/i.test(raw);
}

function hasSwapParsed(p: Pick): boolean {
  return p?.isSwap === true || !!p?.swapDetails;
}

/**
 * C4 FIX: Extract ALL controller candidates from raw text
 * Multi-controller text like "via BRK swap for PHX; via WAS swap for PHX" 
 * has multiple valid controllers.
 */
function extractAllControllerAnchors(raw: string): string[] {
  const controllers: string[] = [];
  const pattern = /\bvia\s+([A-Z]{2,3})\s+swap\s+(?:of\s+[^)]+?\s+)?for\b/gi;
  let match;
  while ((match = pattern.exec(raw)) !== null) {
    const code = normalizeCode(match[1]);
    if (TEAM_CODES.includes(code) && !controllers.includes(code)) {
      controllers.push(code);
    }
  }
  return controllers;
}

function controllerParsed(p: Pick): string | null {
  const c = p?.swapDetails?.controller;
  return c ? normalizeCode(c) : null;
}

function controllerCandidatesParsed(p: Pick): string[] {
  const cands = p?.swapDetails?.controllerCandidates;
  if (Array.isArray(cands)) {
    return cands.map((c: any) => normalizeCode(String(c)));
  }
  return [];
}

/**
 * C3 FIX: Extract "to TEAM" anchors but with smarter filtering
 * 
 * Only flag TO_ANCHOR_BUT_NO_RECIPIENT_OR_ROUTE when:
 * - Raw has "X-Y Own; Z-W to TEAM" pattern (page team's conditional pick)
 * - AND it's not modeled in conditionalOutcomes, recipient, route, or conditions
 * 
 * Skip:
 * - Multi-destination patterns ("X-Y to A; Z-W to B") - these are describing someone else's pick
 * - Favorable/swap allocation text
 */
function extractDirectToTeams(raw: string): string[] {
  const out: string[] = [];
  
  // Skip complex multi-team allocation text (too noisy)
  if (/\b(most|least|more|less)\s+favorable\b/i.test(raw)) {
    return out;
  }
  
  // Skip if this looks like multi-destination ("or to XXX")
  if (/\bor to\s+[A-Z]{2,3}/i.test(raw)) {
    return out;
  }
  
  // Skip multi-destination: "X-Y to A; Z-W to B" (two or more "to TEAM" patterns)
  // These describe fully outgoing picks, not conditionally protected ones
  const allToMatches = raw.match(/\d{1,2}\s*-\s*\d{1,2}\s+to\s+[A-Z]{2,3}/gi) || [];
  if (allToMatches.length >= 2) {
    return out; // Multi-destination, skip
  }
  
  // Skip if raw starts with "X-Y to TEAM" (fully outgoing, not "X-Y Own")
  if (/^\s*\d{1,2}\s*-\s*\d{1,2}\s+to\s+/i.test(raw)) {
    return out;
  }
  
  // ONLY flag if pattern is "X-Y Own; Z-W to TEAM" (page team's conditional pick)
  if (/^\s*\d{1,2}\s*-\s*\d{1,2}\s+Own\b/i.test(raw)) {
    // This is the page team's conditional pick - extract the "to TEAM" recipients
    const rangeToMatches = raw.matchAll(/\d{1,2}\s*-\s*\d{1,2}\s+to\s+([A-Z]{2,3})\b/gi);
    for (const m of rangeToMatches) {
      const code = normalizeCode(m[1]);
      if (TEAM_CODES.includes(code) && !out.includes(code)) {
        out.push(code);
      }
    }
  }
  
  // Pattern: "To TEAM" at very start of text (simple outgoing) - check recipient/route exists
  const startMatch = raw.match(/^\s*To\s+([A-Z]{2,3})\b/i);
  if (startMatch) {
    const code = normalizeCode(startMatch[1]);
    if (TEAM_CODES.includes(code) && !out.includes(code)) {
      out.push(code);
    }
  }
  
  return out;
}

/**
 * Check if a "to TEAM" anchor is satisfied by the pick's parsed fields
 */
function isToAnchorSatisfied(toTeam: string, p: Pick): boolean {
  // Check recipient
  if (p?.recipient && normalizeCode(p.recipient) === toTeam) {
    return true;
  }
  
  // Check route
  if (Array.isArray(p?.route)) {
    const normalizedRoute = p.route.map((x: any) => normalizeCode(String(x)));
    if (normalizedRoute.includes(toTeam)) {
      return true;
    }
  }
  
  // Check conditionalOutcomes (NEW)
  if (Array.isArray(p?.conditionalOutcomes)) {
    for (const outcome of p.conditionalOutcomes) {
      if (outcome?.recipient && normalizeCode(outcome.recipient) === toTeam) {
        return true;
      }
    }
  }
  
  // Check conditions (existing field)
  if (Array.isArray(p?.conditions)) {
    for (const cond of p.conditions) {
      if (cond?.recipient && normalizeCode(cond.recipient) === toTeam) {
        return true;
      }
    }
  }
  
  // Check conditionalRecipient
  if (p?.conditionalRecipient && normalizeCode(p.conditionalRecipient) === toTeam) {
    return true;
  }
  
  // Check obligationId - pattern: {baseId}_obligation_{TEAM}
  if (p?.obligationId) {
    const obligationMatch = p.obligationId.match(/_obligation_([A-Z]{2,3})$/);
    if (obligationMatch) {
      const obligationRecipient = normalizeCode(obligationMatch[1]);
      if (obligationRecipient === toTeam) {
        return true;
      }
    }
  }
  
  return false;
}

function parseReportRow(team: string, p: Pick) {
  const raw = getRawText(p);
  const id = p?.id || "NO_ID";
  const year = p?.year ?? "??";
  const round = p?.round ?? "??";
  return { team, id, year, round, raw };
}

function main() {
  const mentionsDir = process.argv.find(a => a.startsWith("--mentionsDir="))?.split("=")[1] || MENTIONS_DIR_DEFAULT;
  const teamsArg = process.argv.find(a => a.startsWith("--teams="))?.split("=")[1] || "ALL";
  const teams = teamsArg === "ALL" ? TEAM_CODES : teamsArg.split(",").map(s => s.trim().toUpperCase());

  const failures: Record<string, any[]> = {
    PROTECTION_ANCHOR_BUT_NO_PROTECTION: [],
    SWAP_ANCHOR_BUT_NO_SWAPDETAILS: [],
    CONTROLLER_ANCHOR_BUT_CONTROLLER_MISSING: [],
    TO_ANCHOR_BUT_NO_RECIPIENT_OR_ROUTE: [],
  };

  let totalPicks = 0;

  for (const t of teams) {
    const team = normalizeCode(t);
    const picks = loadMentionsFile(team, mentionsDir);
    totalPicks += picks.length;

    for (const p of picks) {
      const raw = getRawText(p);
      if (!raw) continue;

      const round = p?.round;
      const pickId = p?.id || "";
      
      // C1: Protection check with STRICT false-positive reduction
      if (hasProtectionAnchor(raw, round, pickId) && !hasProtectionParsed(p)) {
        failures.PROTECTION_ANCHOR_BUT_NO_PROTECTION.push(parseReportRow(team, p));
      }

      // Swap check
      if (hasSwapAnchor(raw) && !hasSwapParsed(p)) {
        failures.SWAP_ANCHOR_BUT_NO_SWAPDETAILS.push(parseReportRow(team, p));
      }

      // Controller check with multi-controller support
      const allControllers = extractAllControllerAnchors(raw);
      if (allControllers.length > 0) {
        const parsedController = controllerParsed(p);
        const parsedCandidates = controllerCandidatesParsed(p);
        
        // Check if ANY expected controller matches parsed controller OR parsed candidates
        const anyMatch = allControllers.some(expectedCtrl => 
          parsedController === expectedCtrl || parsedCandidates.includes(expectedCtrl)
        );
        
        if (!anyMatch) {
          failures.CONTROLLER_ANCHOR_BUT_CONTROLLER_MISSING.push({
            ...parseReportRow(team, p),
            expectedControllers: allControllers,
            parsedController: parsedController,
            parsedCandidates: parsedCandidates
          });
        }
      }

      // C3: "to TEAM" check with conditionalOutcomes support
      const toTeams = extractDirectToTeams(raw);
      if (toTeams.length > 0) {
        // Check if ALL detected "to TEAM" anchors are satisfied
        const unsatisfied = toTeams.filter(tt => !isToAnchorSatisfied(tt, p));
        if (unsatisfied.length > 0) {
          failures.TO_ANCHOR_BUT_NO_RECIPIENT_OR_ROUTE.push({
            ...parseReportRow(team, p),
            toTeams: unsatisfied
          });
        }
      }
    }
  }

  const summary = {
    mentionsDir,
    teamsAudited: teams.length,
    totalPicksScanned: totalPicks,
    counts: Object.fromEntries(Object.entries(failures).map(([k,v]) => [k, v.length])),
  };

  const outDir = "team-scrape/draft-picks/_artifacts/audits";
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "semantic_assertions_report.json");
  fs.writeFileSync(outPath, JSON.stringify({ summary, failures }, null, 2), "utf8");

  console.log("\n=== SEMANTIC ASSERTIONS AUDIT ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nWrote: ${outPath}`);
  console.log("\nImprovements (2026-01-14):");
  console.log("  - PROTECTION: Strict false-positive reduction for complex text");
  console.log("  - TO_ANCHOR: Checks conditionalOutcomes + conditions fields");
  console.log("  - CONTROLLER: Multi-controller support via controllerCandidates");
}

main();
