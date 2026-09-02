/**
 * FILE: src/features/architect/tradeMachine/verdictSummary.ts
 * PURPOSE: Flatten per-team validation results into the compact, team-attributed
 *          verdict items the sticky banner strip renders (BZE-247).
 * OWNERSHIP: Feature: architect/tradeMachine
 */

import {
  getFirstValidationIssueText,
  getValidationIssueText,
  normalizeValidationIssues,
} from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type {
  PreviewAuthorityLike,
  TeamResultLike,
} from './validationPresentationTypes';

export interface VerdictItem {
  /** Team the item belongs to; null for trade-wide items. */
  teamName: string | null;
  kind: 'needsInput' | 'violation' | 'warning';
  text: string;
}

export interface VerdictPresentationOptions {
  resolvePlayerName?: (playerId: string) => string | null | undefined;
}

const TRADE_BONUS_REASON_SOURCE = String.raw`(?:This Contract|\d{4}-\d{2}) (?:has a trade bonus whose allocation|has bonus compensation whose trade treatment) is outside this governed tranche\.?`;
const TRADE_BONUS_REASON = new RegExp(TRADE_BONUS_REASON_SOURCE, 'i');
const TRADE_BONUS_REASONS = new RegExp(TRADE_BONUS_REASON_SOURCE, 'gi');
const PLAYER_REASON_PREFIX = /\b(?<playerId>[A-Za-z0-9_-]+):\s*/gi;
const MISSING_PROTECTED_SALARY_REASON =
  /(?<season>\d{4}-\d{2}) protected Base Compensation is missing or invalid in governed Contract history\.?/gi;
const MISSING_PROTECTION_STEP_REASON =
  /(?<season>\d{4}-\d{2}) protection step is missing or invalid in governed Contract history\.?/gi;
const MISSING_PROTECTION_STEP_DATE_REASON =
  /(?<season>\d{4}-\d{2}) has a protection step without an exact governed date\.?/gi;
const MISSING_PROTECTION_SCHEDULE_REASON =
  /(?<season>\d{4}-\d{2}) is not fully protected and has no authenticated protection schedule\.?/gi;
const MISSING_BASE_SALARY_REASON =
  /(?<season>\d{4}-\d{2}) Base Compensation is missing or invalid in governed Contract history\.?/gi;
const POST_SEASON_SALARY_REASON =
  /Post-season salary basis requires governed (?<season>\d{4}-\d{2}) terms\.?/gi;
const MISSING_EARNED_SALARY_REASON =
  /(?<season>\d{4}-\d{2}) is partially protected and exact earned Base Compensation is unavailable for (?<date>\d{4}-\d{2}-\d{2})\.?/gi;
const MISSING_MINIMUM_REIMBURSEMENT_REASON =
  /One-year Minimum Contract reimbursement authority is unavailable\.?/gi;
const MISSING_SALARY_OR_CALENDAR_REASON =
  /Current Contract Salary or governed Regular Season calendar is unavailable\.?/gi;
const MISSING_CURRENT_CONTRACT_REASON =
  /No governed current Contract was found for this roster player\.?/gi;
const AMBIGUOUS_CURRENT_CONTRACT_REASON =
  /More than one governed current Contract claims this roster player and Salary Cap Year\.?/gi;
const MISSING_POISON_PILL_INPUTS_REASON =
  /This Rookie Scale Extension lacks authenticated poison-pill calculation inputs\.?/gi;
const INVALID_POISON_PILL_IDENTITY_REASON =
  /The retained poison-pill Extension identity or timing is invalid\.?/gi;
const POISON_PILL_SEASON_MISMATCH_REASON =
  /Poison-pill evidence identifies (?<identifiedSeason>\d{4}-\d{2}), not current Season (?<currentSeason>\d{4}-\d{2}), as the last original year\.?/gi;
const MISSING_POISON_PILL_ORIGINAL_SALARY_REASON =
  /Poison-pill original-term Salary is missing or invalid in governed Contract history\.?/gi;
