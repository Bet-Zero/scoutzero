#!/usr/bin/env -S node --experimental-strip-types
/* eslint-disable */
/**
 * RealGM Future Draft Picks Scraper — Per-Team Pages (v4.1)
 *
 * Fix: RealGM team pages don't use <table>; parse section text:
 *   "## ... Future 1st Round Picks" and "## ... Future 2nd Round Picks"
 *   Lines come in groups: <YEAR>, <DESCRIPTION>, <COUNT>
 *
 * Output:
 *   team-scrape/draft-picks/output/structured/draft_picks_{CODE}.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

// ---------- CLI / ENV ----------
const argv = process.argv.slice(2);
const asSet = new Set(argv);
const getArgVal = (flag: string, def?: string) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

const OUT_DIR =
  process.env.OUT_DIR ||
  getArgVal('--outDir', 'team-scrape/draft-picks/output')!;
const PRETTY = asSet.has('--pretty') || process.env.PRETTY === '1';
const serialize = (obj: unknown) =>
  PRETTY ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);

// Default to all configured teams if none specified (all 30 NBA teams)
const DEFAULT_TEAMS =
  'ATL,BOS,BKN,CHA,CHI,CLE,DAL,DEN,DET,GSW,HOU,IND,LAC,LAL,MEM,MIA,MIL,MIN,NOP,NYK,OKC,ORL,PHI,PHX,POR,SAC,SAS,TOR,UTA,WAS';
const TEAMS_ARG = getArgVal('--teams', process.env.TEAMS || DEFAULT_TEAMS) ?? DEFAULT_TEAMS;
const TEAM_FILTER = TEAMS_ARG.split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

// ---------- Team Maps & URLs ----------
export const INTERNAL_TEAM_CODE_MAP: Record<string, string> = {
  'Atlanta Hawks': 'ATL',
  'Boston Celtics': 'BOS',
  'Brooklyn Nets': 'BKN',
  'Charlotte Hornets': 'CHA',
  'Chicago Bulls': 'CHI',
  'Cleveland Cavaliers': 'CLE',
  'Dallas Mavericks': 'DAL',
  'Denver Nuggets': 'DEN',
  'Detroit Pistons': 'DET',
  'Golden State Warriors': 'GSW',
  'Houston Rockets': 'HOU',
  'Indiana Pacers': 'IND',
  'LA Clippers': 'LAC',
  'Los Angeles Lakers': 'LAL',
  'Memphis Grizzlies': 'MEM',
  'Miami Heat': 'MIA',
  'Milwaukee Bucks': 'MIL',
  'Minnesota Timberwolves': 'MIN',
  'New Orleans Pelicans': 'NOP',
  'New York Knicks': 'NYK',
  'Oklahoma City Thunder': 'OKC',
  'Orlando Magic': 'ORL',
  'Philadelphia Sixers': 'PHI',
  'Phoenix Suns': 'PHX',
  'Portland Trail Blazers': 'POR',
  'Sacramento Kings': 'SAC',
  'San Antonio Spurs': 'SAS',
  'Toronto Raptors': 'TOR',
  'Utah Jazz': 'UTA',
  'Washington Wizards': 'WAS',
};
const TEAM_ALIASES: Record<string, string> = {
  Sixers: 'Philadelphia Sixers',
  '76ers': 'Philadelphia Sixers',
  'L.A. Clippers': 'LA Clippers',
  'L.A. Lakers': 'Los Angeles Lakers',
  Lakers: 'Los Angeles Lakers',
  Knicks: 'New York Knicks',
  Pels: 'New Orleans Pelicans',
  Blazers: 'Portland Trail Blazers',
  Wolves: 'Minnesota Timberwolves',
};

const REALGM_TEAM_URLS: Record<
  string,
  { code: string; name: string; url: string }
> = {
  ATL: {
    code: 'ATL',
    name: 'Atlanta Hawks',
    url: 'https://basketball.realgm.com/nba/teams/Atlanta-Hawks/1/draft-picks',
  },
  BOS: {
    code: 'BOS',
    name: 'Boston Celtics',
    url: 'https://basketball.realgm.com/nba/teams/Boston-Celtics/2/draft-picks',
  },
  BKN: {
    code: 'BKN',
    name: 'Brooklyn Nets',
    url: 'https://basketball.realgm.com/nba/teams/Brooklyn-Nets/38/draft-picks',
  },
  CHA: {
    code: 'CHA',
    name: 'Charlotte Hornets',
    url: 'https://basketball.realgm.com/nba/teams/Charlotte-Hornets/3/draft-picks',
  },
  CHI: {
    code: 'CHI',
    name: 'Chicago Bulls',
    url: 'https://basketball.realgm.com/nba/teams/Chicago-Bulls/4/draft-picks',
  },
  CLE: {
    code: 'CLE',
    name: 'Cleveland Cavaliers',
    url: 'https://basketball.realgm.com/nba/teams/Cleveland-Cavaliers/5/draft-picks',
  },
  DAL: {
    code: 'DAL',
    name: 'Dallas Mavericks',
    url: 'https://basketball.realgm.com/nba/teams/Dallas-Mavericks/6/draft-picks',
  },
  DEN: {
    code: 'DEN',
    name: 'Denver Nuggets',
    url: 'https://basketball.realgm.com/nba/teams/Denver-Nuggets/7/draft-picks',
  },
  DET: {
    code: 'DET',
    name: 'Detroit Pistons',
    url: 'https://basketball.realgm.com/nba/teams/Detroit-Pistons/8/draft-picks',
  },
  GSW: {
    code: 'GSW',
    name: 'Golden State Warriors',
    url: 'https://basketball.realgm.com/nba/teams/Golden-State-Warriors/9/draft-picks',
  },
  HOU: {
    code: 'HOU',
    name: 'Houston Rockets',
    url: 'https://basketball.realgm.com/nba/teams/Houston-Rockets/10/draft-picks',
  },
  IND: {
    code: 'IND',
    name: 'Indiana Pacers',
    url: 'https://basketball.realgm.com/nba/teams/Indiana-Pacers/11/draft-picks',
  },
  LAC: {
    code: 'LAC',
    name: 'LA Clippers',
    url: 'https://basketball.realgm.com/nba/teams/LA-Clippers/12/draft-picks',
  },
  LAL: {
    code: 'LAL',
    name: 'Los Angeles Lakers',
    url: 'https://basketball.realgm.com/nba/teams/Los-Angeles-Lakers/13/draft-picks',
  },
  MEM: {
    code: 'MEM',
    name: 'Memphis Grizzlies',
    url: 'https://basketball.realgm.com/nba/teams/Memphis-Grizzlies/14/draft-picks',
  },
  MIA: {
    code: 'MIA',
    name: 'Miami Heat',
    url: 'https://basketball.realgm.com/nba/teams/Miami-Heat/15/draft-picks',
  },
  MIL: {
    code: 'MIL',
    name: 'Milwaukee Bucks',
    url: 'https://basketball.realgm.com/nba/teams/Milwaukee-Bucks/16/draft-picks',
  },
  MIN: {
    code: 'MIN',
    name: 'Minnesota Timberwolves',
    url: 'https://basketball.realgm.com/nba/teams/Minnesota-Timberwolves/17/draft-picks',
  },
  NOP: {
    code: 'NOP',
    name: 'New Orleans Pelicans',
    url: 'https://basketball.realgm.com/nba/teams/New-Orleans-Pelicans/19/draft-picks',
  },
  NYK: {
    code: 'NYK',
    name: 'New York Knicks',
    url: 'https://basketball.realgm.com/nba/teams/New-York-Knicks/20/draft-picks',
  },
  OKC: {
    code: 'OKC',
    name: 'Oklahoma City Thunder',
    url: 'https://basketball.realgm.com/nba/teams/Oklahoma-City-Thunder/33/draft-picks',
  },
  ORL: {
    code: 'ORL',
    name: 'Orlando Magic',
    url: 'https://basketball.realgm.com/nba/teams/Orlando-Magic/21/draft-picks',
  },
  PHI: {
    code: 'PHI',
    name: 'Philadelphia 76ers',
    url: 'https://basketball.realgm.com/nba/teams/Philadelphia-Sixers/22/draft-picks',
  },
  PHX: {
    code: 'PHX',
    name: 'Phoenix Suns',
    url: 'https://basketball.realgm.com/nba/teams/Phoenix-Suns/23/draft-picks',
  },
  POR: {
    code: 'POR',
    name: 'Portland Trail Blazers',
    url: 'https://basketball.realgm.com/nba/teams/Portland-Trail-Blazers/24/draft-picks',
  },
  SAC: {
    code: 'SAC',
    name: 'Sacramento Kings',
    url: 'https://basketball.realgm.com/nba/teams/Sacramento-Kings/25/draft-picks',
  },
  SAS: {
    code: 'SAS',
    name: 'San Antonio Spurs',
    url: 'https://basketball.realgm.com/nba/teams/San-Antonio-Spurs/26/draft-picks',
  },
  TOR: {
    code: 'TOR',
    name: 'Toronto Raptors',
    url: 'https://basketball.realgm.com/nba/teams/Toronto-Raptors/28/draft-picks',
  },
  UTA: {
    code: 'UTA',
    name: 'Utah Jazz',
    url: 'https://basketball.realgm.com/nba/teams/Utah-Jazz/29/draft-picks',
  },
  WAS: {
    code: 'WAS',
    name: 'Washington Wizards',
    url: 'https://basketball.realgm.com/nba/teams/Washington-Wizards/30/draft-picks',
  },
};

// ---------- Utils ----------
const norm = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim();
const stripTags = (s: string) =>
  s.replace(/<br\s*\/?>/gi, ' | ').replace(/<[^>]*>/g, '');
const toInt = (s?: string) => {
  const n = parseInt(String(s ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
};
const ensureDir = async (dir: string) => fs.mkdir(dir, { recursive: true });

export function canonicalTeamName(name: string) {
  const t = name.trim();
  if (TEAM_ALIASES[t]) return TEAM_ALIASES[t];
  return t.replace(/\s{2,}/g, ' ');
}

// RealGM sometimes uses different team code abbreviations than our canonical codes
// Map common variants to canonical codes
const CODE_VARIANTS: Record<string, string> = {
  PHO: 'PHX', // Phoenix: RealGM uses PHX, we use PHX (canonical) - normalize old/variant PHO to PHX
  NOR: 'NOP', // New Orleans
  BRO: 'BKN', // Brooklyn
  BRK: 'BKN', // Brooklyn: legacy variant → canonical BKN
  SAN: 'SAS', // San Antonio
  GS: 'GSW',  // Golden State
  GOS: 'GSW', // Golden State: RealGM variant
  NY: 'NYK',  // New York
  NO: 'NOP',  // New Orleans
  SA: 'SAS',  // San Antonio
  PHL: 'PHI', // Philadelphia
  UTH: 'UTA', // Utah: RealGM variant
  CHO: 'CHA', // Charlotte: legacy variant
};

export function teamCodeFromName(
  name: string,
  MAP: Record<string, string>
): string | undefined {
  // Check if it matches a known code directly
  const upper = name.trim().toUpperCase();
  
  // First normalize any variant codes to canonical codes
  const normalizedCode = CODE_VARIANTS[upper] || upper;
  if (Object.values(MAP).includes(normalizedCode)) return normalizedCode;
  
  // Also check if the input (before normalization) matches a known code
  if (Object.values(MAP).includes(upper)) return upper;

  const cand = canonicalTeamName(name);
  if (MAP[cand]) return MAP[cand];
  const simple = cand.toLowerCase().replace(/[^a-z ]/g, '');
  for (const full of Object.keys(MAP)) {
    const s = full.toLowerCase().replace(/[^a-z ]/g, '');
    if (s === simple || s.startsWith(simple) || simple.startsWith(s))
      return MAP[full];
  }
  return undefined;
}


// ---------- Types ----------
type RawRow = {
  teamName: string;
  teamCode: string;
  seasonYear: number;
  firstRoundText: string;
  secondRoundText: string;
  detailUrl: string;
};

type PickCondition = {
  range: string;
  outcome: 'keep' | 'convey';
  recipient: string;
};

type PickOutcome = {
  pick: string; // "2027_1st", "2027_2nd"
  recipient: string; // Team code who gets it
  protection?: string; // If it has protection
};

// ---------- Simplified Types for Stepien Rule & Trading Restrictions ----------
type StepienImpact = {
  eligibleForStepien: boolean; // Does this pick count for Stepien rule?
  locksYears: number[]; // Years team can't trade due to this pick
  deadYears: number[]; // Years where team has no guaranteed pick
  nextAvailableFirstRound?: number; // Next year team can definitely trade a 1st
  conveyanceDeadline?: number; // Year this obligation must resolve by
  rolloverYears?: number[]; // Years this pick could roll to if doesn't convey
  affectedYears?: number[];
};

type ConveyanceObligation = {
  id: string; // Unique ID for this obligation
  description: string; // Human-readable summary

  // Core info
  originalYear: number; // Year the obligation started
  currentYear: number; // Current year it applies to
  finalYear?: number; // Latest year it could roll to

  // Trading impact
  stepienImpact: StepienImpact;

  // Conveyance conditions (simplified)
  conditions: {
    ifConveys: string; // "picks 5-30" or "any pick"
    ifRolls: string; // "becomes 2028 1st" or "rolls to next year"
    protection?: string; // "top-4 protected"
  };

  // Relationships
  affects?: string[]; // Other picks affected by this
  dependsOn?: string[]; // Other obligations this depends on
};

type StructuredPick = {
  id: string;
  year: number;
  round: 1 | 2;
  status: 'own' | 'outgoing' | 'incoming' | 'conditional' | 'contested';
  originalTeam: string;
  owner: string; // Canonical owner field (replaces currentOwner)

  // CORE: Stepien & Trading Info
  stepienEligible: boolean; // Quick lookup for validation
  tradeable: boolean; // Can this specific pick be traded?

  // OPTIONAL: Conveyance details (only if there's an obligation)
  conveyanceObligation?: ConveyanceObligation;

  // Basic pick info
  protection?: string | null;
  isSwap: boolean;
  conditions?: PickCondition[];
  conditionalRecipient?: string;

  // Standard fields
  recipient?: string;
  via?: string;
  pickNumber?: number | null;
  protectionDetails?: string;
  swapDetails?: {
    swapType?: 'bilateral' | 'multiway' | 'favorable' | 'unknown';
    swapWith?: string[];
    favorable?: 'most' | 'least' | null;
    controller?: string; // Team that controls the swap (gets favorable choice)
    controllerCandidates?: string[]; // NEW: All potential controllers found in text
    // Multiway pool fields
    poolTeams?: string[]; // Teams in the pool (e.g., ["DAL", "HOU", "PHX"])
    allocation?: {
      topN?: number; // How many picks go to topNTo
      topNTo?: string; // Team receiving topN picks
      remainderTo?: string; // Team receiving remaining picks
    };
  };
  conveysIf?: string[];
  otherwise?: string[];
  route?: string[];
  detailUrl?: string;
  dependsOn?: string[];
  title?: string;
  contendingTeams?: string[];
  tradedOn?: string;

  // Derived IDs for specific pick types
  swapId?: string; // For swap rights: ${baseId}_swap_${counterparty}
  obligationId?: string; // For outgoing/conditional: ${baseId}_obligation_${recipient}

  // Metadata for debugging and future format support
  metadata?: {
    realgmRawText?: string; // The exact text parsed from RealGM for this pick row
    realgmTeamPage?: string; // Team code whose page was scraped
  };
};

type CanonicalPick = {
  id: string;
  year: number;
  round: 1 | 2;
  status: 'own' | 'outgoing' | 'incoming' | 'contested' | 'conditional';
  originalTeam: string;
  owner: string; // Canonical owner field (replaces currentOwner)
  stepienEligible: boolean;
  tradeable: boolean;
  protection?: string | null;
  isSwap: boolean;
  via?: string;
  recipient?: string;
  pickNumber?: number | null;
  detailUrl?: string;
  title?: string;
  notes?: string;
  contendingTeams?: string[];
  tradedOn?: string;
  route?: string[];
  conveyanceObligation?: ConveyanceObligation;
  swapDetails?: StructuredPick['swapDetails'];
  dependsOn?: string[];
  swapId?: string; // For swap rights: ${baseId}_swap_${counterparty}
  obligationId?: string; // For outgoing/conditional: ${baseId}_obligation_${recipient}
  metadata?: {
    realgmRawText?: string; // The exact text parsed from RealGM for this pick row
    realgmTeamPage?: string; // Team code whose page was scraped
  };
};

// ---------- Parse helpers (same logic as before) ----------
export function cleanCell(cell: string) {
  let s = cell;
  s = s.replace(/([A-Za-z)])\d\b/g, '$1'); // "...Own1" -> "...Own"
  s = s.replace(/\b(\)|[A-Za-z])\s*0\b/g, '$1'); // "... to DAL0" -> "... to DAL"
  s = s.replace(/\((?:\d+)\)\s*$/g, ''); // trailing "(1)"
  return norm(s);
}
function splitParts(cell: string): string[] {
  return cell
    .split('|')
    .map((s) => cleanCell(s))
    .filter(Boolean);
}
function nearestPhrase(s: string, idx: number): string {
  const left = s.lastIndexOf('.', idx);
  const start = left === -1 ? 0 : left + 1;
  let right = s.indexOf('.', idx);
  if (right === -1) right = s.length;
  return norm(s.slice(start, right));
}
function extractRangeProtection(round: 1 | 2, text: string) {
  if (round !== 1)
    return {
      protection: null as string | null,
      protectionDetails: undefined as string | undefined,
    };
  const m = text.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s*Own\b/i);
  if (!m) return { protection: null, protectionDetails: undefined };
  const low = parseInt(m[1], 10),
    high = parseInt(m[2], 10);
  if (
    Number.isFinite(low) &&
    Number.isFinite(high) &&
    low === 1 &&
    high >= 1 &&
    high <= 30
  ) {
    return { protection: `top-${high} protected`, protectionDetails: m[0] };
  }
  return { protection: null, protectionDetails: undefined };
}
function extractProtection(round: 1 | 2, text: string) {
  if (round === 2) {
    const generic = text.match(/\bprotected\b/i);
    return generic
      ? {
          protection: null,
          protectionDetails: nearestPhrase(text, generic.index ?? 0),
        }
      : { protection: null, protectionDetails: undefined };
  }
  const topX = text.match(/\btop[-\s]?(\d+)\s*protected\b/i);
  const lottery = text.match(/\blottery\s*protected\b/i);
  const generic = text.match(/\bprotected\b/i);
  const unprot = text.match(/\bunprotected\b/i);
  if (unprot) return { protection: null, protectionDetails: undefined };
  if (topX)
    return {
      protection: `top-${topX[1]} protected`,
      protectionDetails: topX[0],
    };
  if (lottery)
    return { protection: 'lottery protected', protectionDetails: lottery[0] };
  if (generic)
    return {
      protection: 'protected',
      protectionDetails: nearestPhrase(text, generic.index ?? 0),
    };
  return extractRangeProtection(round, text);
}
export function collectTeamsAfter(
  regex: RegExp,
  s: string,
  MAP: Record<string, string>
): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(s)) !== null) {
    const list = (m[2] ?? m[1]) as string | undefined;
    if (!list) continue;
    for (const name of list
      .split(/,|\band\b/gi)
      .map((x) => norm(x))
      .filter(Boolean)) {
      const code = teamCodeFromName(name, MAP);
      if (code && !out.includes(code)) out.push(code);
    }
  }
  return out;
}
export function parseSwap(text: string, MAP: Record<string, string>) {
  const t = text.toLowerCase();
  const isSwap =
    /\bswap\b/.test(t) ||
    /swap rights/.test(t) ||
    /right to swap/.test(t) ||
    /can swap/.test(t) || // NEW: Detect "can swap"
    /Own\s+or\s+[A-Za-z0-9 .']+/i.test(text) || // Own or {TEAM_CODE} or {FULL_TEAM_NAME}
    /(most|least)\s+favorable/i.test(text) ||
    /more|less favorable/i.test(text);
  if (!isSwap)
    return {
      isSwap: false as const,
      details: undefined as StructuredPick['swapDetails'],
    };

  const fav = /(most|least)\s+favorable/i.exec(text);
  const favorableTag = fav ? (fav[1].toLowerCase() as 'most' | 'least') : null;

  const counterparts = collectTeamsAfter(
    /\b(with|between|among)\s+([A-Z][A-Za-z .'\-]+(?:\s*(?:,|and)\s*[A-Z][A-Za-z .'\-]+)*)/gi,
    text,
    MAP
  );

  // NEW: Detect "Own or {TEAM}" (e.g. "Own or OKC" or "Own or Oklahoma City")
  // Match team code OR full team name, stopping at punctuation or end of string
  const ownOrMatch = text.match(
    /Own\s+or\s+([A-Za-z0-9 .']+?)(?:\s*[,;|()]|$)/i
  );
  if (ownOrMatch) {
    const code = teamCodeFromName(ownOrMatch[1].trim(), MAP);
    if (code && !counterparts.includes(code)) counterparts.push(code);
  }

  // NEW: Detect "via {TEAM} swap" (e.g. "via OKC swap" or "via Oklahoma City swap")
  const viaSwapMatch = text.match(/via\s+([A-Za-z0-9 .']+?)\s+swap/i);
  if (viaSwapMatch) {
    const code = teamCodeFromName(viaSwapMatch[1].trim(), MAP);
    if (code && !counterparts.includes(code)) counterparts.push(code);
  }

  // NEW: Detect explicit "swap with {TEAM}" pattern (supports full team names)
  const swapWithMatch = text.match(
    /swap\s+with\s+([A-Za-z0-9 .']+?)(?:\s*[,;|()]|$)/i
  );
  if (swapWithMatch) {
    const code = teamCodeFromName(swapWithMatch[1].trim(), MAP);
    if (code && !counterparts.includes(code)) counterparts.push(code);
  }

  // NEW: Detect "swap for {TEAM}" pattern (e.g., "via SAC swap for ATL" or "swap for Oklahoma City")
  const swapForMatch = text.match(
    /swap\s+for\s+([A-Za-z0-9 .']+?)(?:\s*[,;|()]|$)/i
  );
  if (swapForMatch) {
    const code = teamCodeFromName(swapForMatch[1].trim(), MAP);
    if (code && !counterparts.includes(code)) counterparts.push(code);
  }

  // NEW: Detect team codes/names immediately after "swap" (e.g., "swap OKC" or "swap rights Oklahoma City")
  const swapTeamCodeMatch = text.match(
    /\bswap\s+(?:rights\s+)?([A-Za-z0-9 .']+?)(?:\s*[,;|()]|$)/i
  );
  if (swapTeamCodeMatch) {
    const code = teamCodeFromName(swapTeamCodeMatch[1].trim(), MAP);
    if (code && !counterparts.includes(code)) counterparts.push(code);
  }

  // NEW: Detect "{TEAM} has the right to swap" pattern
  const hasRightToSwapMatch = text.match(
    /([A-Za-z0-9 .']+?)\s+has\s+the\s+right\s+to\s+swap/i
  );
  if (hasRightToSwapMatch) {
    const code = teamCodeFromName(hasRightToSwapMatch[1].trim(), MAP);
    if (code && !counterparts.includes(code)) counterparts.push(code);
  }

  // NEW: Detect "{TEAM} can swap" pattern (e.g. "OKC can swap OKC or DEN")
  const canSwapMatch = text.match(
    /([A-Za-z0-9 .']+?)\s+can\s+swap/i
  );
  if (canSwapMatch) {
    const code = teamCodeFromName(canSwapMatch[1].trim(), MAP);
    if (code && !counterparts.includes(code)) counterparts.push(code);
  }

  // NEW: Extract ALL controller candidates for multi-controller strings
  // e.g. "via BRK swap for PHX; via WAS swap for PHX"
  const controllerCandidates: string[] = [];
  const allControllerMatches = text.matchAll(/via\s+([A-Za-z0-9 .']+?)\s+swap\s+(?:of\s+[^)]+?\s+)?for/gi);
  for (const match of allControllerMatches) {
    const code = teamCodeFromName(match[1].trim(), MAP);
    if (code && !controllerCandidates.includes(code)) {
      controllerCandidates.push(code);
    }
  }

  // Determine primary controller (logic: prioritize explicit match, fallback to inference)
  // Handle patterns like:
  // - "via UTH swap for MIN"
  // - "via UTH swap of UTH or MIN for CLE" 
  // - "via HOU swap for DAL or PHX"
  // Controller is the team after "via" and before "swap"
  let controller: string | undefined;
  
  // Primary pattern: "via X swap ... for Y" (allows optional content between swap and for)
  const swapForControllerMatch = text.match(
    /via\s+([A-Za-z0-9 .']+?)\s+swap(?:\s+(?:of|with)\s+[^)]+?)?\s+for\s+[A-Za-z0-9 .']+/i
  );
  if (swapForControllerMatch) {
    controller = teamCodeFromName(swapForControllerMatch[1].trim(), MAP);
  }
  
  // Fallback 1: Simpler "via X swap for Y" without intermediate content
  if (!controller) {
    const simpleSwapMatch = text.match(
      /via\s+([A-Za-z0-9 .']+?)\s+swap\s+for\s+[A-Za-z0-9 .']+/i
    );
    if (simpleSwapMatch) {
      controller = teamCodeFromName(simpleSwapMatch[1].trim(), MAP);
    }
  }
  
  // Fallback 2: Try matching inside parentheses "(via X swap for Y)"
  if (!controller) {
    const parenSwapMatch = text.match(
      /\(via\s+([A-Za-z0-9 .']+?)\s+swap(?:\s+(?:of|with)\s+[^)]+?)?\s+for\s+[A-Za-z0-9 .']+/i
    );
    if (parenSwapMatch) {
      controller = teamCodeFromName(parenSwapMatch[1].trim(), MAP);
    }
  }
  
  // Final fallback: If "Own or X" pattern exists and "via X swap for Y" found,
  // infer controller = X (the team in "Own or X")
  if (!controller && ownOrMatch) {
    const ownOrTeam = teamCodeFromName(ownOrMatch[1].trim(), MAP);
    // Check if "via X swap for" pattern exists where X matches ownOrTeam
    const viaSwapForMatch = text.match(
      /\(via\s+([A-Za-z0-9 .']+?)\s+swap(?:\s+(?:of|with)\s+[^)]+?)?\s+for/i
    );
    if (viaSwapForMatch && ownOrTeam) {
      const viaTeam = teamCodeFromName(viaSwapForMatch[1].trim(), MAP);
      if (viaTeam === ownOrTeam) {
        controller = viaTeam; // Controller is the team that controls the swap
      }
    }
  }

  // Check if controller matches explicit "can swap" pattern (strong signal)
  if (canSwapMatch) {
    const canSwapTeam = teamCodeFromName(canSwapMatch[1].trim(), MAP);
    if (canSwapTeam) {
      // If we already detected multiple candidates, keep them
      // If no controller found yet or it conflicts, prioritize "can swap" if it makes sense contextually
      // But usually "via X swap" is safer for simple cases. 
      // For now, add to candidates if not there.
      if (!controllerCandidates.includes(canSwapTeam)) {
        controllerCandidates.push(canSwapTeam);
      }
      // If we haven't found a controller yet, use this one
      if (!controller) controller = canSwapTeam;
    }
  }

  // Ensure primary controller is in candidates list
  if (controller && !controllerCandidates.includes(controller)) {
    controllerCandidates.push(controller);
  }

  // NEW: Detect multiway pool allocation pattern
  // "Two most favorable of DAL, HOU and PHX to HOU then other to BRK"
  // Fixed regex: Use non-greedy capture (.+?) that stops at " to " boundary.
  // Team list pattern: captures "A, B and C" or "A and B" or "A, B, C"
  const poolAllocationMatch = text.match(
    /(\w+)\s+most\s+favorable\s+of\s+(.+?)\s+to\s+([A-Za-z0-9 .']+?)\s+then\s+(?:other|remaining)\s+to\s+([A-Za-z0-9 .']+)/i
  );

  let poolTeams: string[] | undefined;
  let allocation:
    | { topN?: number; topNTo?: string; remainderTo?: string }
    | undefined;

  if (poolAllocationMatch) {
    const [, countWord, teamsStr, topRecipient, remainderRecipient] =
      poolAllocationMatch;
    const countMap: Record<string, number> = { one: 1, two: 2, three: 3 };
    const topN = countMap[countWord.toLowerCase()] || parseInt(countWord, 10);

    // Split on comma or "and" to extract individual team names
    // This handles: "A, B and C", "A, B, and C", "A and B", "A, B, C"
    poolTeams = teamsStr
      .split(/,\s*|\s+and\s+/gi)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => teamCodeFromName(t, MAP))
      .filter(Boolean) as string[];

    allocation = {
      topN,
      topNTo: teamCodeFromName(topRecipient.trim(), MAP),
      remainderTo: teamCodeFromName(remainderRecipient.trim(), MAP),
    };
  }


  let swapType: 'bilateral' | 'multiway' | 'favorable' | 'unknown' = 'unknown';
  if (favorableTag) swapType = 'favorable';
  else if (counterparts.length > 1 || poolTeams) swapType = 'multiway';
  else if (counterparts.length === 1)
    swapType = 'bilateral'; // If we have a counterpart, it's bilateral
  else swapType = 'bilateral';

  return {
    isSwap: true as const,
    details: {
      swapType,
      swapWith: counterparts.length ? counterparts : undefined,
      favorable: favorableTag,
      controller, // NEW
      controllerCandidates: controllerCandidates.length ? controllerCandidates : undefined, // NEW
      poolTeams, // NEW
      allocation, // NEW
    },
  };
}
export function detectStatus(text: string): StructuredPick['status'] {
  const t = text.toLowerCase();

  // Check for contested/swap picks FIRST (before checking "to")
  if (
    /(most|least)\s+favorable/i.test(text) ||
    /more|less favorable/i.test(text)
  )
    return 'contested';

  if (/^\s*to\s+/i.test(text)) return 'outgoing';
  if (/\bto\s+/.test(t)) return 'outgoing';
  if (/\bvia\s+/.test(t) || /\bincoming\b/.test(t)) return 'incoming';

  // NEW: Detect team code shorthand as incoming (e.g., "PHL 5-30", "UTH 9-30")
  if (parseTeamCodePrefix(text)) return 'incoming';

  if (/\bown\b/.test(t)) return 'own';
  return 'own';
}
export function parseVia(text: string): string | undefined {
  const m = text.match(/\bvia\s+([A-Z][A-Za-z .'\-]+?)(?:\s|[.;,)|]|$)/);
  return m ? teamCodeFromName(m[1], INTERNAL_TEAM_CODE_MAP) : undefined;
}

// NEW: Detect team code shorthand (e.g., "PHL 5-30" or "UTH 9-30")
// This pattern means the pick is coming FROM that team
export function parseTeamCodePrefix(text: string): string | undefined {
  // Match pattern: Team code at start, optionally followed by pick range or other text
  // Must be followed by space and then digits (pick range) or end of string
  const m = text.match(/^([A-Z]{2,3})(?:\s+[\d\-+\s;]*)?$/);
  if (!m) return undefined;

  const candidateCode = m[1];

  // Map common variations (RealGM sometimes uses different codes)
  const codeVariations: Record<string, string> = {
    PHL: 'PHI', // Philadelphia
    PHO: 'PHX', // Phoenix (input hygiene)
    SA: 'SAS', // San Antonio
    GS: 'GSW', // Golden State
    GOS: 'GSW', // Golden State
    NO: 'NOP', // New Orleans
    UTH: 'UTA', // Utah
    CHO: 'CHA', // Charlotte
    BRK: 'BKN', // Brooklyn
    BRO: 'BKN', // Brooklyn
    SAN: 'SAS', // San Antonio
  };

  const normalizedCode = codeVariations[candidateCode] || candidateCode;

  // Check if it's a valid team code (either directly or after normalization)
  const isValidCode =
    Object.values(INTERNAL_TEAM_CODE_MAP).includes(normalizedCode) ||
    Object.values(INTERNAL_TEAM_CODE_MAP).includes(candidateCode);

  return isValidCode ? normalizedCode : undefined;
}
export function parseTo(text: string): string | undefined {
  // First try to match team codes (2-3 uppercase letters)
  const codeMatch = text.match(/\bto\s+([A-Z]{2,3})(?:\b|$)/i);

  if (codeMatch) {
    const teamCode = codeMatch[1];

    // Map common variations (same as parseTeamCodePrefix)
    const codeVariations: Record<string, string> = {
      PHL: 'PHI',
      PHO: 'PHX',
      SA: 'SAS',
      GS: 'GSW',
      GOS: 'GSW',
      NO: 'NOP',
      UTH: 'UTA',
      CHO: 'CHA',
      BRK: 'BKN',
      BRO: 'BKN',
      SAN: 'SAS',
    };

    const normalizedCode = codeVariations[teamCode] || teamCode;

    // Check if it's a valid team code (either directly or after normalization)
    const isValidCode =
      Object.values(INTERNAL_TEAM_CODE_MAP).includes(normalizedCode) ||
      Object.values(INTERNAL_TEAM_CODE_MAP).includes(teamCode);

    if (isValidCode) {
      return normalizedCode;
    }
  }

  // Fallback to full team name matching
  const nameMatch = text.match(/\bto\s+([A-Z][A-Za-z .'\-]+?)(?:\s|[.;,)|]|$)/);
  if (nameMatch) {
    const result = teamCodeFromName(nameMatch[1], INTERNAL_TEAM_CODE_MAP);
    return result;
  }

  return undefined;
}
export function parseRoute(text: string): string[] | undefined {
  const paren = text.match(/\(([^)]+)\)/);
  if (!paren) return undefined;
  const segment = paren[1];
  const teams: string[] = [];
  segment.split(/;|\|/g).forEach((chunk) => {
    const names = chunk
      .split(/\bvia\b|\bto\b/gi)
      .map(norm)
      .filter(Boolean);
    for (const nm of names) {
      const code = teamCodeFromName(nm, INTERNAL_TEAM_CODE_MAP);
      if (code && !teams.includes(code)) teams.push(code);
    }
  });
  return teams.length ? teams : undefined;
}
function parseConditions(text: string) {
  const conveysIf: string[] = [];
  const otherwise: string[] = [];
  for (const chunk of text
    .split(/;|\||\./g)
    .map(norm)
    .filter(Boolean)) {
    if (/^\bif\b/i.test(chunk)) conveysIf.push(chunk);
    else if (/^\botherwise\b/i.test(chunk) || /\belse\b/i.test(chunk))
      otherwise.push(chunk);
  }
  return {
    conveysIf: conveysIf.length ? conveysIf : undefined,
    otherwise: otherwise.length ? otherwise : undefined,
  };
}

// ---------- Enhanced parsing for conditional picks ----------
function parseConditionalPick(
  text: string,
  teamCode: string,
  round: 1 | 2
): PickCondition[] | null {
  // Look for patterns like "1-4 Own; | 5-30 to UTH" or "1-4 Own; 5-30 to UTH"
  const conditionalPattern =
    /(\d+)-(\d+)\s+Own[^;]*;\s*\|?\s*(\d+)-(\d+)\s+to\s+([A-Z]{2,3})/i;
  const match = text.match(conditionalPattern);

  if (!match) return null;

  const [, keepStart, keepEnd, conveyStart, conveyEnd, recipient] = match;
  const recipientCode =
    teamCodeFromName(recipient, INTERNAL_TEAM_CODE_MAP) || recipient;

  return [
    {
      range: `${keepStart}-${keepEnd}`,
      outcome: 'keep',
      recipient: teamCode,
    },
    {
      range: `${conveyStart}-${conveyEnd}`,
      outcome: 'convey',
      recipient: recipientCode,
    },
  ];
}

/**
 * Generates a STABLE base asset ID for a pick.
 * Base ID: ${originalTeam}_${year}_${1st|2nd}
 * This ID does NOT include protection, direction (to/from), or swap suffixes.
 */
