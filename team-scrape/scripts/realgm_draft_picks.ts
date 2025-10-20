#!/usr/bin/env -S node --experimental-strip-types
/**
 * RealGM Future Draft Picks Scraper — Per-Team Pages (v4.1)
 *
 * Fix: RealGM team pages don't use <table>; parse section text:
 *   "## ... Future 1st Round Picks" and "## ... Future 2nd Round Picks"
 *   Lines come in groups: <YEAR>, <DESCRIPTION>, <COUNT>
 *
 * Outputs (same as before):
 *   team-scrape/out/draft_picks_raw.json
 *   team-scrape/out/draft_picks_structured.json
 *   team-scrape/out/raw/draft_picks_{CODE}.json
 *   team-scrape/out/structured/draft_picks_{CODE}.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import got from 'got';
import * as cheerio from 'cheerio';

// ---------- CLI / ENV ----------
const argv = process.argv.slice(2);
const asSet = new Set(argv);
const getArgVal = (flag: string, def?: string) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

const OUT_DIR =
  process.env.OUT_DIR || getArgVal('--outDir', 'team-scrape/out')!;
const PRETTY = asSet.has('--pretty') || process.env.PRETTY === '1';
const serialize = (obj: unknown) =>
  PRETTY ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);

// Default to your three test teams
const TEAMS_ARG = getArgVal('--teams', process.env.TEAMS || 'LAL,OKC,NYK');
const TEAM_FILTER = TEAMS_ARG.split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

// ---------- Team Maps & URLs ----------
const INTERNAL_TEAM_CODE_MAP: Record<string, string> = {
  'Atlanta Hawks': 'ATL',
  'Boston Celtics': 'BOS',
  'Brooklyn Nets': 'BRK',
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
  'Phoenix Suns': 'PHO',
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
  LAL: {
    code: 'LAL',
    name: 'Los Angeles Lakers',
    url: 'https://basketball.realgm.com/nba/teams/Los-Angeles-Lakers/13/draft-picks',
  },
  OKC: {
    code: 'OKC',
    name: 'Oklahoma City Thunder',
    url: 'https://basketball.realgm.com/nba/teams/Oklahoma-City-Thunder/33/draft-picks',
  },
  NYK: {
    code: 'NYK',
    name: 'New York Knicks',
    url: 'https://basketball.realgm.com/nba/teams/New-York-Knicks/20/draft-picks',
  },
  MEM: {
    code: 'MEM',
    name: 'Memphis Grizzlies',
    url: 'https://basketball.realgm.com/nba/teams/Memphis-Grizzlies/14/draft-picks',
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

function canonicalTeamName(name: string) {
  const t = name.trim();
  if (TEAM_ALIASES[t]) return TEAM_ALIASES[t];
  return t.replace(/\s{2,}/g, ' ');
}
function teamCodeFromName(
  name: string,
  MAP: Record<string, string>
): string | undefined {
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
  currentOwner: string;

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
  };
  conveysIf?: string[];
  otherwise?: string[];
  route?: string[];
  detailUrl?: string;
};

// ---------- Parse helpers (same logic as before) ----------
function cleanCell(cell: string) {
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
function collectTeamsAfter(
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
function parseSwap(text: string, MAP: Record<string, string>) {
  const t = text.toLowerCase();
  const isSwap =
    /\bswap\b/.test(t) ||
    /swap rights/.test(t) ||
    /right to swap/.test(t) ||
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
    INTERNAL_TEAM_CODE_MAP
  );

  let swapType: 'bilateral' | 'multiway' | 'favorable' | 'unknown' = 'unknown';
  if (favorableTag) swapType = 'favorable';
  else if (counterparts.length > 1) swapType = 'multiway';
  else swapType = 'bilateral';

  return {
    isSwap: true as const,
    details: {
      swapType,
      swapWith: counterparts.length ? counterparts : undefined,
      favorable: favorableTag,
    },
  };
}
function detectStatus(text: string): StructuredPick['status'] {
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
function parseVia(text: string): string | undefined {
  const m = text.match(/\bvia\s+([A-Z][A-Za-z .'\-]+?)(?:\s|[.;,)|]|$)/);
  return m ? teamCodeFromName(m[1], INTERNAL_TEAM_CODE_MAP) : undefined;
}

// NEW: Detect team code shorthand (e.g., "PHL 5-30" or "UTH 9-30")
// This pattern means the pick is coming FROM that team
function parseTeamCodePrefix(text: string): string | undefined {
  // Match pattern: Team code at start, optionally followed by pick range or other text
  // Must be followed by space and then digits (pick range) or end of string
  const m = text.match(/^([A-Z]{2,3})(?:\s+[\d\-+\s;]*)?$/);
  if (!m) return undefined;
  
  const candidateCode = m[1];
  
  // Map common variations (RealGM sometimes uses different codes)
  const codeVariations: Record<string, string> = {
    'PHL': 'PHI', // Philadelphia 
    'PHX': 'PHO', // Phoenix (sometimes)
    'SA': 'SAS',  // San Antonio
    'GS': 'GSW',  // Golden State
    'NO': 'NOP',  // New Orleans
  };
  
  const normalizedCode = codeVariations[candidateCode] || candidateCode;
  
  // Check if it's a valid team code (either directly or after normalization)
  const isValidCode = Object.values(INTERNAL_TEAM_CODE_MAP).includes(normalizedCode) ||
                      Object.values(INTERNAL_TEAM_CODE_MAP).includes(candidateCode);
  
  return isValidCode ? normalizedCode : undefined;
}
function parseTo(text: string): string | undefined {
  // First try to match team codes (2-3 uppercase letters)
  const codeMatch = text.match(/\bto\s+([A-Z]{2,3})(?:\b|$)/i);

  if (codeMatch) {
    const teamCode = codeMatch[1];
    
    // Map common variations (same as parseTeamCodePrefix)
    const codeVariations: Record<string, string> = {
      'PHL': 'PHI',
      'PHX': 'PHO',
      'SA': 'SAS',
      'GS': 'GSW',
      'NO': 'NOP',
    };
    
    const normalizedCode = codeVariations[teamCode] || teamCode;

    // Check if it's a valid team code (either directly or after normalization)
    const isValidCode = Object.values(INTERNAL_TEAM_CODE_MAP).includes(normalizedCode) ||
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
function parseRoute(text: string): string[] | undefined {
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
    // Check if any scenario results in the team getting a guaranteed pick
    for (const condition of pick.conveyanceObligation.conditions) {
      if (!condition.protection && condition.ifRolls.endsWith('1st')) {
        return true; // Potentially eligible depending on conditions
      }
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

      const pick: StructuredPick = {
        id: generatePickId(row.teamCode, row.seasonYear, round, 'conditional'),
        year: row.seasonYear,
        round,
        status: 'conditional',
        originalTeam: row.teamCode,
        currentOwner: row.teamCode,
        stepienEligible: false, // Conditional picks never count for Stepien
        tradeable: false, // Cannot trade other picks while this is unresolved
        protection: protection
          ? `top-${protection.split('-')[1]} protected`
          : null,
        isSwap: false,
        conditions: conditionalPicks,
        conditionalRecipient: recipientTeam,
        conveyanceObligation, // Simplified obligation focused on Stepien impact
        detailUrl: row.detailUrl,
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

    const pick: StructuredPick = {
      id: generatePickId(row.teamCode, row.seasonYear, round, 'conditional'),
      year: row.seasonYear,
      round,
      status: 'conditional',
      originalTeam: row.teamCode,
      currentOwner: row.teamCode,
      stepienEligible: false,
      tradeable: false,
      protection: protection
        ? `top-${protection.split('-')[1]} protected`
        : null,
      isSwap: false,
      conditions: conditionalPicks,
      conditionalRecipient: recipientTeam,
      dependsOn: dependencies.length > 0 ? dependencies : undefined,
      detailUrl: row.detailUrl,
    };

    return [pick];
  }

  // Normal processing for non-conditional picks
  const parts = splitParts(cell);
  const items = parts.length ? parts : ['Own'];

  const out: StructuredPick[] = [];
  for (const part of items) {
    const status = detectStatus(part);
    const beginsWithTo = /^\s*to\s+/i.test(part);
    const via = beginsWithTo ? undefined : parseVia(part);
    const toTeam = parseTo(part);
    
    // NEW: Check for team code prefix (e.g., "PHL 5-30" means via PHL)
    const teamCodePrefix = parseTeamCodePrefix(part);

    const { protection, protectionDetails } = extractProtection(round, part);
    const swap = parseSwap(part, INTERNAL_TEAM_CODE_MAP);
    const cond = parseConditions(part);
    const route = parseRoute(part);

    let originalTeam = row.teamCode;
    let currentOwner = row.teamCode;

    // Handle different pick types
    if (via) {
      originalTeam = via;
    } else if (teamCodePrefix && status === 'incoming') {
      // Team code shorthand: "PHL 5-30" means pick originally from PHL
      originalTeam = teamCodePrefix;
    }
    
    if (status === 'outgoing' && toTeam) currentOwner = toTeam;
    if (status === 'incoming') currentOwner = row.teamCode;

    // Generate specific ID based on pick type
    let idSuffix = '';
    if (status === 'outgoing' && toTeam) {
      idSuffix = `to_${toTeam}`;
    } else if (status === 'incoming' && (via || teamCodePrefix)) {
      const sourceTeam = via || teamCodePrefix;
      idSuffix = `from_${sourceTeam}`;
    } else if (status === 'contested') {
      idSuffix = 'contested';
    } else if (swap.isSwap) {
      idSuffix = 'swap';
    } else if (protection) {
      idSuffix = 'protected';
    }

    // Parse conveyance obligations for trading restrictions
    const conveyanceObligation = parseConveyanceObligation(
      part,
      row.teamCode,
      row.seasonYear,
      round
    );
    const dependencies = extractPickDependencies(part);
    
    // Use originalTeam for ID generation to ensure unique IDs for incoming picks
    const idBaseTeam = status === 'incoming' && originalTeam !== row.teamCode 
      ? originalTeam 
      : row.teamCode;

    const pick: StructuredPick = {
      id: generatePickId(idBaseTeam, row.seasonYear, round, idSuffix),
      year: row.seasonYear,
      round,
      status,
      originalTeam,
      currentOwner,
      stepienEligible: determineStepienEligibility(
        status,
        protection,
        false,
        round
      ),
      tradeable: !protection && status !== 'outgoing',
      protection,
      isSwap: swap.isSwap,
      via: via || (teamCodePrefix && status === 'incoming' ? teamCodePrefix : undefined),
      recipient: toTeam,
      pickNumber: null,
      protectionDetails,
      swapDetails: swap.details,
      conveysIf: cond.conveysIf,
      otherwise: cond.otherwise,
      route,
      conveyanceObligation, // Simplified obligation for Stepien compliance
      dependsOn: dependencies.length > 0 ? dependencies : undefined,
      detailUrl: row.detailUrl,
    };

    // Adjust status and ownership based on additional context
    if (toTeam && status !== 'incoming') {
      pick.status = 'outgoing';
      // FIX: For outgoing picks, the current owner should be the recipient team
      if (!swap.isSwap && !protection) {
        pick.currentOwner = toTeam; // Unprotected outgoing picks belong to recipient
      }
    }
    if (
      /(most|least)\s+favorable/i.test(part) ||
      /more|less favorable/i.test(part)
    )
      pick.status = 'contested';

    out.push(pick);
  }
  return out;
}

// ---------- Per-team page scraper (text-section parser) ----------
async function fetchTeamHtml(url: string) {
  return got(url, { timeout: { request: 20000 } }).text();
}

/** Get all text lines in a section until the next h2/h3 (or end). */
function collectSectionLines($: cheerio.CheerioAPI, headerEl: cheerio.Element) {
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

async function scrapeTeamPage(teamCode: string, teamName: string, url: string) {
  const html = await fetchTeamHtml(url);
  const $ = cheerio.load(html);

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

  if (!firstHeader || !secondHeader) {
    console.warn(
      `⚠️ Could not find expected headers for ${teamCode} — page layout may have changed.`
    );
    console.warn(
      `   Expected: "Future 1st Round Picks" and "Future 2nd Round Picks"`
    );
  }

  // Instead of looking for text sections, look for tables
  const firstTable = firstHeader ? $(firstHeader).next('table') : $();
  const secondTable = secondHeader ? $(secondHeader).next('table') : $();

  console.log(`   • First table found: ${firstTable.length > 0}`);
  console.log(`   • Second table found: ${secondTable.length > 0}`);

  // Parse table rows instead of text lines
  const firstRows = parseTableRows($, firstTable);
  const secondRows = parseTableRows($, secondTable);

  console.log(`   • First round picks: ${firstRows.length}`);
  console.log(`   • Second round picks: ${secondRows.length}`);

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

/** Parse table rows to extract year and pick description */
function parseTableRows(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<cheerio.Element>
) {
  const rows: Array<{ year: number; text: string }> = [];

  if (table.length === 0) return rows;

  table.find('tbody tr').each((_, row) => {
    const $row = $(row);
    const yearCell = $row.find('td').first();
    const pickCell = $row.find('td').last();

    const yearText = yearCell.text().trim();
    const pickText = stripTags(pickCell.html() || '');

    const year = parseInt(yearText, 10);
    if (Number.isFinite(year) && pickText) {
      rows.push({ year, text: cleanCell(pickText) });
    }
  });

  return rows;
}

// ---------- Writers ----------
async function writeCombinedRaw(allRows: RawRow[]) {
  await ensureDir(OUT_DIR);
  const p = path.join(OUT_DIR, 'draft_picks_raw.json');
  await fs.writeFile(p, serialize(allRows), 'utf8');
  return p;
}

async function writeCombinedStructured(all: StructuredPick[]) {
  await ensureDir(OUT_DIR);
  const p = path.join(OUT_DIR, 'draft_picks_structured.json');
  await fs.writeFile(p, serialize(all), 'utf8');
  return p;
}

// NEW: Reorganize picks by current owner for team data integration
function reorganizePicksByCurrentOwner(
  allPicks: StructuredPick[]
): Record<string, StructuredPick[]> {
  const byCurrentOwner: Record<string, StructuredPick[]> = {};

  for (const pick of allPicks) {
    const owner = pick.currentOwner;

    if (!byCurrentOwner[owner]) {
      byCurrentOwner[owner] = [];
    }

    // Add metadata about the pick's journey and source
    const enrichedPick: StructuredPick = {
      ...pick,
      // Add metadata for architect integration
      metadata: {
        sourcePage: pick.originalTeam, // Which team's RealGM page this came from
        tradePath: pick.route || [], // Trading path if available
        scrapedFrom: pick.detailUrl, // Original URL source
        hasComplexRouting: !!pick.route && pick.route.length > 0,
        isFromOriginalTeam: pick.originalTeam === pick.currentOwner,
        pickJourney: {
          startedWith: pick.originalTeam,
          routedThrough: pick.via ? [pick.via] : [],
          currentlyWith: pick.currentOwner,
          finalDestination: pick.recipient || pick.currentOwner,
        },
      },
    };

    byCurrentOwner[owner].push(enrichedPick);
  }

  // Sort picks within each team by year and round
  for (const teamCode in byCurrentOwner) {
    byCurrentOwner[teamCode].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.round - b.round;
    });
  }

  return byCurrentOwner;
}

