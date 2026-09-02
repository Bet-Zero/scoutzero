import React from 'react';
import {
  getValidationIssueText,
  normalizeValidationIssues,
} from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type {
  TeamResultLike,
  ValidationRuleLike,
} from './validationPresentationTypes';
import { presentTradeValidationText } from '@/features/architect/tradeMachine/verdictSummary';

interface TradeLegalCheckerProps {
  teamResults?: TeamResultLike[];
  capSettings?: unknown;
}

interface RuleDisplayProps {
  rule?: ValidationRuleLike;
  label: string;
}

export const TradeLegalChecker = ({ teamResults }: TradeLegalCheckerProps) => {
  const resolvePlayerName = (playerId: string) => {
    for (const team of teamResults ?? []) {
      const player = [
        ...(team.outgoingPlayers ?? []),
        ...(team.incomingPlayers ?? []),
      ].find(
        (candidate) =>
          candidate.player_id === playerId || candidate.id === playerId
      );
      const name = [player?.name, player?.fullName].find(
        (candidate) => typeof candidate === 'string' && candidate !== playerId
      );
      if (name) return name;
    }
    return null;
  };
  const getRuleStatus = (passed: boolean | null | undefined) => {
    if (passed === undefined || passed === null)
      return 'text-cockpit-text-muted';
    return passed ? 'text-cockpit-safe' : 'text-cockpit-danger';
  };

  const RuleDisplay = ({ rule, label }: RuleDisplayProps) => {
    if (!rule) return null;

    if (typeof rule !== 'object' || Array.isArray(rule)) {
      return null;
    }

    const violations = normalizeValidationIssues(rule.violations);
    const warnings = normalizeValidationIssues(rule.warnings);
    const rawSummaryText =
      (violations[0] && getValidationIssueText(violations[0])) ||
      (warnings[0] && getValidationIssueText(warnings[0])) ||
      rule.message ||
      (rule.skipReason ? `Skipped: ${rule.skipReason}` : '');
    const summaryText = presentTradeValidationText(rawSummaryText, {
      resolvePlayerName,
    });
    const needsInput = rule.status === 'NEEDS_INPUT';

    return (
      <div>
        <div
          className={
            needsInput ? 'text-cockpit-watch' : getRuleStatus(rule.passed)
          }
        >
          • {label}
          {needsInput ? ' · Needs input' : ''}
        </div>
        {summaryText && (
          <span className="block text-xs text-cockpit-text-muted pl-4">
            {summaryText}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="block text-[10px] text-cockpit-watch/80 pl-4">
            {warnings.length} warning{warnings.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-cockpit-slab border border-cockpit-edge rounded-lg p-4">
      <h3 className="font-medium mb-3">CBA Rule Compliance Overview</h3>

      {teamResults?.map((team, index) => (
        <div key={index} className="mb-4 last:mb-0">
          <h4 className="font-medium text-sm mb-2">{team.teamName}</h4>

          <div className="grid grid-cols-3 gap-y-2 gap-x-4 text-xs">
            <RuleDisplay
              rule={team.rules?.salaryMatching}
              label="Salary Matching"
            />
            <RuleDisplay rule={team.rules?.hardCap} label="Hard Cap" />
            <RuleDisplay rule={team.rules?.stepienRule} label="Stepien Rule" />

            <RuleDisplay
              rule={team.rules?.signAndTrade}
              label="Sign-and-Trade"
            />
            <RuleDisplay
              rule={team.rules?.secondApronEnforcement}
              label="2nd Apron Rules"
            />
            <RuleDisplay rule={team.rules?.rosterCount} label="Roster Count" />

            <RuleDisplay rule={team.rules?.consent} label="Player Consent" />
            <RuleDisplay
              rule={team.rules?.reacquisition}
              label="Reacquisition"
            />
            <RuleDisplay
              rule={team.rules?.aggregation}
              label="Salary Aggregation"
            />

            <RuleDisplay
              rule={team.rules?.tradeExceptions}
              label="Trade Exceptions"
            />
            <RuleDisplay rule={team.rules?.cash} label="Cash Inclusion" />
            <RuleDisplay
              rule={team.rules?.timingEnforcement}
              label="Timing Restrictions"
            />

            <div>
              <RuleDisplay
                rule={team.rules?.entitlementExclusivity}
                label="Pick Exclusivity"
              />
              {team.rules?.entitlementExclusivity?.passed === false &&
                Array.isArray(team.rules.entitlementExclusivity.violations) &&
                team.rules.entitlementExclusivity.violations.length > 0 && (
                  <div className="pl-4 mt-1 space-y-1">
                    {team.rules.entitlementExclusivity.violations
                      .slice(0, 3)
                      .map((violation, violationIndex) => {
                        const issueMeta =
                          typeof violation === 'object' &&
                          violation &&
                          typeof violation.meta === 'object' &&
                          violation.meta
                            ? (violation.meta as Record<string, unknown>)
                            : {};
                        const conflictExplanation =
                          typeof issueMeta.conflictExplanation === 'string'
                            ? issueMeta.conflictExplanation
                            : null;
                        const entitlementIds = Array.isArray(
                          issueMeta.entitlementIds
                        )
                          ? issueMeta.entitlementIds.map(String)
                          : [];
                        const claimMeta =
                          Array.isArray(issueMeta.claimsA) &&
                          issueMeta.claimsA.length > 0
                            ? String(
                                (
                                  issueMeta.claimsA[0] as Record<
                                    string,
                                    unknown
                                  >
                                )?.meta ?? ''
                              )
                            : '';

                        return (
                          <div
                            key={violationIndex}
                            className="text-xs bg-cockpit-danger/20 border border-cockpit-danger/30 rounded px-2 py-1"
                          >
                            {conflictExplanation && (
                              <div className="text-cockpit-danger font-medium">
                                {conflictExplanation}
                              </div>
                            )}
                            {entitlementIds.length > 0 && (
                              <div className="text-cockpit-text-muted mt-0.5">
                                Conflicts between: {entitlementIds.join(' ↔ ')}
                              </div>
                            )}
                            {claimMeta && (
                              <div className="text-cockpit-text-muted mt-0.5">
                                Claim: {claimMeta}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    {team.rules.entitlementExclusivity.violations.length >
                      3 && (
                      <div className="text-xs text-cockpit-text-ghost pl-2">
                        +
                        {team.rules.entitlementExclusivity.violations.length -
                          3}{' '}
                        more conflict(s)
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>
      ))}

      <div className="mt-3 text-xs text-cockpit-text-secondary">
        <p>🟢 Compliant • 🔴 Violation • ⚪ Not Applicable</p>
        <p className="mt-2 text-cockpit-watch/40">
          Final roster and draft-asset checks run when you apply the trade.
        </p>
      </div>
    </div>
  );
};