function generateBasePickId(
  originalTeam: string,
  year: number,
  round: number
): string {
  return `${originalTeam}_${year}_${round === 1 ? '1st' : '2nd'}`;
}

/**
 * Generates the legacy descriptive ID (for backward compatibility).
 * This includes suffixes like to_DAL, from_PHI, swap, protected, etc.
 */
function generateLegacyPickId(
  teamCode: string,
  year: number,
  round: number,
  suffix?: string
): string {
  const base = `${teamCode}_${year}_${round === 1 ? '1st' : '2nd'}`;
  return suffix ? `${base}_${suffix}` : base;
}

/**
 * Generates derived IDs for swap rights and obligations.
 */
function generateDerivedIds(
  baseId: string,
  pick: {
    isSwap: boolean;
    status: string;
    recipient?: string;
    swapDetails?: { swapWith?: string[] };
  }
): { swapId?: string; obligationId?: string } {
  const result: { swapId?: string; obligationId?: string } = {};

  // Swap ID: ${baseId}_swap_${counterparty}
  // Only generate if we have a valid counterparty
  if (pick.isSwap) {
    const counterparty = pick.swapDetails?.swapWith?.[0] || pick.recipient;
    if (counterparty) {
      result.swapId = `${baseId}_swap_${counterparty}`;
    }
    // If no counterparty known, omit swapId rather than use 'unknown'
  }

  // Obligation ID: ${baseId}_obligation_${recipient}
  if (
    (pick.status === 'outgoing' || pick.status === 'conditional') &&
    pick.recipient
  ) {
    result.obligationId = `${baseId}_obligation_${pick.recipient}`;
  }

  return result;
}