async function writePicksByCurrentOwner(
  picksByOwner: Record<string, StructuredPick[]>
) {
  await ensureDir(OUT_DIR);
  const p = path.join(OUT_DIR, 'draft_picks_by_current_owner.json');
  await fs.writeFile(p, serialize(picksByOwner), 'utf8');
  return p;
}

async function writePerTeamByCurrentOwner(
  code: string,
  picks: StructuredPick[]
) {
  const dir = path.join(OUT_DIR, 'by_current_owner');
  await ensureDir(dir);
  const p = path.join(dir, `draft_picks_${code}.json`);
  await fs.writeFile(p, serialize(picks), 'utf8');
  return p;
}

async function writePerTeamRaw(code: string, rows: RawRow[]) {
  const dir = path.join(OUT_DIR, 'raw');
  await ensureDir(dir);
  const p = path.join(dir, `draft_picks_${code}.json`);
  await fs.writeFile(p, serialize(rows), 'utf8');
  return p;
}
async function writePerTeamStructured(code: string, picks: StructuredPick[]) {
  const dir = path.join(OUT_DIR, 'structured');
  await ensureDir(dir);
  const p = path.join(dir, `draft_picks_${code}.json`);
  await fs.writeFile(p, serialize(picks), 'utf8');
  return p;
}

