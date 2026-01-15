/**
 * generate_draft_assets_md.ts
 *
 * Generates draft_assets_team_lists.md — clean, scroll-proof markdown
 * listing Trade Machine draft assets per team in year order.
 *
 * Features:
 * - One table per team (no internal sections/buckets)
 * - Sorted by year ASC, round ASC, originalTeam ASC, assetType
 * - Very distinct team separators for easy scanning
 * - Summary counts (informational only)
 *
 * Usage:
 *   npx tsx team-scrape/draft-picks/scripts/generate_draft_assets_md.ts
 *   npx tsx team-scrape/draft-picks/scripts/generate_draft_assets_md.ts --teams=DAL,UTA
 */

import fs from "fs";
import path from "path";

// Default paths
const DEFAULT_ASSETS_DIR =
  "team-scrape/shared/firestore_staging/_artifacts/output/draft_assets";
const DEFAULT_OUTPUT_FILE =
  "team-scrape/draft-picks/_artifacts/audits/draft_assets_team_lists.md";

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
  swapDetails?: Record<string, unknown>;
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
  if (round === 1) return "1st";
  if (round === 2) return "2nd";
  if (round === 3) return "3rd";
  return `${round}th`;
}

// Create asset label like "LAL 2029 1st"
function assetLabel(asset: DraftAsset): string {
  return `${asset.originalTeam} ${asset.year} ${roundLabel(asset.round)}`;
}

// Sort assets: year ASC, round ASC, originalTeam ASC, assetType (stable)
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

// Build protection/conditions column text
function getProtectionConditions(asset: DraftAsset): string {
  if (asset.protection) {
    return asset.protection;
  }
  if (asset.conditionsText) {
    return asset.conditionsText;
  }
  return "";
}

// Build source column text
function getSource(asset: DraftAsset): string {
  const parts: string[] = [];
  if (asset.source?.srcTeamPage) {
    parts.push(asset.source.srcTeamPage);
  }
  if (asset.source?.rawText) {
    // Truncate long raw text
    const raw = asset.source.rawText;
    const truncated = raw.length > 60 ? raw.substring(0, 57) + "..." : raw;
    parts.push(`"${truncated}"`);
  }
  return parts.length > 0 ? parts.join(" — ") : "";
}

// Escape pipe characters for markdown tables
function escapeForTable(str: string): string {
  return str.replace(/\|/g, "\\|");
}

// Generate markdown for a single team
function generateTeamSection(
  team: string,
  assets: DraftAsset[]
): string[] {
  const lines: string[] = [];
  const teamName = TEAM_NAMES[team] || team;

  // Heavy separator before team header
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`# ${teamName} — Draft Assets (Trade Machine)`);
  lines.push("");
  lines.push(`**Source**: \`draft_assets/${team}.json\``);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Count by type
  const outrightCount = assets.filter((a) => a.assetType === "outright_pick").length;
  const conditionalCount = assets.filter((a) => a.assetType === "conditional_right").length;
  const swapCount = assets.filter((a) => a.assetType === "swap_right").length;

  lines.push(`**Total: ${assets.length}** — Outright: ${outrightCount} | Conditional: ${conditionalCount} | Swap: ${swapCount}`);
  lines.push("");

  if (assets.length === 0) {
    lines.push("*No draft assets found.*");
    lines.push("");
    return lines;
  }

  // Sort assets
  const sortedAssets = sortAssets(assets);

  // Table header
  lines.push("| Year | R | Asset | Type | Certainty | Protection/Conditions | Via | Source |");
  lines.push("|------|---|-------|------|-----------|----------------------|-----|--------|");

  // Table rows
  for (const asset of sortedAssets) {
    const year = asset.year;
    const round = asset.round;
    const assetStr = assetLabel(asset);
    const type = asset.assetType;
    const certainty = asset.certainty;
    const protCond = escapeForTable(getProtectionConditions(asset));
    const via = asset.via || "";
    const source = escapeForTable(getSource(asset));

    lines.push(`| ${year} | ${round} | ${assetStr} | ${type} | ${certainty} | ${protCond} | ${via} | ${source} |`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════════════════════");
  lines.push("");

  return lines;
}

function main() {
  const { assetsDir, out, teams } = parseArgs();

  console.log(`Draft Assets MD Generator`);
  console.log(`  Assets Dir: ${assetsDir}`);
  console.log(`  Output: ${out}`);
  console.log(`  Teams: ${teams.length === 30 ? "ALL" : teams.join(", ")}`);
  console.log("");

  const lines: string[] = [];

  // Header
  lines.push("# Draft Assets — Trade Machine Manual Review");
  lines.push("");
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("This document lists all Trade Machine draft assets per team, sorted by year.");
  lines.push("Use this for manual verification against external sources (Fanspo, RealGM, etc.).");
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
  lines.push("---");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Teams processed**: ${teamsProcessed}`);
  lines.push(`- **Total assets**: ${totalAssets}`);
  lines.push(`- **Generated**: ${new Date().toISOString()}`);

  // Ensure output directory exists
  const outDir = path.dirname(out);
  fs.mkdirSync(outDir, { recursive: true });

  // Write output
  fs.writeFileSync(out, lines.join("\n"), "utf8");
  console.log(`✔ Wrote: ${out}`);
  console.log(`  Teams: ${teamsProcessed}`);
  console.log(`  Total assets: ${totalAssets}`);
}

main();