// Keep the old function signature for backward compatibility in internal code
function generatePickId(
  teamCode: string,
  year: number,
  round: number,
  suffix?: string
): string {
  const base = `${teamCode}_${year}_${round === 1 ? '1st' : '2nd'}`;
  return suffix ? `${base}_${suffix}` : base;
}

function isProtectedPick(text: string): boolean {
  return (
    /\bprotected\b/i.test(text) ||
    /\d+-\d+\s+own/i.test(text) ||
    /top[-\s]?\d+/i.test(text)
  );
}

function determineStepienEligibility(
  status: StructuredPick['status'],
  protection: string | null | undefined,
  isConditional: boolean,
  round: number
): boolean {
  // Only first round picks matter for Stepien
  if (round !== 1) return false;

  // Conditional/protected picks don't count for Stepien for anyone
  if (isConditional || protection) return false;

  // Outgoing unprotected picks don't count for the sending team
  if (status === 'outgoing') return false;

  // Own unprotected picks count
  if (status === 'own') return true;

  // Incoming unprotected picks count for receiving team
  if (status === 'incoming') return true;

  // Contested/swap scenarios don't guarantee ownership
  return false;
}

// ---------- NEW: Enhanced conveyance parsing functions ----------
function parseConveyanceObligation(
  text: string,
  teamCode: string,
  year: number,
  round: 1 | 2,
  relatedTexts?: { firstRound?: string; secondRound?: string }
): ConveyanceObligation | undefined {
  // Special case: Lakers 2027 multi-pick scenario
  if (
    teamCode === 'LAL' &&
    year === 2027 &&
    round === 1 &&
    relatedTexts?.secondRound
  ) {
    return createLakersConveyanceObligation(text, relatedTexts.secondRound);
  }

  // Look for rollover obligations (like Pistons scenario)
  const rolloverObligation = createRolloverConveyanceObligation(
    text,
    teamCode,
    year,
    round
  );
  if (rolloverObligation) return rolloverObligation;

  // Look for simple conditional conveyance
  const conditionalPattern = /to\s+([A-Z]{2,3})\s+if\s+([^;]+)/gi;
  const match = conditionalPattern.exec(text);

  if (!match) return undefined;

  const [, recipient, condition] = match;
  const recipientCode =
    teamCodeFromName(recipient, INTERNAL_TEAM_CODE_MAP) || recipient;

  return {
    id: `${teamCode}_${year}_${round === 1 ? '1st' : '2nd'}_conditional`,
    description: `${teamCode} ${year} ${round === 1 ? '1st' : '2nd'} conditional conveyance`,

    originalYear: year,
    currentYear: year,

    stepienImpact: {
      eligibleForStepien: false,
      locksYears:
        round === 1 ? [year - 1, year + 1].filter((y) => y > 2025) : [],
      deadYears: round === 1 ? [year] : [],
      affectedYears: [year],
    },

    conditions: {
      ifConveys: condition.trim(),
      ifRolls: 'resolves in current year',
      protection: 'conditional',
    },

    affects: [recipientCode],
  };
}