const MISSING_POISON_PILL_EXTENDED_TERM_REASON =
  /Governed Contract history has no extended-term row for (?<season>\d{4}-\d{2})\.?/gi;
const INVALID_FIXED_POISON_PILL_SALARY_REASON =
  /Fixed poison-pill Salary evidence for (?<season>\d{4}-\d{2}) is inconsistent\.?/gi;
const INVALID_PERCENTAGE_POISON_PILL_SALARY_REASON =
  /Percentage-based poison-pill Salary for (?<season>\d{4}-\d{2}) lacks the governed Cap or ordinary \(non-Higher-Max\) percentage\.?/gi;

const SALARY_REASON_PRESENTATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    MISSING_PROTECTED_SALARY_REASON,
    'Protected salary information for $<season> is missing or invalid.',
  ],
  [
    MISSING_PROTECTION_STEP_REASON,
    'Protection-step salary information for $<season> is missing or invalid.',
  ],
  [
    MISSING_PROTECTION_STEP_DATE_REASON,
    'A protection-step date for $<season> is missing or invalid.',
  ],
  [
    MISSING_PROTECTION_SCHEDULE_REASON,
    'Protection schedule information for $<season> is unavailable.',
  ],
  [
    MISSING_BASE_SALARY_REASON,
    'Base salary information for $<season> is missing or invalid.',
  ],
  [
    POST_SEASON_SALARY_REASON,
    'Next-season salary information for $<season> is required.',
  ],
  [
    MISSING_EARNED_SALARY_REASON,
    'Earned salary information for $<season> as of $<date> is unavailable.',
  ],
  [
    MISSING_MINIMUM_REIMBURSEMENT_REASON,
    'One-year minimum-contract reimbursement information is unavailable.',
  ],
  [
    MISSING_SALARY_OR_CALENDAR_REASON,
    'Current salary or regular-season calendar information is unavailable.',
  ],
  [
    MISSING_CURRENT_CONTRACT_REASON,
    'Current contract information is unavailable for this roster player.',
  ],
  [
    AMBIGUOUS_CURRENT_CONTRACT_REASON,
    'Current contract information is ambiguous for this roster player and salary-cap year.',
  ],
  [
    MISSING_POISON_PILL_INPUTS_REASON,
    'Required poison-pill calculation information is unavailable.',
  ],
  [
    INVALID_POISON_PILL_IDENTITY_REASON,
    'The poison-pill extension identity or timing is invalid.',
  ],
  [
    POISON_PILL_SEASON_MISMATCH_REASON,
    'Poison-pill terms identify $<identifiedSeason>, not current season $<currentSeason>, as the last original year.',
  ],
  [
    MISSING_POISON_PILL_ORIGINAL_SALARY_REASON,
    'Original-term salary information for the poison-pill calculation is missing or invalid.',
  ],
  [
    MISSING_POISON_PILL_EXTENDED_TERM_REASON,
    'Extension salary information for $<season> is unavailable.',
  ],
  [
    INVALID_FIXED_POISON_PILL_SALARY_REASON,
    'Fixed poison-pill salary information for $<season> is inconsistent.',
  ],
  [
    INVALID_PERCENTAGE_POISON_PILL_SALARY_REASON,
    'Percentage-based poison-pill salary information for $<season> is incomplete.',
  ],
];

const STEPIEN_HISTORY_REASON =
  /(?:complete governed ownership|complete protection).*history is unavailable/i;

