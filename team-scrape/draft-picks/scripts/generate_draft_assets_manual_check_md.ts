/**
 * generate_draft_assets_manual_check_md.ts
 *
 * Generates draft_assets_manual_check.md — clean, one-line-per-pick output
 * designed for fast cross-referencing against other sites (Fanspo, RealGM, etc.)
 *
 * Features:
 * - One line per pick (no tables)
 * - Clean origin strings: own | via XXX | swap pool: XXX/YYY/ZZZ
 * - Compact protection/conditions: Top 4, Top-5, unprotected, most, least, 2nd most
 * - Sorted by Year ASC, Round ASC
 * - Big, unmistakable team separators for easy scrolling
 *
 * Usage:
 *   npx tsx team-scrape/draft-picks/scripts/generate_draft_assets_manual_check_md.ts
 *   npx tsx team-scrape/draft-picks/scripts/generate_draft_assets_manual_check_md.ts --teams=DAL,UTA
 */

import fs from "fs";
import path from "path";

// Default paths
const DEFAULT_ASSETS_DIR =
  "team-scrape/shared/firestore_staging/_artifacts/output/draft_assets";
const DEFAULT_OUTPUT_FILE =
  "team-scrape/draft-picks/_artifacts/audits/draft_assets_manual_check.md";

// All 30 NBA teams (canonical codes)
const ALL_TEAM_CODES = [
  "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
  "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
];

// Team full names for display  
const TEAM_NAMES: Record<string, string> = {
  ATL: "ATLANTA HAWKS",
  BOS: "BOSTON CELTICS",
  BKN: "BROOKLYN NETS",
  CHA: "CHARLOTTE HORNETS",
  CHI: "CHICAGO BULLS",
  CLE: "CLEVELAND CAVALIERS",
  DAL: "DALLAS MAVERICKS",
  DEN: "DENVER NUGGETS",
  DET: "DETROIT PISTONS",
  GSW: "GOLDEN STATE WARRIORS",
  HOU: "HOUSTON ROCKETS",
  IND: "INDIANA PACERS",
  LAC: "LOS ANGELES CLIPPERS",
  LAL: "LOS ANGELES LAKERS",
  MEM: "MEMPHIS GRIZZLIES",
  MIA: "MIAMI HEAT",
  MIL: "MILWAUKEE BUCKS",
  MIN: "MINNESOTA TIMBERWOLVES",
  NOP: "NEW ORLEANS PELICANS",
  NYK: "NEW YORK KNICKS",
  OKC: "OKLAHOMA CITY THUNDER",
  ORL: "ORLANDO MAGIC",
  PHI: "PHILADELPHIA 76ERS",
  PHX: "PHOENIX SUNS",
  POR: "PORTLAND TRAIL BLAZERS",
  SAC: "SACRAMENTO KINGS",
  SAS: "SAN ANTONIO SPURS",
  TOR: "TORONTO RAPTORS",
  UTA: "UTAH JAZZ",
  WAS: "WASHINGTON WIZARDS",
};

// Parse CLI arguments
function parseArgs(): { assetsDir: string; out: string; teams: string[] } {
  const args = process.argv.slice(2);
  let assetsDir = DEFAULT_ASSETS_DIR;
  let out = DEFAULT_OUTPUT_FILE;
  let teams: string[] = [];

  for (const arg of args) {
    if (arg.startsWith("--assetsDir=")) {
      assetsDir = arg.split("=")[1];
    } else if (arg.startsWith("--out=")) {
      out = arg.split("=")[1];
    } else if (arg.startsWith("--teams=")) {
      const teamsArg = arg.split("=")[1];
      if (teamsArg.toUpperCase() === "ALL") {
        teams = [...ALL_TEAM_CODES];
      } else {
        teams = teamsArg.split(",").map((t) => t.trim().toUpperCase());
      }
    }
  }

  // Default to ALL teams if not specified
  if (teams.length === 0) {
    teams = [...ALL_TEAM_CODES];
  }

  return { assetsDir, out, teams };
}

interface SwapDetails {
  swapType?: string;
  favorable?: string | null;
  poolTeams?: string[];
  controller?: string;
  controllerCandidates?: string[];
  swapWith?: string[];
  allocation?: {
    topN?: number;
    topNTo?: string;
    remainderTo?: string;
  };
}

interface DraftAsset {
  assetId: string;
  pickId: string;
  year: number;
  round: number;
  team: string;
  originalTeam: string;
  assetType: "outright_pick" | "conditional_right" | "swap_right";
  certainty: "certain" | "conditional";
  protection?: string | null;
  conditionsText?: string;
  isSwap?: boolean;
  swapDetails?: SwapDetails;
  source?: {
    srcTeamPage?: string;
    rawText?: string;
    obligationId?: string;
  };
  via?: string;
  tradeableNow?: boolean;
}