function extractPickDependencies(text: string): string[] {
  // Find references to other picks this depends on
  const dependencies: string[] = [];

  // Pattern: "if TEAM conveys/does not convey PICK in YEAR"
  const dependencyPattern =
    /if\s+([A-Z]{2,3})\s+(conveys|does\s+not\s+convey)\s+.*?(\d+)(?:st|nd)\s+.*?in\s+(\d{4})/gi;
  let match;

  while ((match = dependencyPattern.exec(text)) !== null) {
    const [, team, , round, year] = match;
    const teamCode = teamCodeFromName(team, INTERNAL_TEAM_CODE_MAP) || team;
    dependencies.push(`${teamCode}_${year}_${round}st_conditional`);
  }

  return [...new Set(dependencies)];
}

function determineStepienEligibilityWithConveyance(
  pick: StructuredPick,
  allPicks: StructuredPick[]
): boolean {
  // Base Stepien eligibility
  const baseEligible = determineStepienEligibility(
    pick.status,
    pick.protection,
    !!pick.conditions,
    pick.round
  );

  // If base is false and this pick has conveyance chains, check scenarios
  if (!baseEligible && pick.conveyanceObligation) {
    const cond = pick.conveyanceObligation.conditions;
    if (
      cond &&
      !cond.protection &&
      typeof cond.ifRolls === 'string' &&
      cond.ifRolls.trim().toLowerCase().endsWith('1st')
    ) {
      return true;
    }
  }

  return baseEligible;
}

