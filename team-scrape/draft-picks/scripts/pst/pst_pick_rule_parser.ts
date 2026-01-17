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

  // Pattern 2: "protected 1-N" or "protected picks 1-N" or "1-N protected" or "protected 1-10"
  const rangePatterns = [
    /protected\s+(?:picks?\s+)?(\d+)\s*[-–]\s*(\d+)/gi,
    /protected\s+(?:picks?\s+)?(\d+)\s+(?:to|through)\s+(\d+)/gi,
    /(\d+)\s*[-–]\s*(\d+)\s+protected/gi,
    /(\d+)\s+(?:to|through)\s+(\d+)\s+protected/gi,
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
 */
function extractYearSpans(text: string, defaultYear: number): number[] {
  const years: number[] = [];

  // Pattern: "2026-27" or "2026-2027"
  const spanMatch = text.match(/\b(20[2-3]\d)[-–]((?:20)?[2-3]?\d)\b/);
  if (spanMatch) {
    const startYear = parseInt(spanMatch[1], 10);
    let endYearStr = spanMatch[2];

    // Handle "2026-27" format
    if (endYearStr.length === 2) {
      endYearStr = spanMatch[1].slice(0, 2) + endYearStr;
    }
    const endYear = parseInt(endYearStr, 10);

    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }
  }

  // Pattern: explicit year mentions
  const explicitYears = text.match(/\b20[2-3]\d\b/g);
  if (explicitYears) {
    for (const ys of explicitYears) {
      const y = parseInt(ys, 10);
      if (!years.includes(y)) {
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

  // Check for favorable pool ambiguity
  if (
    (lower.includes('favorable') && pool.length > 1) ||
    (lower.includes('favorable') && !mostLeast)
  ) {
    reviewReasons.push(REVIEW_REASONS.FAVORABLE_POOL_AMBIGUOUS);
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

  // Check for explicit fallback mentions
  const fallbackPatterns = [
    /(?:becomes|converts\s+to|turns\s+into)\s+(?:a\s+)?(\d{4})\s+(first|second|1st|2nd)\s+round/gi,
    /else\s+(?:receives?\s+)?(?:a\s+)?(\d{4})\s+(first|second|1st|2nd)\s+round/gi,
    /otherwise\s+(?:receives?\s+)?(?:a\s+)?(\d{4})\s+(first|second|1st|2nd)\s+round/gi,
  ];

  for (const pattern of fallbackPatterns) {
    const match = pattern.exec(text);
    if (match) {
      const fbYear = parseInt(match[1], 10);
      const fbRound = match[2].toLowerCase().startsWith('1') || match[2].toLowerCase() === 'first' ? '1st' : '2nd';
      fallbackDescription = match[0].trim();

      // Try to construct fallback pickId if we have team context
      if (detectedPickRefs.length > 0) {
        // Check if any detected pick ref matches the fallback year/round
        const matchingRef = detectedPickRefs.find((ref) =>
          ref.includes(`${fbYear}_${fbRound}`)
        );
        if (matchingRef) {
          fallbackPickId = matchingRef;
        }
      }
      break;
    }
  }

  // Pattern 3: Look for "second round pick" fallback patterns
  if (!fallbackDescription && lower.includes('second round')) {
    const secondRoundMatch = text.match(/(?:becomes|converts)\s+(?:a\s+)?(?:\d{4}\s+)?second\s+round/i);
    if (secondRoundMatch) {
      fallbackDescription = secondRoundMatch[0].trim();
    }
  }

  // Build conveyance entry if we found relevant language
  if (ifNotConveyed || fallbackDescription) {
    // If we have fallback description but no explicit pickId, flag for review
    if (fallbackDescription && !fallbackPickId) {
      reviewReasons.push(REVIEW_REASONS.FALLBACK_UNRESOLVED);
    }

    conveyance.push({
      ifNotConveyed,
      trigger: trigger || 'condition',
      fallbackPickId,
      fallbackDescription,
      evidenceRowRefs: [rowRef],
    });
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
  rowRef: string
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

  if (!reason || reason === 'unknown') {
    reviewReasons.push(REVIEW_REASONS.CONDITION_NOT_EXTRACTABLE);
  }

  didNotConvey.push({
    reason: reason || 'condition not met',
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
      return match[0].trim().slice(0, 100);
    }
  }

  // Return the whole text snippet if short enough
  if (text.length < 100) {
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
        normalizedTextSnippet: text.slice(0, 200),
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
        const { didNotConvey, reviewReasons } = parseDidNotConvey(
          row.rowKind,
          text,
          rowRef
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
