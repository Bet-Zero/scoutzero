#!/usr/bin/env tsx
/**
 * pst_pick_rule_parser.ts
 *
 * Phase 4: Deterministic Pick Rule Parser
 *
 * Parses normalized PST rows into structured PickRuleProfiles with:
 * - Protections (top-N, range, lottery)
 * - Swaps (right to swap, option to swap)
 * - Conveyance/fallback chains
 * - Did-not-convey states
 *
 * All parsing is deterministic and rule-based (regex + small grammar).
 * No LLM, no probabilistic inference.
 */

import { ALL_TEAM_CODES, PST_LABEL_TO_CODE } from './pst_team_slugs';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum length for evidence text snippets */
const MAX_SNIPPET_LENGTH = 200;

/** Maximum length for reason text truncation */
const MAX_REASON_LENGTH = 100;

/** Valid year range for NBA draft picks (2020-2039) */
const MIN_VALID_YEAR = 2020;
const MAX_VALID_YEAR = 2039;

// ============================================================================
// TYPES
// ============================================================================

export type TeamCode = string;

export interface Protection {
  type: 'top_n' | 'range' | 'lottery' | 'unknown';
  protectedRange?: { start: number; end: number };
  description: string;
  appliesToYears: number[];
  protectorTeam?: TeamCode;
  beneficiaryTeam?: TeamCode;
  evidenceRowRefs: string[];
}

export interface Swap {
  controller: TeamCode;
  pool: TeamCode[];
  year: number;
  round: 1 | 2;
  direction: 'swap_right';
  mostLeast?: 'most_favorable' | 'least_favorable' | null;
  description: string;
  evidenceRowRefs: string[];
}

export interface Conveyance {
  ifNotConveyed: boolean;
  trigger: string;
  fallbackPickId?: string;
  fallbackDescription?: string;
  evidenceRowRefs: string[];
}

export interface DidNotConvey {
  reason: string;
  evidenceRowRefs: string[];
}

export interface Mentions {
  referencedPickIds: string[];
  referencedTeams: TeamCode[];
  referencedYears: number[];
}

export interface Evidence {
  rowRef: string;
  sourceTeamPage: string;
  sourceUrl: string;
  normalizedTextSnippet: string;
  rowKind: string;
}

/**
 * SelectionSpec: Structured representation of swap/conveyance selection logic.
 * 
 * Used for OutcomeSpec generation in manual check views.
 * Captures "most favorable of X, Y, Z" / "2nd least favorable of A, B, C" patterns.
 */
export interface SelectionSpec {
  /** 'swap' when controller picks from pool; 'conveys' for non-swap selection */
  kind: 'swap' | 'conveys';
  /** Controller team (required for swap, optional for conveys) */
  controller?: TeamCode;
  /** Selection order: 'most' or 'least' favorable */
  order: 'most' | 'least';
  /** Rank: 1 for most/least, 2 for 2nd most/least, etc. */
  rank: number;
  /** Pool of teams involved (sorted alphabetically) */
  pool: TeamCode[];
  /** Year the selection applies to */
  year: number;
  /** Round (1 or 2) */
  round: 1 | 2;
  /** Evidence row references */
  evidenceRowRefs: string[];
  /** Short description of matched phrase */
  description: string;
}

export interface PickRuleProfile {
  pickId: string;
  year: number;
  round: 1 | 2;
  originalTeam: TeamCode;
  displayOwner: TeamCode;
  protections: Protection[];
  swaps: Swap[];
  conveyance: Conveyance[];
  didNotConvey: DidNotConvey[];
  selectionSpecs: SelectionSpec[];
  mentions: Mentions;
  needs_review: boolean;
  reviewReasons: string[];
  evidence: Evidence[];
}

export interface PickRuleProfilesMeta {
  years: number[];
  generatedAt: string;
  totalPicks: number;
  needsReviewCount: number;
}

export interface PickRuleProfilesOutput {
  meta: PickRuleProfilesMeta;
  profiles: Record<string, PickRuleProfile>;
}

export interface NeedsReviewItem {
  pickId: string;
  reviewReasons: string[];
  evidenceRowRefs: string[];
}

export interface NeedsReviewQueue {
  generatedAt: string;
  needsReviewCount: number;
  items: NeedsReviewItem[];
}

export interface Phase4Report {
  generatedAt: string;
  counts: {
    totalPicks: number;
    protectionsExtracted: number;
    swapsExtracted: number;
    conveyanceExtracted: number;
    didNotConveyExtracted: number;
    needsReviewCount: number;
  };
  topReviewReasons: Array<{ reason: string; count: number }>;
  topPicksByEncumbrances: Array<{ pickId: string; count: number }>;
  sampleProfiles: PickRuleProfile[];
}

// Input types from Phase 3
export interface NormalizedRow {
  pickId: string;
  year: number;
  round: 1 | 2;
  roundSuffix: '1st' | '2nd';
  originalTeam: string;
  displayOwner: string;
  rowKind: string;
  rawText: string;
  normalizedText: string;
  textHash: string;
  detectedTeamCodes: string[];
  detectedYears: number[];
  detectedRounds: (1 | 2)[];
  detectedPickRefs: string[];
  flags: {
    mentionsSwap: boolean;
    mentionsProtection: boolean;
    mentionsConveyance: boolean;
    mentionsLeastMostFavorable: boolean;
    mentionsDidNotConvey: boolean;
    mentionsCash: boolean;
    mentionsRights: boolean;
  };
  provenance: {
    source: string;
    sourceUrl: string;
    sourceTeamPage: string;
    snapshotPath: string;
    rowRef: string;
  };
}