// ---------- Simplified Conveyance Obligation Creation ----------
function createLakersConveyanceObligation(
  firstRoundText: string,
  secondRoundText: string
): ConveyanceObligation {
  // Lakers 2027: "1-4 Own; | 5-30 to UTH" affects both 1st and 2nd round destinations

  return {
    id: `LAL_2027_protected_obligation`,
    description:
      "Lakers 2027 1st is top-4 protected to Utah. If conveys, 2nd goes to Brooklyn. If doesn't convey, 2nd goes to Utah.",

    originalYear: 2027,
    currentYear: 2027,
    finalYear: 2027, // This specific obligation resolves in 2027

    stepienImpact: {
      eligibleForStepien: false, // Protected pick doesn't count for Stepien
      locksYears: [2026], // Can't trade 2026 until this resolves
      deadYears: [2027], // No guaranteed 2027 pick
      nextAvailableFirstRound: 2028, // Earliest tradeable year
      conveyanceDeadline: 2027, // Must resolve by 2027
      rolloverYears: [], // Doesn't roll over - resolves in 2027
    },

    conditions: {
      ifConveys: 'picks 5-30 to Utah',
      ifRolls: "doesn't roll - resolves in 2027",
      protection: 'top-4 protected',
    },

    affects: ['LAL_2027_2nd'], // Also affects 2nd round destination
  };
}

function createRolloverConveyanceObligation(
  text: string,
  teamCode: string,
  year: number,
  round: 1 | 2
): ConveyanceObligation | undefined {
  // Look for rollover patterns like "becomes 2028 1st if doesn't convey"
  // This is for Pistons-style scenarios that roll for multiple years

  const rolloverPattern = /becomes?\s+(\d{4})\s+(\d+)(?:st|nd)/gi;
  const match = rolloverPattern.exec(text);

  if (!match) return undefined;

  const [, rolloverYear] = match;
  const rolloverYearNum = parseInt(rolloverYear, 10);

  // Calculate affected years (original year through rollover year)
  const affectedYears = [];
  for (let y = year; y <= rolloverYearNum; y++) {
    affectedYears.push(y);
  }

  return {
    id: `${teamCode}_${year}_rolling_obligation`,
    description: `${teamCode} ${year} protected pick that rolls to ${rolloverYear} if doesn't convey`,

    originalYear: year,
    currentYear: year,
    finalYear: rolloverYearNum,

    stepienImpact: {
      eligibleForStepien: false,
      locksYears: affectedYears.filter((y) => y !== year), // All years except current
      deadYears: affectedYears, // All years are dead until it resolves
      conveyanceDeadline: rolloverYearNum,
      rolloverYears: affectedYears.slice(1), // All years it could roll to
    },

    conditions: {
      ifConveys: 'any range - depends on protection',
      ifRolls: `rolls to ${rolloverYear} if doesn't convey`,
      protection: 'protected (rolling)',
    },
  };
}

