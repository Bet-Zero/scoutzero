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

const TRADE_BONUS_REASON =
  /^(?<playerId>[^:]+):\s*(?:This Contract|\d{4}-\d{2}) (?:has a trade bonus whose allocation|has bonus compensation whose trade treatment) is outside this governed tranche\.?$/i;

const STEPIEN_HISTORY_REASON =
  /(?:complete governed ownership|complete protection).*history is unavailable/i;

/** Present authority diagnostics in GM language without changing their result. */
export const presentTradeValidationText = (
  text: string,
  options: VerdictPresentationOptions = {}
): string => {
  const tradeBonusMatch = text.match(TRADE_BONUS_REASON);
  if (tradeBonusMatch?.groups?.playerId) {
    const playerId = tradeBonusMatch.groups.playerId.trim();
    const resolvedName = options.resolvePlayerName?.(playerId)?.trim();
    const playerName =
      resolvedName && resolvedName !== playerId
        ? resolvedName
        : 'Traded player';
    return `${playerName}: Available contract information is insufficient to determine the trade-bonus allocation.`;
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