export interface BaseLedgerItem {
  pickId: string;
  originalTeam: string;
  year: number;
  round: 1 | 2;
  owner: string;
  ownershipSource?: 'BASE' | 'PST_DISPLAY';
  rowKind?: string;
  provenance?: {
    sourceTeamPage: string;
    sourceUrl: string;
    snapshotPath: string;
    rowRef: string;
  };
}

// ============================================================================
// REVIEW REASON CODES
// ============================================================================

export const REVIEW_REASONS = {
  PROTECTION_RANGE_AMBIGUOUS: 'PROTECTION_RANGE_AMBIGUOUS',
  PROTECTION_YEAR_AMBIGUOUS: 'PROTECTION_YEAR_AMBIGUOUS',
  SWAP_CONTROLLER_UNKNOWN: 'SWAP_CONTROLLER_UNKNOWN',
  SWAP_POOL_AMBIGUOUS: 'SWAP_POOL_AMBIGUOUS',
  FAVORABLE_POOL_AMBIGUOUS: 'FAVORABLE_POOL_AMBIGUOUS',
  FALLBACK_UNRESOLVED: 'FALLBACK_UNRESOLVED',
  CONDITION_NOT_EXTRACTABLE: 'CONDITION_NOT_EXTRACTABLE',
  MULTIPLE_CONFLICTING_CLAIMS: 'MULTIPLE_CONFLICTING_CLAIMS',
  UNKNOWN_TEAM_CODE: 'UNKNOWN_TEAM_CODE',
  COMPLEX_LANGUAGE: 'COMPLEX_LANGUAGE',
} as const;

// ============================================================================
// PROTECTION PARSING
// ============================================================================

/**
 * Parses protection phrases from normalized text.
 * Detects patterns like:
 * - "protected top 4" => range 1-4
 * - "top 3 protected" => range 1-3
 * - "lottery protected" => type lottery
 * - "protected 1-10" => range 1-10
 */
export function parseProtections(
  text: string,
  rowRef: string,
  year: number
): { protections: Protection[]; reviewReasons: string[] } {
  const protections: Protection[] = [];
  const reviewReasons: string[] = [];
  const lower = text.toLowerCase();

  // Pattern 1: "protected top N" or "top N protected" or "top-N protected"
  const topNPatterns = [
    /protected\s+top[\s-]?(\d+)/gi,
    /top[\s-]?(\d+)\s+protected/gi,
    /top[\s-]?(\d+)\s+protection/gi,
  ];

  for (const pattern of topNPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const n = parseInt(match[1], 10);
      const description = match[0].trim();

      // Extract year spans if present (e.g., "in 2026-27")
      const appliesToYears = extractYearSpans(text, year);

      protections.push({
        type: 'top_n',
        protectedRange: { start: 1, end: n },
        description,
        appliesToYears: appliesToYears.length > 0 ? appliesToYears : [year],
        evidenceRowRefs: [rowRef],
      });
    }
  }

  // Pattern 2: "protected 1-N" or "protected picks 1-N" or "1-N protected" or "protected 1-10" or "protected #13-30"
  const rangePatterns = [
    /protected\s+(?:picks?\s+)?(\d+)\s*[-–]\s*(\d+)/gi,
    /protected\s+(?:picks?\s+)?(\d+)\s+(?:to|through)\s+(\d+)/gi,
    /(\d+)\s*[-–]\s*(\d+)\s+protected/gi,
    /(\d+)\s+(?:to|through)\s+(\d+)\s+protected/gi,
    // Handle "#13-30" notation: "protected #13-30" or "pick protected #1-10"
    /protected\s+#(\d+)\s*[-–]\s*(\d+)/gi,
    /#(\d+)\s*[-–]\s*(\d+)\s+protected/gi,
  ];

  for (const pattern of rangePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      const description = match[0].trim();

      const appliesToYears = extractYearSpans(text, year);

      protections.push({
        type: 'range',
        protectedRange: { start, end },
        description,
        appliesToYears: appliesToYears.length > 0 ? appliesToYears : [year],
        evidenceRowRefs: [rowRef],
      });
    }
  }

  // Pattern 3: "lottery protected"
  if (/lottery\s+protected/i.test(text) || /protected\s+(?:if\s+)?lottery/i.test(text)) {
    const match = text.match(/lottery\s+protected|protected\s+(?:if\s+)?lottery/i);
    const appliesToYears = extractYearSpans(text, year);

    protections.push({
      type: 'lottery',
      description: match ? match[0].trim() : 'lottery protected',
      appliesToYears: appliesToYears.length > 0 ? appliesToYears : [year],
      evidenceRowRefs: [rowRef],
    });
  }

  // Pattern 4: Generic "protected" without clear range
  if (
    lower.includes('protected') &&
    protections.length === 0 &&
    !lower.includes('unprotected')
  ) {
    // We detected protection language but couldn't parse the range
    reviewReasons.push(REVIEW_REASONS.PROTECTION_RANGE_AMBIGUOUS);
    protections.push({
      type: 'unknown',
      description: extractProtectionPhrase(text),
      appliesToYears: [year],
      evidenceRowRefs: [rowRef],
    });
  }

  return { protections, reviewReasons };
}

/**
 * Extract year spans from text like "in 2026-27" or "2026-2027"
 * Validates years are within reasonable NBA draft range (2020-2039)
 */