// ---------- Enhanced Structure with Simplified Conveyance ----------
function toStructured(row: RawRow, round: 1 | 2): StructuredPick[] {
  const cell = round === 1 ? row.firstRoundText : row.secondRoundText;

  // Check for conditional picks BEFORE splitting into parts
  const conditionalPicks = parseConditionalPick(cell, row.teamCode, round);

  if (conditionalPicks) {
    // For Lakers 2027, create comprehensive conveyance obligation
    if (row.teamCode === 'LAL' && row.seasonYear === 2027 && round === 1) {
      const conveyanceObligation = parseConveyanceObligation(
        cell,
        row.teamCode,
        row.seasonYear,
        round,
        { firstRound: row.firstRoundText, secondRound: row.secondRoundText }
      );

      const recipientTeam =
        conditionalPicks.find((c) => c.outcome === 'convey')?.recipient ||
        'UTH';
      const protection = conditionalPicks.find(
        (c) => c.outcome === 'keep'
      )?.range;
      
      // Check for swap semantics
      const swap = parseSwap(cell, INTERNAL_TEAM_CODE_MAP);

      // Generate stable base ID and legacy ID
      const baseId = generateBasePickId(row.teamCode, row.seasonYear, round);

      const pick: StructuredPick = {
        id: baseId, // Use stable base ID
        year: row.seasonYear,
        round,
        status: 'conditional',
        originalTeam: row.teamCode,
        owner: row.teamCode,
        stepienEligible: false, // Conditional picks never count for Stepien
        tradeable: false, // Cannot trade other picks while this is unresolved
        protection: protection
          ? `top-${protection.split('-')[1]} protected`
          : null,
        isSwap: swap.isSwap,
        swapDetails: swap.details,
        conditions: conditionalPicks,
        conditionalRecipient: recipientTeam,
        conveyanceObligation, // Simplified obligation focused on Stepien impact
        detailUrl: row.detailUrl,
        obligationId: `${baseId}_obligation_${recipientTeam}`, // Derived obligation ID
      };

      return [pick];
    }

    // Standard conditional pick processing for other scenarios
    const recipientTeam =
      conditionalPicks.find((c) => c.outcome === 'convey')?.recipient ||
      'Unknown';
    const protection = conditionalPicks.find(
      (c) => c.outcome === 'keep'
    )?.range;
    const dependencies = extractPickDependencies(cell);
    
    // NEW: Check for swap semantics in the cell text
    const swap = parseSwap(cell, INTERNAL_TEAM_CODE_MAP);

    // Generate stable base ID
    const baseId = generateBasePickId(row.teamCode, row.seasonYear, round);

    const pick: StructuredPick = {
      id: baseId, // Use stable base ID
      year: row.seasonYear,
      round,
      status: 'conditional',
      originalTeam: row.teamCode,
      owner: row.teamCode,
      stepienEligible: false,
      tradeable: false,
      protection: protection
        ? `top-${protection.split('-')[1]} protected`
        : null,
      isSwap: swap.isSwap, // Use detected swap flag
      conditions: conditionalPicks,
      conditionalRecipient: recipientTeam,
      dependsOn: dependencies.length > 0 ? dependencies : undefined,
      detailUrl: row.detailUrl,
      swapDetails: swap.details, // Include swap details if present
      obligationId:
        recipientTeam !== 'Unknown'
          ? `${baseId}_obligation_${recipientTeam}`
          : undefined,
      metadata: {
        realgmRawText: cell,
        realgmTeamPage: row.teamCode,
      },
    };

    return [pick];
  }

  // Normal processing for non-conditional picks
  const parts = splitParts(cell);
  const items = parts.length ? parts : ['Own'];

  const out: StructuredPick[] = [];
  for (const part of items) {
    const beginsWithTo = /^\s*to\s+/i.test(part);
    const via = beginsWithTo ? undefined : parseVia(part);
    const toTeam = parseTo(part);

    // NEW: Check for team code prefix (e.g., "PHL 5-30" means via PHL)
    const teamCodePrefix = parseTeamCodePrefix(part);

    const { protection, protectionDetails } = extractProtection(round, part);
    const swap = parseSwap(part, INTERNAL_TEAM_CODE_MAP);
    const cond = parseConditions(part);
    const route = parseRoute(part);

    // NEW: If text starts with "Own", this is the page team's pick regardless of via
    const startsWithOwn = /^Own\b/i.test(part);

    // Determine status - if starts with "Own", it's "own" status (even if "via" appears later)
    let status = detectStatus(part);
    if (startsWithOwn) {
      // "Own or TEAM" means the page team owns their pick slot (with swap rights)
      // Status must be "own" - this is DAL's own pick slot, not contested
      status = 'own';
    }

    let originalTeam = row.teamCode;
    let owner = row.teamCode;

    // Handle different pick types
    if (via && !startsWithOwn) {
      // Only use via for originalTeam if NOT starting with "Own"
      originalTeam = via;
    } else if (teamCodePrefix && status === 'incoming') {
      // Team code shorthand: "PHL 5-30" means pick originally from PHL
      originalTeam = teamCodePrefix;
    }

    if (status === 'outgoing' && toTeam) owner = toTeam;
    if (status === 'incoming') owner = row.teamCode;

    // Parse conveyance obligations for trading restrictions
    const conveyanceObligation = parseConveyanceObligation(
      part,
      row.teamCode,
      row.seasonYear,
      round
    );
    const dependencies = extractPickDependencies(part);

    // Generate stable base ID
    const baseId = generateBasePickId(originalTeam, row.seasonYear, round);

    // Determine Stepien eligibility
    // For "Own or TEAM" swaps, the page team owns their pick (even with swap rights)
    // so it should count for Stepien rule
    let stepienEligible = determineStepienEligibility(
      status,
      protection,
      false,
      round
    );
    // Override: if starts with "Own" and is a swap, team owns their pick (Stepien eligible)
    if (startsWithOwn && swap.isSwap && round === 1 && !protection) {
      stepienEligible = true;
    }

    // Detect if "via" is only swap-control wording (e.g., "via OKC swap for DAL")
    // When startsWithOwn is true, this pattern describes swap control, not trade-chain origin
    const viaIsSwapControl = /via\s+[A-Za-z0-9 .']+\s+swap\s+for/i.test(part);

    const pick: StructuredPick = {
      id: baseId, // Use stable base ID
      year: row.seasonYear,
      round,
      status,
      originalTeam,
      owner,
      stepienEligible,
      tradeable: !protection && status !== 'outgoing',
      protection,
      isSwap: swap.isSwap,
      via:
        // Suppress via if it's only swap-control wording when startsWithOwn is true
        (startsWithOwn && viaIsSwapControl)
          ? undefined
          : via && via !== originalTeam && via !== owner
            ? via
            : (teamCodePrefix && status === 'incoming' ? teamCodePrefix : undefined),
      recipient: toTeam,
      pickNumber: null,
      protectionDetails,
      swapDetails: swap.details
        ? (() => {
            // Filter out page team from swapWith (page team shouldn't be in swap partners)
            const filteredSwapWith = swap.details.swapWith?.filter(
              (t) => t !== row.teamCode
            );
            // If "Own or TEAM" pattern detected and only one partner remains, ensure bilateral swap type
            const finalSwapType =
              startsWithOwn && filteredSwapWith?.length === 1
                ? 'bilateral'
                : swap.details.swapType;
            
            // Validate controller after filtering:
            // Controller must be in swapWith OR be valid for bilateral "Own or X" swaps
            let finalController = swap.details.controller;
            if (finalController && filteredSwapWith?.length) {
              // For bilateral swaps, controller should be the swap partner
              if (finalSwapType === 'bilateral' && !filteredSwapWith.includes(finalController)) {
                // If controller isn't in swapWith, use first swap partner for bilateral
                finalController = filteredSwapWith[0];
              }
            }
            
            return {
              ...swap.details,
              swapWith: filteredSwapWith?.length ? filteredSwapWith : undefined,
              swapType: finalSwapType,
              controller: finalController, // Explicitly preserve validated controller
              // Preserve multiway pool fields
              poolTeams: swap.details.poolTeams,
              allocation: swap.details.allocation,
            };
          })()
        : undefined,
      conveysIf: cond.conveysIf,
      otherwise: cond.otherwise,
      route,
      conveyanceObligation, // Simplified obligation for Stepien compliance
      dependsOn: dependencies.length > 0 ? dependencies : undefined,
      detailUrl: row.detailUrl,
      metadata: {
        realgmRawText: part, // Capture the specific part text that was parsed
        realgmTeamPage: row.teamCode,
      },
    };

    // Generate derived IDs for swaps and obligations
    const derivedIds = generateDerivedIds(baseId, pick);
    if (derivedIds.swapId) pick.swapId = derivedIds.swapId;
    if (derivedIds.obligationId) pick.obligationId = derivedIds.obligationId;

    // Adjust status and ownership based on additional context
    if (toTeam && status !== 'incoming') {
      pick.status = 'outgoing';
      // FIX: For outgoing picks, the owner should be the recipient team
      if (!swap.isSwap && !protection) {
        pick.owner = toTeam; // Unprotected outgoing picks belong to recipient
      }
    }
    if (
      /(most|least)\s+favorable/i.test(part) ||
      /more|less favorable/i.test(part)
    )
      pick.status = 'contested';

    // NEW: Handle multiway pool swaps where outcome is unknown
    if (
      swap.details?.allocation &&
      swap.details.poolTeams?.includes(row.teamCode)
    ) {
      // Multiway pool swap - outcome unknown, mark as contested
      pick.status = 'contested';
      // Owner is uncertain - could be any recipient
      // Leave owner as page team but mark stepienEligible false
      pick.stepienEligible = false;
      pick.tradeable = false;
    }

    out.push(pick);
  }
  return out;
}

// ---------- Year Coverage Constants ----------
// TODO: Derive NEXT_DRAFT_YEAR from config or current date logic
const NEXT_DRAFT_YEAR = 2026;
const REQUIRED_MAX_YEAR = NEXT_DRAFT_YEAR + 6; // 2032
const REQUIRED_YEARS = Array.from(
  { length: REQUIRED_MAX_YEAR - NEXT_DRAFT_YEAR + 1 },
  (_, i) => NEXT_DRAFT_YEAR + i
); // [2026, 2027, 2028, 2029, 2030, 2031, 2032]

/**
 * Check if page content contains sufficient year coverage.
 * Returns true if at least 5 of the required years (2026-2032) are present.
 */
function hasRequiredYearCoverage(bodyText: string): boolean {
  let yearsFound = 0;
  for (const year of REQUIRED_YEARS) {
    if (bodyText.includes(String(year))) {
      yearsFound++;
    }
  }
  // Require at least 5 years to be present (allows for some teams having fewer picks)
  return yearsFound >= 5;
}

// ---------- Per-team page scraper (browser-based with Playwright) ----------
async function fetchTeamHtml(url: string) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  try {
    const page = await browser.newPage();

    // Set realistic browser headers
    await page.setExtraHTTPHeaders({
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      DNT: '1',
      Connection: 'keep-alive',
    });

    // Navigate with reduced timeout and fallback strategy
    try {
      await page.goto(url, {
        waitUntil: 'load',
        timeout: 15000,
      });
    } catch (timeoutError) {
      console.warn(
        `   ⚠️ Initial load timed out, trying with domcontentloaded...`
      );
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });
    }

    // Wait for proper table content to render
    // Strategy 1: Wait for "Future 1st Round Picks" header to appear
    try {
      await page.waitForFunction(
        () => document.body.innerText.includes('Future 1st Round Picks'),
        { timeout: 8000 }
      );
      console.log('   ✓ Found "Future 1st Round Picks" header');
    } catch {
      console.warn('   ⚠️ Could not find draft picks header, continuing...');
    }

    // Strategy 2: Wait for year text to appear (specifically check for 2032)
    // This ensures the full table has rendered, not just the loading placeholder
    try {
      // Wait for year 2032 to appear AND "Loading" to disappear
      await page.waitForFunction(
        () => {
          const text = document.body.innerText;
          return text.includes('2032') && !text.includes('Loading, please wait');
        },
        { timeout: 10000 }
      );
      console.log(`   ✓ Found year ${REQUIRED_MAX_YEAR} in page content`);
    } catch {
      // Extended wait for slow-loading pages (like BKN)
      console.warn(
        `   ⚠️ Year ${REQUIRED_MAX_YEAR} not found yet, extending wait...`
      );
      await page.waitForTimeout(5000);

      // Final check - if still loading, wait more
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (bodyText.includes('Loading, please wait')) {
        console.warn('   ⚠️ Page still shows "Loading", waiting additional 5s...');
        await page.waitForTimeout(5000);
      }
    }

    // Minimal additional wait for any final rendering
    await page.waitForTimeout(1000);

    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}