/** Present authority diagnostics in GM language without changing their result. */
export const presentTradeValidationText = (
  text: string,
  options: VerdictPresentationOptions = {}
): string => {
  const firstPresentedReasonIndex = [
    TRADE_BONUS_REASON,
    ...SALARY_REASON_PRESENTATIONS.map(([pattern]) => pattern),
  ]
    .map((pattern) => text.search(pattern))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  const playerReasonMatch = [...text.matchAll(PLAYER_REASON_PREFIX)]
    .filter(
      (match) =>
        match.index != null &&
        firstPresentedReasonIndex != null &&
        match.index + match[0].length <= firstPresentedReasonIndex
    )
    .at(-1);
  if (playerReasonMatch?.groups?.playerId && playerReasonMatch.index != null) {
    const playerId = playerReasonMatch.groups.playerId.trim();
    const resolvedName = options.resolvePlayerName?.(playerId)?.trim();
    const playerName =
      resolvedName && resolvedName !== playerId
        ? resolvedName
        : 'Traded player';
    const reasonsStart = playerReasonMatch.index + playerReasonMatch[0].length;
    const playerReasons = text.slice(reasonsStart);
    let presentedBonus = false;
    const bonusPresentedReasons = playerReasons.replace(
      TRADE_BONUS_REASONS,
      () => {
        if (presentedBonus) return ' ';
        presentedBonus = true;
        return 'Available contract information is insufficient to determine the trade-bonus allocation.';
      }
    );
    const presentedReasons = SALARY_REASON_PRESENTATIONS.reduce(
      (reasons, [pattern, replacement]) =>
        reasons.replace(pattern, replacement),
      bonusPresentedReasons
    )
      .replace(/\s+/g, ' ')
      .trim();
    return `${playerName}: ${presentedReasons}`;
  }

  if (STEPIEN_HISTORY_REASON.test(text)) {
    return "Stepien eligibility cannot be confirmed because the pick's complete protection and conveyance history is unavailable.";
  }

  return text;
};

// Owner-facing rule names, mirroring the Rule Compliance Overview grid.
const RULE_LABELS: Record<string, string> = {
  salaryMatching: 'Salary Matching',
  hardCap: 'Hard Cap',
  stepienRule: 'Stepien Rule',
  signAndTrade: 'Sign-and-Trade',
  secondApronEnforcement: '2nd Apron Rules',
  rosterCount: 'Roster Count',
  consent: 'Player Consent',
  reacquisition: 'Reacquisition',
  aggregation: 'Salary Aggregation',
  tradeExceptions: 'Trade Exceptions',
  cash: 'Cash Inclusion',
  timingEnforcement: 'Timing Restrictions',
  entitlementExclusivity: 'Pick Exclusivity',
};

const humanizeRuleKey = (key: string) =>
  RULE_LABELS[key] ||
  key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

const resolveTeamName = (team: TeamResultLike) =>
  team.teamName || team.teamCode || team.teamId || null;

const NEEDS_INPUT_MARKERS = new Set([
  'TRADE_SALARY_BASIS_AUTHORITY_ERROR',
  'GOVERNED_TRADE_SALARY_BASIS',
  'GOVERNEDTRADESALARYBASIS',
  'NEEDS_INPUT',
  'NEEDS-INPUT',
]);

/** Detect explicit Needs-input markers without borrowing state from sibling issues. */
const hasNeedsInputMarker = (values: unknown[]) => {
  const statusTokens = values
    .filter((value) => value != null)
    .map((value) => String(value).trim().toUpperCase());

  return (
    statusTokens.some((token) => NEEDS_INPUT_MARKERS.has(token)) ||
    statusTokens.some((token) => /\bNEEDS INPUT\b/.test(token))
  );
};

/** Classify one normalized top-level issue from only that issue's own fields. */
const previewAuthorityIssueNeedsInput = (
  issue: ReturnType<typeof normalizeValidationIssues>[number],
  violationText: string
) =>
  hasNeedsInputMarker([
    issue.code,
    issue.rule,
    issue.meta?.status,
    violationText,
  ]);

/** Classify the authority reason only when no structured top-level issue exists. */
const previewAuthorityReasonNeedsInput = (
  previewAuthority: PreviewAuthorityLike,
  reasonText: string
) =>
  hasNeedsInputMarker([
    previewAuthority.error,
    previewAuthority.reason,
    reasonText,
  ]);