function extractYearSpans(text: string, defaultYear: number): number[] {
  const years: number[] = [];

  // Pattern: "2026-27" or "2026-2027" - uses strict 2-digit capture for short form
  const spanMatch = text.match(/\b(20[2-3]\d)[-–]((?:20[2-3]\d)|[2-3]\d)\b/);
  if (spanMatch) {
    const startYear = parseInt(spanMatch[1], 10);
    let endYearStr = spanMatch[2];

    // Handle "2026-27" format - derive century from start year
    if (endYearStr.length === 2) {
      const startCentury = Math.floor(startYear / 100) * 100;
      endYearStr = String(startCentury + parseInt(endYearStr, 10));
    }
    const endYear = parseInt(endYearStr, 10);

    // Validate years are in reasonable range and end >= start
    if (
      startYear >= MIN_VALID_YEAR &&
      startYear <= MAX_VALID_YEAR &&
      endYear >= MIN_VALID_YEAR &&
      endYear <= MAX_VALID_YEAR &&
      endYear >= startYear
    ) {
      for (let y = startYear; y <= endYear; y++) {
        years.push(y);
      }
    }
  }

  // Pattern: explicit year mentions
  const explicitYears = text.match(/\b20[2-3]\d\b/g);
  if (explicitYears) {
    for (const ys of explicitYears) {
      const y = parseInt(ys, 10);
      if (!years.includes(y) && y >= MIN_VALID_YEAR && y <= MAX_VALID_YEAR) {
        years.push(y);
      }
    }
  }

  return years.sort((a, b) => a - b);
}

/**
 * Extract a short protection phrase for description
 */
function extractProtectionPhrase(text: string): string {
  const match = text.match(/.{0,30}protect\w*.{0,30}/i);
  return match ? match[0].trim() : 'protected';
}

/**
 * Normalizes a round string to '1st' or '2nd'
 * @param roundStr - Round string like 'first', 'second', '1st', '2nd'
 * @returns Normalized round suffix '1st' or '2nd'
 */
function normalizeRoundString(roundStr: string): '1st' | '2nd' {
  const lower = roundStr.toLowerCase().trim();
  if (lower === 'first' || lower === '1st' || lower.startsWith('1')) {
    return '1st';
  }
  return '2nd';
}

// ============================================================================
// SWAP PARSING
// ============================================================================

/**
 * Parses swap rights from normalized text.
 * Detects patterns like:
 * - "option to swap"
 * - "right to swap"
 * - "swap ... first round picks"
 */
export function parseSwaps(
  text: string,
  rowRef: string,
  year: number,
  round: 1 | 2,
  detectedTeamCodes: string[]
): { swaps: Swap[]; reviewReasons: string[] } {
  const swaps: Swap[] = [];
  const reviewReasons: string[] = [];
  const lower = text.toLowerCase();

  // Check for swap-related language
  const hasSwapLanguage =
    lower.includes('swap') ||
    lower.includes('option to swap') ||
    lower.includes('right to swap');

  if (!hasSwapLanguage) {
    return { swaps, reviewReasons };
  }

  // Pattern 1: "[Team] has/have (the) option/right to swap" or "[Team] right to swap"
  const controllerPatterns = [
    /(\w+(?:\s+\w+)?)\s+(?:has|have)\s+(?:the\s+)?(?:option|right)\s+to\s+swap/gi,
    /(\w+(?:\s+\w+)?)\s+(?:option|right)\s+to\s+swap/gi,
    /(?:option|right)\s+to\s+swap\s+(?:with|for|picks?\s+with)\s+(\w+(?:\s+\w+)?)/gi,
    /(\w+(?:\s+\w+)?)\s+can\s+swap/gi,
  ];

  let controller: TeamCode | undefined;
  for (const pattern of controllerPatterns) {
    const match = pattern.exec(text);
    if (match) {
      const teamLabel = match[1].trim();
      const code = normalizeTeamLabel(teamLabel);
      if (code) {
        controller = code;
        break;
      }
    }
  }

  // Fallback: If we can't determine controller, use detected teams
  if (!controller && detectedTeamCodes.length > 0) {
    // Usually the first mentioned team in a swap context is the controller
    controller = detectedTeamCodes[0];
    reviewReasons.push(REVIEW_REASONS.SWAP_CONTROLLER_UNKNOWN);
  }

  if (!controller) {
    reviewReasons.push(REVIEW_REASONS.SWAP_CONTROLLER_UNKNOWN);
    return { swaps, reviewReasons };
  }

  // Determine swap pool (teams involved)
  const pool = detectedTeamCodes.filter((t) => t !== controller);
  if (pool.length === 0) {
    reviewReasons.push(REVIEW_REASONS.SWAP_POOL_AMBIGUOUS);
  }

  // Detect most/least favorable
  let mostLeast: 'most_favorable' | 'least_favorable' | null = null;
  if (lower.includes('most favorable') || lower.includes('more favorable')) {
    mostLeast = 'most_favorable';
  } else if (lower.includes('least favorable') || lower.includes('less favorable')) {
    mostLeast = 'least_favorable';
  }

  // Try to extract pool from "favorable of X, Y, Z picks" pattern
  const favorablePoolMatch = text.match(
    /\((?:most|least|more|less)\s+favorable\s+of\s+([^)]+)\s*picks?\)/i
  );
  if (favorablePoolMatch) {
    const poolText = favorablePoolMatch[1];
    // Extract team codes from comma-separated list
    const poolTeams = extractTeamCodesFromList(poolText);
    if (poolTeams.length > 0) {
      // Replace the pool with the explicitly extracted teams
      pool.length = 0;
      pool.push(...poolTeams);
    }
  }

  // Check for favorable pool ambiguity - only flag if:
  // 1. We have "favorable" in text but couldn't determine most vs least
  // 2. OR we have "favorable" but no pool could be extracted
  if (lower.includes('favorable')) {
    if (!mostLeast) {
      reviewReasons.push(REVIEW_REASONS.FAVORABLE_POOL_AMBIGUOUS);
    } else if (pool.length === 0) {
      reviewReasons.push(REVIEW_REASONS.FAVORABLE_POOL_AMBIGUOUS);
    }
    // Note: pool.length > 1 with mostLeast set is EXPECTED and NOT ambiguous
  }

  // Extract swap description
  const swapMatch = text.match(/.{0,50}swap.{0,50}/i);
  const description = swapMatch ? swapMatch[0].trim() : 'swap right';

  swaps.push({
    controller,
    pool,
    year,
    round,
    direction: 'swap_right',
    mostLeast,
    description,
    evidenceRowRefs: [rowRef],
  });

  return { swaps, reviewReasons };
}