/** Get all text lines in a section until the next h2/h3 (or end). */
function collectSectionLines($: cheerio.CheerioAPI, headerEl: any) {
  const lines: string[] = [];
  // Grab all siblings until the next header section
  const $siblings = $(headerEl).nextUntil('h2, h3');
  if ($siblings.length === 0) return lines;

  $siblings.each((_, el) => {
    const html = $(el).html() ?? '';
    // Normalize and split by <br> or block boundaries
    const text = stripTags(html);
    for (const piece of text.split(/\n|\r|¦/g).map(norm)) {
      if (piece) lines.push(piece);
    }
  });
  return lines;
}

/** Parse lines of the form: YEAR, DESCRIPTION, COUNT (we only need YEAR + DESCRIPTION). */
function parseYearBlocks(lines: string[]) {
  const yearBlocks: Array<{ year: number; text: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const y = lines[i].match(/^\d{4}$/) ? parseInt(lines[i], 10) : undefined;
    if (!y) continue;
    const desc = lines[i + 1] ? cleanCell(lines[i + 1]) : 'Own';
    yearBlocks.push({ year: y, text: desc });
    // skip optional count (lines[i+2]) if it's a number
    if (lines[i + 2] && /^\d+$/.test(lines[i + 2])) i += 2;
    else i += 1; // we already consumed description
  }
  return yearBlocks;
}

/**
 * Compute max year from parsed rows (for both rounds combined)
 */
function computeMaxYear(
  firstRows: Array<{ year: number; text: string }>,
  secondRows: Array<{ year: number; text: string }>
): number {
  const allYears = [
    ...firstRows.map((r) => r.year),
    ...secondRows.map((r) => r.year),
  ];
  return allYears.length > 0 ? Math.max(...allYears) : 0;
}

/**
 * Parse draft picks from HTML content
 */
function parsePicksFromHtml(
  $: cheerio.CheerioAPI,
  teamCode: string
): {
  firstRows: Array<{ year: number; text: string }>;
  secondRows: Array<{ year: number; text: string }>;
} {
  // Find the two section headers
  const h2s = $('h2, h3').toArray();
  console.log(`   • Found ${h2s.length} headers for ${teamCode}`);

  // Debug: log all headers
  h2s.forEach((el, i) => {
    console.log(`     Header ${i}: "${$(el).text()}"`);
  });

  const firstHeader = h2s.find((el) =>
    /Future\s+1st\s+Round\s+Picks/i.test($(el).text())
  );
  const secondHeader = h2s.find((el) =>
    /Future\s+2nd\s+Round\s+Picks/i.test($(el).text())
  );

  console.log(`   • First header found: ${!!firstHeader}`);
  console.log(`   • Second header found: ${!!secondHeader}`);

  // Try multiple strategies to find the data
  let firstRows: Array<{ year: number; text: string }> = [];
  let secondRows: Array<{ year: number; text: string }> = [];

  if (firstHeader) {
    // Strategy 1: Look for tables
    const firstTable = $(firstHeader).next('table');
    if (firstTable.length > 0) {
      firstRows = parseTableRows($, firstTable);
      console.log(
        `   • Found table with ${firstRows.length} first round entries`
      );
    } else {
      // Strategy 2: Look for the compressed data in sibling divs
      const $siblings = $(firstHeader).nextUntil('h2, h3');
      console.log(
        `   • No table found, checking ${$siblings.length} sibling elements for compressed data`
      );

      // Concatenate ALL text from all siblings to handle split data
      let allSiblingText = '';
      $siblings.each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        allSiblingText += ' ' + text;
      });

      // Try to parse the combined text
      if (
        allSiblingText.includes('YearFirst Round Picks') ||
        (allSiblingText.includes('Year') && allSiblingText.includes('Own'))
      ) {
        console.log(
          `     Found compressed 1st round data: "${allSiblingText.substring(0, 100)}..."`
        );
        firstRows = parseCompressedPickData(allSiblingText, '1st');
      }

      // Fallback: If still missing years 2031/2032, try getting text from entire section parent
      if (firstRows.length > 0) {
        const maxParsedYear = Math.max(...firstRows.map((r) => r.year));
        if (maxParsedYear < REQUIRED_MAX_YEAR) {
          console.log(
            `     ⚠️ First round maxYear=${maxParsedYear}, trying expanded search...`
          );
          // Get parent container and extract all text
          const parentText = $(firstHeader).parent().text();
          const expandedRows = parseCompressedPickData(parentText, '1st');
          if (expandedRows.length > 0) {
            const expandedMaxYear = Math.max(...expandedRows.map((r) => r.year));
            if (expandedMaxYear > maxParsedYear) {
              console.log(
                `     ✓ Expanded search found more years (maxYear=${expandedMaxYear})`
              );
              firstRows = expandedRows;
            }
          }
        }
      }
    }
  }

  if (secondHeader) {
    // Strategy 1: Look for tables
    const secondTable = $(secondHeader).next('table');
    if (secondTable.length > 0) {
      secondRows = parseTableRows($, secondTable);
      console.log(
        `   • Found table with ${secondRows.length} second round entries`
      );
    } else {
      // Strategy 2: Look for compressed data in sibling divs
      const $siblings = $(secondHeader).nextUntil('h2, h3');
      console.log(
        `   • No table found, checking ${$siblings.length} sibling elements for compressed data`
      );

      // Concatenate ALL text from all siblings to handle split data
      let allSiblingText = '';
      $siblings.each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        allSiblingText += ' ' + text;
      });

      // Try to parse the combined text
      if (
        allSiblingText.includes('YearSecond Round Picks') ||
        (allSiblingText.includes('Year') && allSiblingText.includes('To'))
      ) {
        console.log(
          `     Found compressed 2nd round data: "${allSiblingText.substring(0, 100)}..."`
        );
        secondRows = parseCompressedPickData(allSiblingText, '2nd');
      }

      // Fallback: If still missing years 2031/2032, try getting text from entire section parent
      if (secondRows.length > 0) {
        const maxParsedYear = Math.max(...secondRows.map((r) => r.year));
        if (maxParsedYear < REQUIRED_MAX_YEAR) {
          console.log(
            `     ⚠️ Second round maxYear=${maxParsedYear}, trying expanded search...`
          );
          const parentText = $(secondHeader).parent().text();
          const expandedRows = parseCompressedPickData(parentText, '2nd');
          if (expandedRows.length > 0) {
            const expandedMaxYear = Math.max(...expandedRows.map((r) => r.year));
            if (expandedMaxYear > maxParsedYear) {
              console.log(
                `     ✓ Expanded search found more years (maxYear=${expandedMaxYear})`
              );
              secondRows = expandedRows;
            }
          }
        }
      }
    }
  }

  return { firstRows, secondRows };
}

async function scrapeTeamPage(teamCode: string, teamName: string, url: string) {
  // First attempt
  let html = await fetchTeamHtml(url);
  let $ = cheerio.load(html);
  let { firstRows, secondRows } = parsePicksFromHtml($, teamCode);

  console.log(`   • First round picks: ${firstRows.length}`);
  console.log(`   • Second round picks: ${secondRows.length}`);

  // Check if we have complete year coverage
  let maxYear = computeMaxYear(firstRows, secondRows);
  console.log(`   • Max year found: ${maxYear} (required: ${REQUIRED_MAX_YEAR})`);

  // Retry once if year coverage is incomplete
  if (maxYear < REQUIRED_MAX_YEAR) {
    console.warn(
      `   ⚠️ Incomplete year coverage for ${teamCode}: maxYear=${maxYear} < ${REQUIRED_MAX_YEAR}`
    );
    console.log(`   ⏳ Retrying with extended wait...`);

    // Re-fetch with fresh browser session (fetchTeamHtml has built-in extended waits)
    html = await fetchTeamHtml(url);
    $ = cheerio.load(html);
    const retryResult = parsePicksFromHtml($, teamCode);
    firstRows = retryResult.firstRows;
    secondRows = retryResult.secondRows;

    maxYear = computeMaxYear(firstRows, secondRows);
    console.log(`   • Retry - Max year found: ${maxYear}`);

    // If still incomplete after retry, throw error
    if (maxYear < REQUIRED_MAX_YEAR) {
      throw new Error(
        `INCOMPLETE_SCRAPE: ${teamCode} maxYear=${maxYear} < ${REQUIRED_MAX_YEAR} after retry. ` +
          `Page may be slow or RealGM structure changed.`
      );
    }
    console.log(`   ✓ Retry successful - year coverage now complete`);
  }

  // Merge into per-year rows containing both rounds
  const byYear = new Map<number, { fr: string; sr: string }>();
  for (const { year, text } of firstRows)
    byYear.set(year, { fr: text, sr: 'Own' });
  for (const { year, text } of secondRows) {
    const prev = byYear.get(year) || { fr: 'Own', sr: 'Own' };
    prev.sr = text;
    byYear.set(year, prev);
  }

  // Build RawRow[]
  const rows: RawRow[] = [];
  for (const year of [...byYear.keys()].sort((a, b) => a - b)) {
    const pair = byYear.get(year)!;
    rows.push({
      teamName,
      teamCode,
      seasonYear: year,
      firstRoundText: pair.fr,
      secondRoundText: pair.sr,
      detailUrl: url,
    });
  }

  return rows;
}