/**
 * Build the banner strip's verdict items from the current validation payloads.
 * Violations come first, then warnings; duplicate texts are dropped so a rule
 * failing identically for two teams still reads once per team but repeated
 * boilerplate within one team does not.
 */
export const buildVerdictItems = (
  teamResults: TeamResultLike[] | null | undefined,
  previewAuthority: PreviewAuthorityLike | null | undefined,
  options: VerdictPresentationOptions = {}
): VerdictItem[] => {
  const violations: VerdictItem[] = [];
  const needsInput: VerdictItem[] = [];
  const warnings: VerdictItem[] = [];
  const seen = new Set<string>();

  const push = (item: VerdictItem) => {
    const presentedItem = {
      ...item,
      text: presentTradeValidationText(item.text, options),
    };
    const dedupeKey = `${presentedItem.teamName ?? ''}|${presentedItem.kind}|${presentedItem.text}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    if (presentedItem.kind === 'needsInput') {
      needsInput.push(presentedItem);
    } else if (presentedItem.kind === 'violation') {
      violations.push(presentedItem);
    } else {
      warnings.push(presentedItem);
    }
  };

  for (const team of teamResults ?? []) {
    const teamName = resolveTeamName(team);
    const rules = team.rules ?? {};
    for (const [ruleKey, rule] of Object.entries(rules)) {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) continue;
      const label = humanizeRuleKey(ruleKey);

      if (rule.status === 'NEEDS_INPUT') {
        const detail =
          rule.message ||
          getFirstValidationIssueText(rule.violations, '') ||
          'Needs input before this rule can be evaluated.';
        push({
          teamName,
          kind: 'needsInput',
          text: `${label}: ${detail}`,
        });
        continue;
      }

      if (rule.passed === false) {
        const detail =
          getFirstValidationIssueText(rule.violations, '') ||
          rule.message ||
          null;
        push({
          teamName,
          kind: 'violation',
          text: detail ? `${label}: ${detail}` : `${label} failed`,
        });
      }

      for (const warning of normalizeValidationIssues(rule.warnings)) {
        const text = getValidationIssueText(warning);
        if (!text) continue;
        push({ teamName, kind: 'warning', text: `${label}: ${text}` });
      }
    }
  }

  if (previewAuthority?.legal === false) {
    const topLevelViolations = normalizeValidationIssues(
      previewAuthority.violations
    );
    const topLevelItems =
      topLevelViolations.length > 0
        ? topLevelViolations.map((issue) => ({
            text: getValidationIssueText(issue),
            kind: previewAuthorityIssueNeedsInput(
              issue,
              getValidationIssueText(issue)
            )
              ? ('needsInput' as const)
              : ('violation' as const),
          }))
        : [String(previewAuthority.reason ?? '').trim()]
            .filter(Boolean)
            .map((text) => ({
              text,
              kind: previewAuthorityReasonNeedsInput(previewAuthority, text)
                ? ('needsInput' as const)
                : ('violation' as const),
            }));

    for (const { text, kind } of topLevelItems) {
      if (!text) continue;
      const alreadyAttributed = [...needsInput, ...violations].some(
        (item) => item.kind === kind && item.text.includes(text)
      );
      if (alreadyAttributed) continue;
      push({ teamName: null, kind, text });
    }
  }

  for (const warning of normalizeValidationIssues(previewAuthority?.warnings)) {
    const text = getValidationIssueText(warning);
    if (!text) continue;
    // A trade-wide warning that repeats an already team-attributed warning
    // (e.g. the July moratorium reported per team AND by the authority) adds
    // no information — keep only the attributed rows.
    const alreadyAttributed = warnings.some((item) => item.text.includes(text));
    if (alreadyAttributed) continue;
    push({ teamName: null, kind: 'warning', text });
  }

  return [...needsInput, ...violations, ...warnings];
};