/**
 * Normalize a team label to canonical code
 */
function normalizeTeamLabel(label: string): TeamCode | undefined {
  const trimmed = label.trim();

  // Check if already a code
  if (ALL_TEAM_CODES.includes(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }

  // Check the label map
  return PST_LABEL_TO_CODE[trimmed];
}

/**
 * Extract team codes from a comma-separated list like "Hawks, Spurs, Jazz"
 */
function extractTeamCodesFromList(text: string): TeamCode[] {
  const codes: TeamCode[] = [];
  // Split on commas and clean up each part
  const parts = text.split(/[,&]/).map((p) => p.trim());
  
  for (const part of parts) {
    // Try to normalize each part
    const code = normalizeTeamLabel(part);
    if (code && !codes.includes(code)) {
      codes.push(code);
    }
  }
  
  return codes;
}

// ============================================================================
// SELECTION SPEC PARSING (Phase 6.1)
// ============================================================================

/**
 * Rank word to number mapping
 */
const RANK_WORDS: Record<string, number> = {
  'first': 1,
  '1st': 1,
  'second': 2,
  '2nd': 2,
  'third': 3,
  '3rd': 3,
  'fourth': 4,
  '4th': 4,
  'fifth': 5,
  '5th': 5,
};

/**
 * Parse ranked favorable pool phrases from text.
 * 
 * Detects patterns like:
 * - "(most favorable of Bucks, Pelicans picks)"
 * - "(second most favorable of Blazers, Bucks, Celtics picks)"
 * - "(2nd least favorable of Clippers, Jazz, Rockets picks)"
 * - "(less favorable of Hawks, Spurs picks)"
 * 
 * @param text - Normalized text to parse
 * @returns Array of parsed favorable pool specs
 */
export function parseRankedFavorablePool(text: string): Array<{
  order: 'most' | 'least';
  rank: number;
  pool: TeamCode[];
  description: string;
}> {
  const results: Array<{
    order: 'most' | 'least';
    rank: number;
    pool: TeamCode[];
    description: string;
  }> = [];

  // Pattern: "(second most favorable of X, Y, Z picks)" or "(most favorable of X, Y picks)"
  // Captures: optional rank word, most/least/more/less, team list
  const favorablePattern = /\((?:(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th)\s+)?(most|least|more|less)\s+favorable\s+of\s+([^)]+?)\s*(?:picks?)?\)/gi;
  
  let match;
  while ((match = favorablePattern.exec(text)) !== null) {
    const rankWord = match[1]?.toLowerCase();
    const orderWord = match[2].toLowerCase();
    const poolText = match[3];
    
    // Determine rank (1 if not specified)
    const rank = rankWord ? (RANK_WORDS[rankWord] || 1) : 1;
    
    // Normalize order: "more" -> "most", "less" -> "least"
    const order: 'most' | 'least' = (orderWord === 'most' || orderWord === 'more') ? 'most' : 'least';
    
    // Extract team codes from pool text
    const pool = extractTeamCodesFromList(poolText);
    
    if (pool.length > 0) {
      results.push({
        order,
        rank,
        pool: pool.sort(), // Sort alphabetically
        description: match[0].trim(),
      });
    }
  }
  
  return results;
}

/**
 * Parse "better of" / "worse of" language from text.
 * 
 * Detects patterns like:
 * - "better of DEN and OKC picks"
 * - "worse of ATL and SAS"
 * - "more favorable of (a) X and (b) Y"
 * 
 * Note: This pattern is less common in PST data but appears in Spotrac/Fanspo.
 * 
 * @param text - Normalized text to parse
 * @returns Array of parsed better-of specs
 */
export function parseBetterOf(text: string): Array<{
  order: 'most' | 'least';
  rank: number;
  pool: TeamCode[];
  description: string;
}> {
  const results: Array<{
    order: 'most' | 'least';
    rank: number;
    pool: TeamCode[];
    description: string;
  }> = [];

  // Pattern: "better/worse of X and Y" or "better/worse of X, Y"
  const betterOfPattern = /\b(better|worse)\s+of\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:and|,)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/gi;
  
  let match;
  while ((match = betterOfPattern.exec(text)) !== null) {
    const betterWorse = match[1].toLowerCase();
    const team1Text = match[2].trim();
    const team2Text = match[3].trim();
    
    const order: 'most' | 'least' = betterWorse === 'better' ? 'most' : 'least';
    
    const team1 = normalizeTeamLabel(team1Text);
    const team2 = normalizeTeamLabel(team2Text);
    
    if (team1 && team2) {
      results.push({
        order,
        rank: 1,
        pool: [team1, team2].sort(),
        description: match[0].trim(),
      });
    }
  }
  
  return results;
}

/**
 * Dedupe and sort a pool array.
 */