/** Parse compressed pick data like "2026Own120271-4 Own; 5-30 to UTH28Own1..." */
function parseCompressedPickData(
  compressedText: string,
  roundType: '1st' | '2nd'
): Array<{ year: number; text: string }> {
  const rows: Array<{ year: number; text: string }> = [];

  try {
    // Remove header text and loading placeholders
    let text = compressedText.replace(
      /Year(First|Second)\s*Round\s*Picks/gi,
      ''
    );
    text = text.replace(/Loading,\s*please\s*wait/gi, '');
    text = norm(text);

    console.log(
      `     Parsing compressed ${roundType} round data (${text.length} chars): "${text.substring(0, 150)}..."`
    );

    // Find all year positions using matchAll
    const yearMatches = [...text.matchAll(/20(2[4-9]|3[0-5])/g)];
    console.log(`     Found ${yearMatches.length} year markers in text`);

    if (yearMatches.length > 0) {
      // Extract text between consecutive years
      for (let i = 0; i < yearMatches.length; i++) {
        const match = yearMatches[i];
        const year = parseInt(match[0], 10);
        const startPos = (match.index ?? 0) + match[0].length;

        // End position is either the next year or end of text
        const endPos =
          i < yearMatches.length - 1
            ? yearMatches[i + 1].index ?? text.length
            : text.length;

        let pickData = text.slice(startPos, endPos);

        // Clean up the pick data
        pickData = norm(pickData);
        // Remove trailing count numbers (1, 2, 3, etc.) that RealGM adds
        pickData = pickData.replace(/\s*\d+\s*$/, '');
        // Remove leading/trailing punctuation
        pickData = pickData.replace(/^[;,|\s]+|[;,|\s]+$/g, '');

        if (pickData && Number.isFinite(year) && year >= 2024 && year <= 2035) {
          console.log(`       Year ${year}: "${pickData.substring(0, 80)}${pickData.length > 80 ? '...' : ''}"`);
          rows.push({ year, text: pickData });
        }
      }

      // Log max year found for debugging
      if (rows.length > 0) {
        const maxYear = Math.max(...rows.map((r) => r.year));
        console.log(`     Max year parsed: ${maxYear}`);
      }
    }

    // If the regex approach didn't find enough, try manual fallback for specific patterns
    if (rows.length === 0 || Math.max(...rows.map((r) => r.year), 0) < REQUIRED_MAX_YEAR) {
      console.log(`     Trying manual pattern matching...`);

      // Generic patterns for any team
      const genericPatterns = [
        { year: 2026, pattern: /\b2026\s*([A-Za-z].*?)(?=\b20[23]\d|$)/i },
        { year: 2027, pattern: /\b2027\s*([A-Za-z].*?)(?=\b20[23]\d|$)/i },
        { year: 2028, pattern: /\b2028\s*([A-Za-z].*?)(?=\b20[23]\d|$)/i },
        { year: 2029, pattern: /\b2029\s*([A-Za-z].*?)(?=\b20[23]\d|$)/i },
        { year: 2030, pattern: /\b2030\s*([A-Za-z].*?)(?=\b20[23]\d|$)/i },
        { year: 2031, pattern: /\b2031\s*([A-Za-z].*?)(?=\b20[23]\d|$)/i },
        { year: 2032, pattern: /\b2032\s*([A-Za-z].*?)(?=\b20[23]\d|$)/i },
      ];

      for (const { year, pattern } of genericPatterns) {
        // Skip if we already have this year
        if (rows.find((r) => r.year === year)) continue;

        const match = text.match(pattern);
        if (match && match[1]) {
          let pickText = match[1].trim();
          // Clean up
          pickText = pickText.replace(/\s*\d+\s*$/, '');
          if (pickText) {
            console.log(`       Manual match - Year ${year}: "${pickText.substring(0, 50)}..."`);
            rows.push({ year, text: pickText });
          }
        }
      }
    }
  } catch (error) {
    console.error(`     Error parsing compressed data: ${error}`);
  }

  // Sort by year and deduplicate
  rows.sort((a, b) => a.year - b.year);

  return rows;
}

/** Parse table rows to extract year and pick description */
function parseTableRows($: cheerio.CheerioAPI, table: any) {
  const rows: Array<{ year: number; text: string }> = [];

  if (table.length === 0) return rows;

  // Look for tbody rows first, then fallback to direct table rows
  let tableRows = table.find('tbody tr');
  if (tableRows.length === 0) {
    tableRows = table.find('tr');
  }

  console.log(`     Found ${tableRows.length} table rows`);

  tableRows.each((index: number, row: Element) => {
    const $row = $(row);
    const cells = $row.find('td');

    if (cells.length >= 2) {
      const yearCell = cells.eq(0);
      const pickCell = cells.eq(1);

      const yearText = yearCell.text().trim();
      const pickHtml = pickCell.html() || '';

      // Clean up the HTML and extract text
      const pickText = stripTags(pickHtml).replace(/\s+/g, ' ').trim();

      const year = parseInt(yearText, 10);
      console.log(
        `     Row ${index}: Year=${yearText} (${year}), Pick="${pickText.substring(
          0,
          50
        )}..."`
      );

      if (Number.isFinite(year) && pickText) {
        rows.push({ year, text: cleanCell(pickText) });
      }
    }
  });

  return rows;
}

async function writePerTeamStructured(code: string, picks: CanonicalPick[]) {
  const dir = path.join(OUT_DIR, 'structured');
  await ensureDir(dir);
  const p = path.join(dir, `draft_picks_${code}.json`);
  await fs.writeFile(p, serialize(picks), 'utf8');
  return p;
}

/**
 * Writes ALL picks mentioned on a team's page (including outgoing picks).
 * Used as input for the ledger builder and for debugging/validation.
 * Always pretty-printed for human readability since these files are inspected during development.
 */
async function writeMentionsFile(code: string, picks: CanonicalPick[]) {
  const dir = path.join(OUT_DIR, 'mentions');
  await ensureDir(dir);
  const p = path.join(dir, `draft_picks_mentions_${code}.json`);
  // Always pretty-print: these files are used both programmatically (ledger builder)
  // and for debugging/validation (human inspection). JSON.parse() handles both formats identically.
  await fs.writeFile(p, JSON.stringify(picks, null, 2), 'utf8');
  return p;
}

function toCanonicalPick(pick: StructuredPick): CanonicalPick {
  return {
    id: pick.id,
    year: pick.year,
    round: pick.round,
    status: pick.status,
    originalTeam: pick.originalTeam,
    owner: pick.owner,
    stepienEligible: Boolean(pick.stepienEligible),
    tradeable: Boolean(pick.tradeable),
    protection: pick.protection ?? null,
    isSwap: Boolean(pick.isSwap),
    via: pick.via ?? undefined,
    recipient: pick.recipient ?? undefined,
    pickNumber: pick.pickNumber ?? null,
    detailUrl: pick.detailUrl,
    title: pick.title,
    notes:
      Array.isArray(pick.conveysIf) && pick.conveysIf.length
        ? pick.conveysIf.join(' | ')
        : Array.isArray(pick.otherwise) && pick.otherwise.length
          ? pick.otherwise.join(' | ')
          : undefined,
    contendingTeams: pick.contendingTeams,
    tradedOn: pick.tradedOn,
    route: pick.route,
    conveyanceObligation: pick.conveyanceObligation,
    swapDetails: pick.swapDetails,
    dependsOn: pick.dependsOn,
    swapId: pick.swapId,
    obligationId: pick.obligationId,
    metadata: pick.metadata,
  };
}

// ---------- Main ----------
import { fileURLToPath } from 'url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    try {
      console.log(
        `🔍 Scraping RealGM future drafts — Teams: ${TEAM_FILTER.join(', ')}`
      );

      for (const code of TEAM_FILTER) {
        const entry = REALGM_TEAM_URLS[code];
        if (!entry) {
          console.warn(`⚠️  No RealGM URL configured for ${code}. Skipping.`);
          continue;
        }
        console.log(`🌐 Fetching ${entry.name} (${code}) → ${entry.url}`);

        const rows = await scrapeTeamPage(entry.code, entry.name, entry.url);
        console.log(`   • Parsed ${rows.length} season rows`);

        // Per-team STRUCTURED
        const teamStructured: StructuredPick[] = [];
        for (const r of rows) {
          teamStructured.push(...toStructured(r, 1));
          teamStructured.push(...toStructured(r, 2));
        }

        // Write MENTIONS file FIRST (all picks from this team's page, before filtering)
        // This includes outgoing picks that the ledger needs to see
        const allMentions = teamStructured.map(toCanonicalPick).sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.round - b.round;
        });
        await writeMentionsFile(entry.code, allMentions);
        console.log(`   • Wrote ${allMentions.length} picks to mentions file`);

        // Write INVENTORY file (owned-only, for backward compatibility)
        const canonical = teamStructured
          .filter((pick) => pick.owner === entry.code)
          .map(toCanonicalPick)
          .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.round - b.round;
          });
        await writePerTeamStructured(entry.code, canonical);
        console.log(`   • Wrote ${canonical.length} picks to inventory file`);
      }
      console.log(`📦 Per-team files saved under:`);
      console.log(
        `    ${path.resolve(path.join(OUT_DIR, 'structured'))} (inventory)`
      );
      console.log(
        `    ${path.resolve(path.join(OUT_DIR, 'mentions'))} (all mentions)`
      );
      console.log('🎯 Done');
    } catch (err) {
      console.error('🔥 Fatal error:', err);
      process.exit(1);
    }
  })();
}
