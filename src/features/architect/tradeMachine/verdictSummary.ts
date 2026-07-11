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
  kind: 'violation' | 'warning';
  text: string;
}

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
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());

const resolveTeamName = (team: TeamResultLike) =>
  team.teamName || team.teamCode || team.teamId || null;

/**
 * Build the banner strip's verdict items from the current validation payloads.
 * Violations come first, then warnings; duplicate texts are dropped so a rule
 * failing identically for two teams still reads once per team but repeated
 * boilerplate within one team does not.
 */
export const buildVerdictItems = (
  teamResults: TeamResultLike[] | null | undefined,
  previewAuthority: PreviewAuthorityLike | null | undefined
): VerdictItem[] => {
  const violations: VerdictItem[] = [];
  const warnings: VerdictItem[] = [];
  const seen = new Set<string>();

  const push = (item: VerdictItem) => {
    const dedupeKey = `${item.teamName ?? ''}|${item.kind}|${item.text}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    (item.kind === 'violation' ? violations : warnings).push(item);
  };

  for (const team of teamResults ?? []) {
    const teamName = resolveTeamName(team);
    const rules = team.rules ?? {};
    for (const [ruleKey, rule] of Object.entries(rules)) {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) continue;
      const label = humanizeRuleKey(ruleKey);

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

  return [...violations, ...warnings];
};