// ---------- Main ----------
(async () => {
  try {
    console.log(
      `🔍 Scraping RealGM future drafts — Teams: ${TEAM_FILTER.join(', ')}`
    );

    const allRaw: RawRow[] = [];
    const allStructured: StructuredPick[] = [];

    for (const code of TEAM_FILTER) {
      const entry = REALGM_TEAM_URLS[code];
      if (!entry) {
        console.warn(`⚠️  No RealGM URL configured for ${code}. Skipping.`);
        continue;
      }
      console.log(`🌐 Fetching ${entry.name} (${code}) → ${entry.url}`);

      const rows = await scrapeTeamPage(entry.code, entry.name, entry.url);
      console.log(`   • Parsed ${rows.length} season rows`);

      // Per-team RAW
      await writePerTeamRaw(entry.code, rows);

      // Per-team STRUCTURED
      const teamStructured: StructuredPick[] = [];
      for (const r of rows) {
        teamStructured.push(...toStructured(r, 1));
        teamStructured.push(...toStructured(r, 2));
      }
      await writePerTeamStructured(entry.code, teamStructured);

      allRaw.push(...rows);
      allStructured.push(...teamStructured);
    }

    const rawPath = await writeCombinedRaw(allRaw);
    console.log(`📝 Wrote COMBINED RAW: ${rawPath}`);

    const structuredPath = await writeCombinedStructured(allStructured);
    console.log(
      `🧩 Wrote COMBINED STRUCTURED: ${structuredPath} (${allStructured.length} picks)`
    );

    // Reorganize picks by current owner and write to file
    const picksByOwner = reorganizePicksByCurrentOwner(allStructured);
    const byOwnerPath = await writePicksByCurrentOwner(picksByOwner);
    console.log(`📂 Wrote PICKS BY CURRENT OWNER: ${byOwnerPath}`);

    // Write individual team files organized by current owner
    for (const teamCode in picksByOwner) {
      await writePerTeamByCurrentOwner(teamCode, picksByOwner[teamCode]);
    }

    console.log(`📦 Per-team files saved under:`);
    console.log(`    ${path.resolve(path.join(OUT_DIR, 'raw'))}`);
    console.log(`    ${path.resolve(path.join(OUT_DIR, 'structured'))}`);
    console.log(`    ${path.resolve(path.join(OUT_DIR, 'by_current_owner'))}`);
    console.log('🎯 Done');
  } catch (err: any) {
    console.error('❌ Error:', err?.message || err);
    process.exit(1);
  }
})();