interface DraftAssetsFile {
  teamCode: string;
  generatedAt: string;
  picks: DraftAsset[];
}

function loadDraftAssets(
  assetsDir: string,
  team: string
): DraftAssetsFile | null {
  const fp = path.join(assetsDir, `${team}.json`);
  if (!fs.existsSync(fp)) {
    console.warn(`Missing draft assets file: ${fp}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}

// Format round as ordinal
function roundLabel(round: number): string {
  if (round === 1) return "1";
  if (round === 2) return "2";
  return `${round}`;
}

// Sort assets: year ASC, round ASC, origin/type stable
function sortAssets(assets: DraftAsset[]): DraftAsset[] {
  const typeOrder: Record<string, number> = {
    outright_pick: 0,
    conditional_right: 1,
    swap_right: 2,
  };

  return [...assets].sort((a, b) => {
    // Year first
    if (a.year !== b.year) return a.year - b.year;
    // Round second
    if (a.round !== b.round) return a.round - b.round;
    // Original team third
    if (a.originalTeam !== b.originalTeam) {
      return a.originalTeam.localeCompare(b.originalTeam);
    }
    // Asset type fourth (for stability)
    return (typeOrder[a.assetType] ?? 99) - (typeOrder[b.assetType] ?? 99);
  });
}

/**
 * Derive origin string from asset fields:
 * - own: originalTeam === team
 * - via XXX: received from another team
 * - swap XXX: swap right with single counterparty
 * - swap pool: XXX/YYY/ZZZ: multi-team swap pool
 */
function getOrigin(asset: DraftAsset, teamCode: string): string {
  const isOwn = asset.originalTeam === teamCode;
  const isSwap = asset.assetType === "swap_right" || asset.isSwap;

  if (isSwap && asset.swapDetails) {
    const sd = asset.swapDetails;

    // Check for pool teams (multi-team swap)
    if (sd.poolTeams && sd.poolTeams.length > 0) {
      const poolStr = sd.poolTeams.join("/");
      return `swap pool: ${poolStr}`;
    }

    // Check for swapWith
    if (sd.swapWith && sd.swapWith.length > 0) {
      if (sd.swapWith.length === 1) {
        return `swap ${sd.swapWith[0]}`;
      } else {
        return `swap pool: ${sd.swapWith.join("/")}`;
      }
    }

    // Check controller as fallback
    if (sd.controller) {
      return `swap ${sd.controller}`;
    }

    // Fallback for unresolved swaps
    return "swap (multi)";
  }

  // Non-swap cases
  if (isOwn) {
    return "own";
  }

  // Via case: received from another team
  return `via ${asset.originalTeam}`;
}

/**
 * Normalize protection strings to compact format:
 * - "top-4 protected" -> "Top 4"
 * - "Top 5 protected" -> "Top-5"
 * - "1-5 Own" -> "1-5"
 */
function normalizeProtection(protection: string | null | undefined): string {
  if (!protection) return "";

  const lower = protection.toLowerCase();

  // Pattern: "top-X protected" or "top X protected"
  const topMatch = lower.match(/top[- ]?(\d+)\s*protected?/i);
  if (topMatch) {
    return `Top ${topMatch[1]}`;
  }

  // Pattern: "X-Y protected" or "X-Y own"
  const rangeMatch = lower.match(/(\d+)[- ](\d+)\s*(protected|own)?/i);
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]}`;
  }

  // Keep first 60 chars if we can't parse
  return protection.length > 60 ? protection.substring(0, 57) + "..." : protection;
}

/**
 * Extract swap hierarchy from swapDetails or conditionsText:
 * - most -> "most"
 * - least -> "least"
 * - second most favorable -> "2nd most"
 * - two most favorable -> "top 2"
 */
function getSwapHierarchy(asset: DraftAsset): string {
  const sd = asset.swapDetails;

  if (sd?.favorable) {
    const fav = sd.favorable.toLowerCase();
    if (fav === "most") return "most";
    if (fav === "least") return "least";
    if (fav.includes("second") || fav.includes("2nd")) return "2nd most";
  }

  // Check conditionsText for allocation info
  const condText = asset.conditionsText || "";
  const allocText = (asset.source?.rawText || "") + " " + condText;
  const lowerAlloc = allocText.toLowerCase();

  if (lowerAlloc.includes("two most favorable") || lowerAlloc.includes("2 most favorable")) {
    return "top 2";
  }
  if (lowerAlloc.includes("most favorable")) {
    return "most";
  }
  if (lowerAlloc.includes("least favorable")) {
    return "least";
  }
  if (lowerAlloc.includes("second most")) {
    return "2nd most";
  }

  // Check allocation object
  if (sd?.allocation) {
    const alloc = sd.allocation;
    if (alloc.topN === 2) return "top 2";
    if (alloc.topN === 1) return "most";
  }

  return "";
}

/**
 * Build compact conditions string:
 * - For swaps: hierarchy (most/least/2nd most/top 2)
 * - For conditional: protection text
 * - For via picks: "unprotected" if no protection
 */
function getConditions(asset: DraftAsset, teamCode: string): string {
  const isSwap = asset.assetType === "swap_right" || asset.isSwap;
  const isOwn = asset.originalTeam === teamCode;

  // For swaps, show hierarchy
  if (isSwap) {
    const hierarchy = getSwapHierarchy(asset);
    if (hierarchy) return hierarchy;

    // If swap but no hierarchy detected, return empty
    return "";
  }

  // For conditional rights with protection
  if (asset.protection) {
    return normalizeProtection(asset.protection);
  }

  // For "via" picks without protection -> unprotected
  if (!isOwn && asset.assetType !== "swap_right") {
    return "unprotected";
  }

  // Own picks with no protection - leave blank
  return "";
}

/**
 * Generate one-line output for a single asset
 * Format: YEAR | ROUND | ORIGIN | CONDITIONS
 */
function formatAssetLine(asset: DraftAsset, teamCode: string): string {
  const year = asset.year;
  const round = roundLabel(asset.round);
  const origin = getOrigin(asset, teamCode);
  const conditions = getConditions(asset, teamCode);

  if (conditions) {
    return `${year} | ${round} | ${origin} | ${conditions}`;
  }
  return `${year} | ${round} | ${origin}`;
}

// Generate markdown for a single team
function generateTeamSection(
  team: string,
  assets: DraftAsset[]
): string[] {
  const lines: string[] = [];
  const teamName = TEAM_NAMES[team] || team;
  const pickCount = assets.length;

  // Heavy separator before team header
  lines.push("");
  lines.push("");
  lines.push("════════════════════════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`# ${team} — ${teamName} (${pickCount} picks)`);
  lines.push("");
  lines.push("────────────────────────────────────────────────────────────────────────────────");
  lines.push("");

  if (assets.length === 0) {
    lines.push("*No draft assets found.*");
    lines.push("");
    return lines;
  }

  // Sort assets
  const sortedAssets = sortAssets(assets);

  // One line per pick
  for (const asset of sortedAssets) {
    lines.push(formatAssetLine(asset, team));
  }

  lines.push("");

  return lines;
}

function main() {
  const { assetsDir, out, teams } = parseArgs();

  console.log(`Draft Assets Manual Check Generator`);
  console.log(`  Assets Dir: ${assetsDir}`);
  console.log(`  Output: ${out}`);
  console.log(`  Teams: ${teams.length === 30 ? "ALL" : teams.join(", ")}`);
  console.log("");

  const lines: string[] = [];

  // Header
  lines.push("# Draft Assets — Manual Check (One-Line Per Pick)");
  lines.push("");
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("This document is designed for fast cross-referencing against external sources.");
  lines.push("Each pick is one line: `YEAR | ROUND | ORIGIN | CONDITIONS`");
  lines.push("");
  lines.push("**Origin Legend:**");
  lines.push("- `own` = team's own pick");
  lines.push("- `via XXX` = received from XXX");
  lines.push("- `swap XXX` = swap right with XXX");
  lines.push("- `swap pool: XXX/YYY/ZZZ` = multi-team swap pool");
  lines.push("");
  lines.push("**Conditions Legend:**");
  lines.push("- `Top 4`, `Top-5`, etc. = protection");
  lines.push("- `unprotected` = via pick with no protection");
  lines.push("- `most`, `least`, `2nd most`, `top 2` = swap hierarchy");
  lines.push("");
  lines.push("---");

  let totalAssets = 0;
  let teamsProcessed = 0;

  for (const team of teams) {
    const data = loadDraftAssets(assetsDir, team);
    if (!data) {
      lines.push(...generateTeamSection(team, []));
      continue;
    }

    const assets = data.picks || [];
    totalAssets += assets.length;
    teamsProcessed++;

    lines.push(...generateTeamSection(team, assets));
  }

  // Footer summary
  lines.push("");
  lines.push("════════════════════════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Teams processed**: ${teamsProcessed}`);
  lines.push(`- **Total picks**: ${totalAssets}`);
  lines.push(`- **Generated**: ${new Date().toISOString()}`);

  // Ensure output directory exists
  const outDir = path.dirname(out);
  fs.mkdirSync(outDir, { recursive: true });

  // Write output
  fs.writeFileSync(out, lines.join("\n"), "utf8");
  console.log(`✔ Wrote: ${out}`);
  console.log(`  Teams: ${teamsProcessed}`);
  console.log(`  Total picks: ${totalAssets}`);
}

main();