function dedupePool(pool: TeamCode[]): TeamCode[] {
  return [...new Set(pool)].sort();
}

/**
 * Build SelectionSpecs from a profile's existing swaps and parsed favorable pool data.
 * 
 * This combines:
 * 1. Existing swap data (controller, pool, mostLeast)
 * 2. Newly parsed ranked favorable pool specs (only for rank > 1)
 * 
 * Strategy: Prefer existing swap specs (rank 1). Only add parsed specs if they
 * have rank > 1 (e.g., "2nd most favorable") since those can't be derived from swaps.
 * 
 * @param profile - The pick rule profile being built
 * @param evidenceTexts - Array of {text, rowRef} from evidence
 * @returns Array of SelectionSpecs
 */
export function buildSelectionSpecs(
  profile: Pick<PickRuleProfile, 'swaps' | 'year' | 'round'>,
  evidenceTexts: Array<{ text: string; rowRef: string }>
): SelectionSpec[] {
  const specs: SelectionSpec[] = [];
  const seenKeys = new Set<string>();
  
  // Helper to dedupe by key (normalized: controller + order + rank + sorted pool)
  const addSpec = (spec: SelectionSpec) => {
    // Normalize pool for comparison
    const normalizedPool = dedupePool(spec.pool).join(',');
    const key = `${spec.kind}-${spec.controller || ''}-${spec.order}-${spec.rank}-${normalizedPool}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      specs.push({
        ...spec,
        pool: dedupePool(spec.pool), // Ensure deduped pool in output
      });
    }
  };
  
  // 1. Convert existing swaps to SelectionSpecs (rank 1 only)
  for (const swap of profile.swaps) {
    // Only create spec if we have mostLeast (favorable language)
    if (swap.mostLeast) {
      const order: 'most' | 'least' = swap.mostLeast === 'most_favorable' ? 'most' : 'least';
      
      // Build pool: include controller + swap.pool, deduped
      const poolWithController = swap.controller 
        ? [swap.controller, ...swap.pool]
        : swap.pool;
      
      addSpec({
        kind: 'swap',
        controller: swap.controller,
        order,
        rank: 1,
        pool: poolWithController,
        year: swap.year,
        round: swap.round,
        evidenceRowRefs: swap.evidenceRowRefs,
        description: swap.description.slice(0, 80),
      });
    }
  }
  
  // 2. Parse evidence texts ONLY for ranked specs (rank > 1)
  // These can't be derived from existing swaps
  for (const { text, rowRef } of evidenceTexts) {
    const rankedSpecs = parseRankedFavorablePool(text);
    for (const spec of rankedSpecs) {
      // Only add if rank > 1 (ranked specs like "2nd most favorable")
      if (spec.rank > 1) {
        // Determine if this is a swap (has controller) or conveys
        const isSwap = text.toLowerCase().includes('swap') || text.toLowerCase().includes('option to swap');
        
        // Try to find controller from existing swaps with overlapping pool
        let controller: TeamCode | undefined;
        if (isSwap) {
          for (const swap of profile.swaps) {
            const poolOverlap = swap.pool.some(t => spec.pool.includes(t));
            if (poolOverlap) {
              controller = swap.controller;
              break;
            }
          }
          // Fallback: first team in pool if swap context detected
          if (!controller && spec.pool.length > 0) {
            controller = spec.pool[0];
          }
        }
        
        addSpec({
          kind: isSwap ? 'swap' : 'conveys',
          controller,
          order: spec.order,
          rank: spec.rank,
          pool: spec.pool,
          year: profile.year,
          round: profile.round,
          evidenceRowRefs: [rowRef],
          description: spec.description,
        });
      }
    }
    
    // Parse better-of patterns (these are always rank 1, but only if no swap spec exists)
    const betterOfSpecs = parseBetterOf(text);
    for (const spec of betterOfSpecs) {
      const isSwap = text.toLowerCase().includes('swap');
      
      // Only add if we don't already have a swap spec for this pool
      const existingSwapSpec = specs.find(s => 
        s.kind === 'swap' && 
        s.order === spec.order &&
        s.rank === spec.rank &&
        dedupePool(s.pool).join(',') === dedupePool(spec.pool).join(',')
      );
      
      if (!existingSwapSpec) {
        addSpec({
          kind: isSwap ? 'swap' : 'conveys',
          controller: isSwap ? spec.pool[0] : undefined,
          order: spec.order,
          rank: spec.rank,
          pool: spec.pool,
          year: profile.year,
          round: profile.round,
          evidenceRowRefs: [rowRef],
          description: spec.description,
        });
      }
    }
  }
  
  return specs;
}

// ============================================================================
// CONVEYANCE PARSING
// ============================================================================

/**
 * Parses conveyance/fallback language from normalized text.
 * Detects patterns like:
 * - "if not conveyed"
 * - "else" clauses
 * - fallback pick references
 */
export function parseConveyance(
  text: string,
  rowRef: string,
  year: number,
  detectedPickRefs: string[]
): { conveyance: Conveyance[]; reviewReasons: string[] } {
  const conveyance: Conveyance[] = [];
  const reviewReasons: string[] = [];
  const lower = text.toLowerCase();

  // Check for conveyance language
  const hasConveyanceLanguage =
    lower.includes('convey') ||
    lower.includes('if not') ||
    lower.includes('else ') ||
    lower.includes('otherwise') ||
    lower.includes('becomes ') ||
    lower.includes('converts to');

  if (!hasConveyanceLanguage) {
    return { conveyance, reviewReasons };
  }

  // Pattern 1: "if not conveyed" or "if pick does not convey"
  const ifNotConveyedPatterns = [
    /if\s+(?:the\s+)?(?:pick\s+)?(?:does\s+)?not\s+convey/gi,
    /if\s+(?:it\s+)?(?:does\s+)?not\s+convey/gi,
    /if\s+protection\s+(?:is\s+)?not\s+met/gi,
  ];

  let ifNotConveyed = false;
  let trigger = '';
  for (const pattern of ifNotConveyedPatterns) {
    const match = pattern.exec(text);
    if (match) {
      ifNotConveyed = true;
      trigger = match[0].trim();
      break;
    }
  }

  // Pattern 2: Look for fallback description
  let fallbackDescription: string | undefined;
  let fallbackPickId: string | undefined;

  // Check for explicit fallback mentions with optional team attribution
  // Pattern: "else 2026 second round pick" or "else 2026 second round pick (Jazz pick)"
  const fallbackPatterns = [
    /(?:becomes|converts\s+to|turns\s+into)\s+(?:a\s+)?(\d{4})\s+(first|second|1st|2nd)\s+round\s+pick(?:\s*\(([^)]+?)(?:\s+pick)?\))?/gi,
    /else\s+(?:receives?\s+)?(?:a\s+)?(\d{4})\s+(first|second|1st|2nd)\s+round\s+pick(?:\s*\(([^)]+?)(?:\s+pick)?\))?/gi,
    /otherwise\s+(?:receives?\s+)?(?:a\s+)?(\d{4})\s+(first|second|1st|2nd)\s+round\s+pick(?:\s*\(([^)]+?)(?:\s+pick)?\))?/gi,
  ];

  for (const pattern of fallbackPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fbYear = parseInt(match[1], 10);
      const fbRound = normalizeRoundString(match[2]);
      const teamHint = match[3]; // e.g., "Jazz" from "(Jazz pick)"
      
      fallbackDescription = match[0].trim();

      // Try to determine the team for the fallback pick
      let fallbackTeam: TeamCode | undefined;
      
      // First try: explicit team hint in parentheses
      if (teamHint) {
        const hintCode = normalizeTeamLabel(teamHint.trim());
        if (hintCode) {
          fallbackTeam = hintCode;
        }
      }
      
      // Second try: check detected pick refs for matching year/round
      if (!fallbackTeam && detectedPickRefs.length > 0) {
        const matchingRef = detectedPickRefs.find((ref) =>
          ref.includes(`${fbYear}_${fbRound}`)
        );
        if (matchingRef) {
          fallbackPickId = matchingRef;
          fallbackTeam = matchingRef.split('_')[0];
        }
      }
      
      // Construct fallbackPickId if we have team
      if (fallbackTeam && !fallbackPickId) {
        fallbackPickId = `${fallbackTeam}_${fbYear}_${fbRound}`;
      }
      
      // Add conveyance entry for this fallback
      if (fallbackDescription) {
        conveyance.push({
          ifNotConveyed: ifNotConveyed || true,
          trigger: trigger || 'else clause',
          fallbackPickId,
          fallbackDescription,
          evidenceRowRefs: [rowRef],
        });
      }
    }
  }
  
  // Reset pattern lastIndex for potential multiple matches
  fallbackPatterns.forEach(p => p.lastIndex = 0);

  // Pattern 3: Look for "second round pick" fallback patterns (generic, no year)
  if (conveyance.length === 0 && lower.includes('second round')) {
    const secondRoundMatch = text.match(/(?:becomes|converts)\s+(?:a\s+)?(?:\d{4}\s+)?second\s+round/i);
    if (secondRoundMatch) {
      conveyance.push({
        ifNotConveyed: ifNotConveyed || true,
        trigger: trigger || 'condition',
        fallbackPickId: undefined,
        fallbackDescription: secondRoundMatch[0].trim(),
        evidenceRowRefs: [rowRef],
      });
    }
  }

  // Build conveyance entry if we found "if not conveyed" language but no fallback yet
  if (conveyance.length === 0 && ifNotConveyed) {
    conveyance.push({
      ifNotConveyed,
      trigger: trigger || 'condition',
      fallbackPickId: undefined,
      fallbackDescription: undefined,
      evidenceRowRefs: [rowRef],
    });
  }

  // Flag for review only if we have conveyance with fallbackDescription but no pickId
  for (const c of conveyance) {
    if (c.fallbackDescription && !c.fallbackPickId) {
      reviewReasons.push(REVIEW_REASONS.FALLBACK_UNRESOLVED);
      break; // Only add once
    }
  }

  return { conveyance, reviewReasons };
}

// ============================================================================
// DID NOT CONVEY PARSING
// ============================================================================

/**
 * Parses "did not convey" states from normalized text.
 * Primarily used when rowKind is 'condition_not_met'.
 */
export function parseDidNotConvey(
  rowKind: string,
  text: string,
  rowRef: string,
  hasProtections: boolean = false
): { didNotConvey: DidNotConvey[]; reviewReasons: string[] } {
  const didNotConvey: DidNotConvey[] = [];
  const reviewReasons: string[] = [];
  const lower = text.toLowerCase();

  // Only process if rowKind indicates condition not met
  if (rowKind !== 'condition_not_met') {
    // Also check for explicit language
    if (
      lower.includes('did not convey') ||
      lower.includes('not conveyed') ||
      lower.includes('protection exercised')
    ) {
      const reason = extractDidNotConveyReason(text);
      didNotConvey.push({
        reason,
        evidenceRowRefs: [rowRef],
      });
    }
    return { didNotConvey, reviewReasons };
  }

  // Extract reason from condition_not_met rows
  const reason = extractDidNotConveyReason(text);

  // Only flag CONDITION_NOT_EXTRACTABLE if:
  // 1. Reason is unknown AND
  // 2. We don't have protection info that would explain the non-conveyance
  // If we have protections, "unknown" reason is acceptable (pick fell in protection)
  if (!reason || reason === 'unknown') {
    if (!hasProtections) {
      // Still don't flag - condition_not_met with no explicit reason
      // is acceptable; it just means the pick didn't convey
      // The "unknown" reason is informative enough
    }
  }

  didNotConvey.push({
    reason: reason || 'protection not met',
    evidenceRowRefs: [rowRef],
  });

  return { didNotConvey, reviewReasons };
}

/**
 * Extract the reason for not conveying from text
 */
function extractDidNotConveyReason(text: string): string {
  // Look for .conditionnotmet class content patterns
  const patterns = [
    /did\s+not\s+convey\s*[-–:]\s*(.{10,60})/i,
    /not\s+conveyed\s*[-–:]\s*(.{10,60})/i,
    /protection\s+exercised\s*[-–:]\s*(.{10,60})/i,
    /fell\s+in\s+(.{10,40})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim().slice(0, MAX_REASON_LENGTH);
    }
  }

  // Return the whole text snippet if short enough
  if (text.length < MAX_REASON_LENGTH) {
    return text.trim();
  }

  return 'unknown';
}

// ============================================================================
// MAIN BUILDER FUNCTION
// ============================================================================

/**
 * Builds complete PickRuleProfiles from normalized rows and base ledger.
 *
 * @param normalizedRows - Phase 3 output: feature-enriched rows
 * @param baseLedger - Phase 2.1 output: 480-pick display owner ledger
 * @returns profiles, needsReviewQueue, and report
 */
export function buildPickRuleProfiles(
  normalizedRows: NormalizedRow[],
  baseLedger: BaseLedgerItem[]
): {
  profiles: PickRuleProfilesOutput;
  needsReviewQueue: NeedsReviewQueue;
  report: Phase4Report;
} {
  const generatedAt = new Date().toISOString();
  const profiles: Record<string, PickRuleProfile> = {};
  const needsReviewItems: NeedsReviewItem[] = [];

  // Create a map of pickId -> base ledger item for quick lookup
  const baseLedgerMap = new Map<string, BaseLedgerItem>();
  for (const item of baseLedger) {
    baseLedgerMap.set(item.pickId, item);
  }

  // Group normalized rows by pickId
  const rowsByPickId = new Map<string, NormalizedRow[]>();
  for (const row of normalizedRows) {
    const existing = rowsByPickId.get(row.pickId) || [];
    existing.push(row);
    rowsByPickId.set(row.pickId, existing);
  }

  // Stats for report
  let protectionsExtracted = 0;
  let swapsExtracted = 0;
  let conveyanceExtracted = 0;
  let didNotConveyExtracted = 0;
  const reviewReasonCounts = new Map<string, number>();

  // Process each base ledger pick to create a profile
  for (const basePick of baseLedger) {
    const { pickId, originalTeam, year, round, owner } = basePick;
    const rows = rowsByPickId.get(pickId) || [];

    // Initialize profile
    const profile: PickRuleProfile = {
      pickId,
      year,
      round,
      originalTeam,
      displayOwner: owner,
      protections: [],
      swaps: [],
      conveyance: [],
      didNotConvey: [],
      selectionSpecs: [],
      mentions: {
        referencedPickIds: [],
        referencedTeams: [],
        referencedYears: [],
      },
      needs_review: false,
      reviewReasons: [],
      evidence: [],
    };

    // Collect all review reasons
    const allReviewReasons: string[] = [];

    // Process each row for this pickId
    for (const row of rows) {
      const rowRef = row.provenance.rowRef;
      const text = row.normalizedText;

      // Add evidence
      profile.evidence.push({
        rowRef,
        sourceTeamPage: row.provenance.sourceTeamPage,
        sourceUrl: row.provenance.sourceUrl,
        normalizedTextSnippet: text.slice(0, MAX_SNIPPET_LENGTH),
        rowKind: row.rowKind,
      });

      // Skip empty text (own picks)
      if (!text || text.trim().length === 0) {
        continue;
      }

      // Parse protections
      if (row.flags.mentionsProtection) {
        const { protections, reviewReasons } = parseProtections(text, rowRef, year);
        for (const p of protections) {
          // Dedupe by description + year
          const key = `${p.description}-${p.appliesToYears.join(',')}`;
          const exists = profile.protections.some(
            (existing) => `${existing.description}-${existing.appliesToYears.join(',')}` === key
          );
          if (!exists) {
            profile.protections.push(p);
            protectionsExtracted++;
          }
        }
        allReviewReasons.push(...reviewReasons);
      }

      // Parse swaps
      if (row.flags.mentionsSwap) {
        const { swaps, reviewReasons } = parseSwaps(
          text,
          rowRef,
          year,
          round,
          row.detectedTeamCodes
        );
        for (const s of swaps) {
          // Dedupe by controller + pool + year
          const key = `${s.controller}-${s.pool.join(',')}-${s.year}`;
          const exists = profile.swaps.some(
            (existing) => `${existing.controller}-${existing.pool.join(',')}-${existing.year}` === key
          );
          if (!exists) {
            profile.swaps.push(s);
            swapsExtracted++;
          }
        }
        allReviewReasons.push(...reviewReasons);
      }

      // Parse conveyance
      if (row.flags.mentionsConveyance) {
        const { conveyance, reviewReasons } = parseConveyance(
          text,
          rowRef,
          year,
          row.detectedPickRefs
        );
        for (const c of conveyance) {
          // Dedupe by trigger + fallbackDescription
          const key = `${c.trigger}-${c.fallbackDescription || ''}`;
          const exists = profile.conveyance.some(
            (existing) => `${existing.trigger}-${existing.fallbackDescription || ''}` === key
          );
          if (!exists) {
            profile.conveyance.push(c);
            conveyanceExtracted++;
          }
        }
        allReviewReasons.push(...reviewReasons);
      }

      // Parse did not convey
      if (row.rowKind === 'condition_not_met' || row.flags.mentionsDidNotConvey) {
        const hasProtections = profile.protections.length > 0;
        const { didNotConvey, reviewReasons } = parseDidNotConvey(
          row.rowKind,
          text,
          rowRef,
          hasProtections
        );
        for (const d of didNotConvey) {
          // Dedupe by reason
          const exists = profile.didNotConvey.some(
            (existing) => existing.reason === d.reason
          );
          if (!exists) {
            profile.didNotConvey.push(d);
            didNotConveyExtracted++;
          }
        }
        allReviewReasons.push(...reviewReasons);
      }

      // Aggregate mentions
      for (const teamCode of row.detectedTeamCodes) {
        if (!profile.mentions.referencedTeams.includes(teamCode)) {
          profile.mentions.referencedTeams.push(teamCode);
        }
      }
      for (const y of row.detectedYears) {
        if (!profile.mentions.referencedYears.includes(y)) {
          profile.mentions.referencedYears.push(y);
        }
      }
      for (const pickRef of row.detectedPickRefs) {
        if (!profile.mentions.referencedPickIds.includes(pickRef)) {
          profile.mentions.referencedPickIds.push(pickRef);
        }
      }
    }

    // Build SelectionSpecs from swaps and evidence texts (Phase 6.1)
    const evidenceTexts = rows
      .filter(r => r.normalizedText && r.normalizedText.trim().length > 0)
      .map(r => ({ text: r.normalizedText, rowRef: r.provenance.rowRef }));
    
    profile.selectionSpecs = buildSelectionSpecs(profile, evidenceTexts);

    // Validate team codes in extracted data
    for (const swap of profile.swaps) {
      if (!ALL_TEAM_CODES.includes(swap.controller)) {
        allReviewReasons.push(REVIEW_REASONS.UNKNOWN_TEAM_CODE);
      }
      for (const poolTeam of swap.pool) {
        if (!ALL_TEAM_CODES.includes(poolTeam)) {
          allReviewReasons.push(REVIEW_REASONS.UNKNOWN_TEAM_CODE);
        }
      }
    }

    // Dedupe review reasons
    const uniqueReasons = [...new Set(allReviewReasons)];
    profile.reviewReasons = uniqueReasons;
    profile.needs_review = uniqueReasons.length > 0;

    // Count review reasons for report
    for (const reason of uniqueReasons) {
      reviewReasonCounts.set(reason, (reviewReasonCounts.get(reason) || 0) + 1);
    }

    // Add to needs review queue if needed
    if (profile.needs_review) {
      needsReviewItems.push({
        pickId,
        reviewReasons: profile.reviewReasons,
        evidenceRowRefs: profile.evidence.map((e) => e.rowRef),
      });
    }

    profiles[pickId] = profile;
  }

  // Sort mentions arrays
  for (const profile of Object.values(profiles)) {
    profile.mentions.referencedTeams.sort();
    profile.mentions.referencedYears.sort((a, b) => a - b);
    profile.mentions.referencedPickIds.sort();
  }

  // Build outputs
  const years = [...new Set(baseLedger.map((p) => p.year))].sort((a, b) => a - b);

  const profilesOutput: PickRuleProfilesOutput = {
    meta: {
      years,
      generatedAt,
      totalPicks: Object.keys(profiles).length,
      needsReviewCount: needsReviewItems.length,
    },
    profiles,
  };

  const needsReviewQueue: NeedsReviewQueue = {
    generatedAt,
    needsReviewCount: needsReviewItems.length,
    items: needsReviewItems,
  };

  // Build report
  const topReviewReasons = [...reviewReasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topPicksByEncumbrances = Object.values(profiles)
    .map((p) => ({
      pickId: p.pickId,
      count: p.protections.length + p.swaps.length + p.conveyance.length + p.didNotConvey.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Select sample profiles (including TOR and OKC picks)
  const sampleProfiles: PickRuleProfile[] = [];
  const torPick = Object.values(profiles).find(
    (p) => p.originalTeam === 'TOR' && p.protections.length > 0
  );
  const okcPick = Object.values(profiles).find(
    (p) => p.originalTeam === 'OKC' && p.swaps.length > 0
  );

  if (torPick) sampleProfiles.push(torPick);
  if (okcPick) sampleProfiles.push(okcPick);

  // Add more samples up to 10
  for (const p of Object.values(profiles)) {
    if (sampleProfiles.length >= 10) break;
    if (!sampleProfiles.includes(p) && (p.protections.length > 0 || p.swaps.length > 0)) {
      sampleProfiles.push(p);
    }
  }

  const report: Phase4Report = {
    generatedAt,
    counts: {
      totalPicks: Object.keys(profiles).length,
      protectionsExtracted,
      swapsExtracted,
      conveyanceExtracted,
      didNotConveyExtracted,
      needsReviewCount: needsReviewItems.length,
    },
    topReviewReasons,
    topPicksByEncumbrances,
    sampleProfiles,
  };

  return { profiles: profilesOutput, needsReviewQueue, report };
}
