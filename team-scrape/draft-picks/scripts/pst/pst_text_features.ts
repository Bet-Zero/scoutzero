
import { createHash } from 'crypto';
import { PST_LABEL_TO_CODE } from './pst_team_slugs';

/**
 * Text normalization and feature extraction for PST raw rows.
 * Phase 3: Feature Engineering (No Legal Interpretation)
 */

export interface PstTextFeatures {
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
}

// ============================================================================
// 1. Text Normalization
// ============================================================================

/**
 * Normalizes raw text sequences:
 * - Replace nbsp (\u00A0) with space
 * - Unify bullet points to '•'
 * - Collapse multiple spaces
 * - Trim whitespace
 */
export function normalizeText(rawText: string): string {
  if (!rawText) return '';

  return rawText
    .replace(/\u00A0/g, ' ') // Replace non-breaking space
    .replace(/[•●▪]/g, '•') // Unify bullets
    .replace(/\s+/g, ' ') // Collapse spaces
    .trim();
}

/**
 * Computes a stable SHA256 hash of the text
 */
export function computeTextHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

// ============================================================================
// 2. Entity Extraction
// ============================================================================

// Compile regexes for teams from PST_LABEL_TO_CODE
// Sort by length formatting descending to match longest phrases first ("San Antonio Spurs" before "Spurs")
const TEAM_MATCHERS = Object.keys(PST_LABEL_TO_CODE)
  .sort((a, b) => b.length - a.length)
  .map((label) => ({
    label,
    code: PST_LABEL_TO_CODE[label],
    // Match exact phrase with word boundaries
    // Escape special regex chars if any (teams usually don't have them but good practice)
    regex: new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
  }));

/**
 * Extracts all valid team codes mentioned in the text.
 * Uses greedy matching (longest team names first).
 */
export function extractTeamCodes(text: string): string[] {
  const codeSet = new Set<string>();
  const lowerText = text.toLowerCase(); // Optimization checking

  // We loop through our pre-sorted matchers
  // Note: This approach allows overlapping matches if they are distinct concepts,
  // but since we sort by length, "San Antonio Spurs" will be found.
  // We aren't consuming the string, just finding presence.
  // If "San Antonio Spurs" is present, "Spurs" is also technically present.
  // The goal is "detectedTeamCodes", so duplicates (SAS, SAS) in the set are fine.
  
  for (const { regex, code } of TEAM_MATCHERS) {
     if (regex.test(text)) {
       codeSet.add(code);
     }
  }

  return Array.from(codeSet).sort();
}

/**
 * Extracts all 4-digit years (2000-2099)
 */
export function extractYears(text: string): number[] {
  const output = new Set<number>();
  const matches = text.match(/\b20[0-9]{2}\b/g);
  if (matches) {
    matches.forEach((m) => output.add(parseInt(m, 10)));
  }
  return Array.from(output).sort((a, b) => a - b);
}

/**
 * Extracts explicit round mentions (1st/2nd)
 */
export function extractRoundMentions(text: string): (1 | 2)[] {
  const rounds = new Set<1 | 2>();
  const lower = text.toLowerCase();

  // 1st Round
  if (/\b(?:1st|first)\s+round\b/i.test(text)) {
    rounds.add(1);
  }
  
  // 2nd Round
  if (/\b(?:2nd|second)\s+round\b/i.test(text)) {
    rounds.add(2);
  }

  return Array.from(rounds).sort();
}

// ============================================================================
// 3. Flags & Pick Refs
// ============================================================================

export function computeFlags(text: string): PstTextFeatures['flags'] {
  const lower = text.toLowerCase();
  
  return {
    mentionsSwap: lower.includes('swap'),
    mentionsProtection: lower.includes('protect'), // protected, protection
    mentionsConveyance: lower.includes('convey') || lower.includes('received'),
    mentionsLeastMostFavorable: lower.includes('favorable'), // least favorable, most favorable, more favorable
    mentionsDidNotConvey: lower.includes('did not convey') || lower.includes('not conveyed'),
    mentionsCash: lower.includes('cash') || lower.includes('$'),
    mentionsRights: lower.includes('rights to'),
  };
}

/**
 * Conservatively extracts specific pick references.
 * Format: "{ORIG}_{YEAR}_{1st|2nd}"
 * 
 * Strategy:
 * Look for patterns like:
 * - "2026 second round pick (from Hawks)"
 * - "2026 second round pick (Hawks pick)"
 * - "2026 first round pick (from Spurs)"
 * 
 * Only emits if we are VERY confident.
 * This is heuristics-based and may not catch everything.
 * It is a helper for Phase 4, not the final parser.
 */
export function extractPickRefs(text: string): string[] {
  const refs = new Set<string>();
  
  // Helper to standardise round
  const getRound = (s: string) => (s.match(/1st|first/) ? '1st' : '2nd');
  
  // Regex finding "YYYY (first|second) round pick" followed by optional "from/via (Team)" pattern
  // We iterate matches
  const regex = /\b(20[2-3][0-9])\s+(first|second|1st|2nd)\s+round\s+pick\s*(?:\((?:from|via)?\s*([A-Za-z0-9\s]+?)(?:pick)?(?:\)|;|,))/gi;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const year = match[1];
    const roundRaw = match[2];
    const teamRaw = match[3]; // "Hawks", "Spurs", "Bucks, Magic, Pistons"
    
    // We only create a ref if we can isolate a SINGLE team code from the teamRaw bit.
    // If it mentions multiple teams (swaps, favorable logic), we skip it to be conservative.
    // "Hawks" -> OK
    // "Bucks, Magic, Pistons" -> SKIP (ambiguous which one is the asset vs the condition)
    
    if (teamRaw) {
      const codes = extractTeamCodes(teamRaw);
      if (codes.length === 1) {
        // High confidence: Year + Round + Single Team Mention
        const roundSuffix = getRound(roundRaw);
        refs.add(`${codes[0]}_${year}_${roundSuffix}`);
      }
    }
  }

  return Array.from(refs).sort();
}

// ============================================================================
// 4. Main Processor
// ============================================================================

export function processRowText(rawText: string): PstTextFeatures {
  const normalizedText = normalizeText(rawText);
  const textHash = computeTextHash(normalizedText);
  
  return {
    normalizedText,
    textHash,
    detectedTeamCodes: extractTeamCodes(normalizedText),
    detectedYears: extractYears(normalizedText),
    detectedRounds: extractRoundMentions(normalizedText),
    detectedPickRefs: extractPickRefs(normalizedText),
    flags: computeFlags(normalizedText),
  };
}
