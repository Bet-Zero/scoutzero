/**
 * Wave 30: Per-team validation logic extracted from tradeValidator.ts
 * (lines 157–177 and 535–922).
 *
 * Owns the validator registry, and validateSingleTeam — the per-team
 * map callback that runs all rule envelopes and builds TradeTeamResult.
 */

import { wrapCommonValidators } from './validationUtils';
import { validateSalaryMatching } from '../rules/validateSalaryMatching';
import { validateHardCap } from '../rules/hardCapValidation';
import { validateStepien } from '../rules/validateStepien';
import { validateCash } from '../rules/validateCash';
import { validateTradeExceptions } from '../rules/validateTradeExceptions';
import { validateSignAndTrade } from '../rules/validateSignAndTrade';
import { validateConsent } from '../rules/validateConsent';
import { validateReacquisition } from '../rules/validateReacquisition';
import { enforceConsent } from '../rules/enforceConsent';
import { enforceEligibility } from '../rules/validateEligibility';
import { enforceTiming } from '../rules/timingValidation';
import { enforceSecondApronHandcuffs } from '../rules/basicRules';
import { validateFaExceptionUsage } from '../rules/validateFaExceptionUsage';
import { validateAggregation } from '../rules/validateAggregation';
import { evaluateTradeApronRestriction } from '../utils/tradeApronRestrictions';
import { getApronStatus } from '@/features/architect/utils/tradeHelpers';
import { computeProjectedRosterLegality } from './tradeValidator.helpers';
import { buildEntitlementRoutingMap } from '../utils/buildEntitlementRoutingMap';
import { computePostTradeEntitlements } from '../utils/stepienEntitlementUtils';
import { validateEntitlementExclusivity } from '@/features/architect/utils/entitlements/entitlementExclusivityValidator';
import {
  createRuleEnvelope,
  readSalaryMatchingRuleEnvelope,
  readSignAndTradeRuleEnvelope,
  readHardCapRuleEnvelope,
  resolveTeamIdentity,
  isRuleEnvelopeObject,
  toSignAndTradeCapProjectionMap,
} from './tradeValidator.ruleEnvelopes';
import { summarizeValidationIssues } from '../utils/validationIssueText';
import { validationFlags } from '@/config/validationFlags';
import type {
  TradeFaExceptionBucket,
  TradeTeamResult,
  TradeValidatorContext,
  ValidationIssueLike,
} from '../constants/types';
import type {
  TradeValidatorActiveTeamSlot,
  TradeValidatorEntitlement,
} from './tradeValidator.types';

// Re-export for external consumers (previously re-exported directly from tradeValidator.ts)
export { validateFaExceptionUsage };

// ============================================================
// Validator registry
// ============================================================

const baseValidators = {
  validateSalaryMatching,
  validateHardCap,
  validateStepien,
  validateCash,
  validateFaExceptionUsage,
  validateTradeExceptions,
  validateSignAndTrade,
  validateConsent,
  validateReacquisition,
  validateAggregation,
  enforceConsent,
  enforceEligibility,
  enforceTiming,
  enforceSecondApronHandcuffs,
};
export const validators = wrapCommonValidators(baseValidators);

// ============================================================
// validateSingleTeam
// ============================================================

/**
 * Runs all rule validators for a single team in a trade and returns
 * its TradeTeamResult. Called as the map callback in validateTrade.
 */
export function validateSingleTeam(
  team: TradeValidatorActiveTeamSlot,
  index: number,
  {
    teamsWithAssets,
    teamIdsByIndex,
    context,
  }: {
    teamsWithAssets: TradeValidatorActiveTeamSlot[];
    teamIdsByIndex: string[];
    context: TradeValidatorContext;
  }
): TradeTeamResult {
  const teamId =
    team.teamId ||
    team.team?.teamId ||
    team.team?.id ||
    resolveTeamIdentity(team, index);
  const teamName =
    team.team?.teamName ||
    team.team?.name ||
    team.team?.nickname ||
    `Team ${index}`;

  // DEV: Apron Team Salary bridge breakdown verification.
  if (import.meta.env.DEV && index === 0) {
    console.log('[Definition Gate] Team salary breakdown', {
      team: teamName,
      preTradeApronTeamSalary: team.teamTotalSalary,
      salaryOut: team.salaryOut,
      salaryIn: team.salaryIn,
      postTradeSalary: team.projectedSalary,
      formula: `${team.teamTotalSalary} - ${team.salaryOut} + ${team.salaryIn} = ${team.projectedSalary}`,
    });
  }

  const teamForValidation: TradeValidatorActiveTeamSlot & {
    notes: string[];
    faExceptionValidation?: {
      passed?: boolean;
      [key: string]: unknown;
    };
  } = {
    ...team,
    notes: Array.isArray(team.notes) ? ([...team.notes] as string[]) : [],
    team:
      team.team && typeof team.team === 'object'
        ? {
            ...team.team,
            faExceptionBuckets: Array.isArray(team.team.faExceptionBuckets)
              ? team.team.faExceptionBuckets.map(
                  (bucket: TradeFaExceptionBucket) => ({ ...bucket })
                )
              : team.team.faExceptionBuckets,
            hardCapFirstApron: team.team.hardCapFirstApron
              ? { ...team.team.hardCapFirstApron }
              : team.team.hardCapFirstApron,
          }
        : team.team,
  };

  const faExceptionUsageViolations = validators.validateFaExceptionUsage(
    teamForValidation,
    context
  );
  const faExceptionUsageResult = Array.isArray(faExceptionUsageViolations)
    ? {
        passed: faExceptionUsageViolations.length === 0,
        violations: faExceptionUsageViolations,
        message:
          faExceptionUsageViolations[0] ||
          'FA exception trade absorption validated',
      }
    : faExceptionUsageViolations;
  teamForValidation.faExceptionValidation = faExceptionUsageResult;

  // Run individual validation rules
  const salaryMatchingResult = validators.validateSalaryMatching(
    teamForValidation,
    context
  );
  teamForValidation.salaryMatchingPathEvaluation =
    salaryMatchingResult.details.pathEvaluation ?? null;
  const apronRestrictionResult = evaluateTradeApronRestriction({
    team: teamForValidation,
    teamCode: teamId,
    pathEvaluation: teamForValidation.salaryMatchingPathEvaluation,
    context,
  });
  const hardCapResult = validators.validateHardCap(teamForValidation, context);
  const stepienResult = validators.validateStepien(teamForValidation, context);
  const cashResult = validators.validateCash(teamForValidation, context);
  const tradeExceptionsResult = validators.validateTradeExceptions({
    ...teamForValidation,
    context: {
      ...context,
      ...teamForValidation.context,
      source: context.source ?? teamForValidation.context?.source,
    },
  });
  // Sign-and-trade owns all S&T-specific season/timing restrictions.
  const signAndTradeResult = validators.validateSignAndTrade(
    teamForValidation,
    {
      ...context,
      capProjections: toSignAndTradeCapProjectionMap(context.capProjections),
    }
  );
  const consentResult = validators.validateConsent(teamForValidation, context);
  const reacquisitionResult = validators.validateReacquisition(
    teamForValidation,
    context
  );
  const aggregationResult = validators.validateAggregation(
    teamForValidation,
    context
  );

  // Enforcement rules
  const consentEnforcement = validators.enforceConsent(
    teamForValidation,
    context
  );
  const eligibilityEnforcement = validators.enforceEligibility(
    teamForValidation,
    context
  );
  // Generic trade timing gates remain here; S&T-specific timing no longer lives in timingEnforcement.
  const timingEnforcement = validators.enforceTiming(teamForValidation, {
    ...context,
    timingEnforcementMode: validationFlags.timingEnforcement,
  });
  const secondApronEnforcement = validators.enforceSecondApronHandcuffs(
    teamForValidation,
    context
  );

  // Roster structural legality (min/max standard roster, two-way max)
  const rosterCountResult = computeProjectedRosterLegality(team);

  // TM-EXCL-E1 + TM-EXCL-E2: Entitlement exclusivity — block trades that create overlapping claims
  // TM-EXCL-E2: Build explicit routing map FIRST; if routing is incomplete, fail immediately.
  const entitlementExclusivityResult = (() => {
    try {
      // TM-EXCL-E2: Build routing map for all participants
      const routingResult = buildEntitlementRoutingMap(teamsWithAssets);

      if (!routingResult.ok) {
        const routingFailure = routingResult as {
          reason?: string;
          errors?: ValidationIssueLike[];
        };
        // Routing incomplete — block trade with clear reason
        return {
          passed: false,
          details: routingFailure.reason,
          violations: routingFailure.errors,
        };
      }

      // Build allTeamsEntOut with resolved routing from the map
      const tradeParticipantIds = new Set(
        teamsWithAssets
          .map((t, participantIndex) =>
            resolveTeamIdentity(t, participantIndex)
          )
          .filter(Boolean)
      );

      const allTeamsEntOut = teamsWithAssets.map((t, participantIndex) => {
        const tId = resolveTeamIdentity(t, participantIndex);
        return (t.entitlementsOut || []).map((e: TradeValidatorEntitlement) => {
          const entId = e.entitlementId || e.id;
          const routingKey = `${tId}::${entId}`;
          const resolvedToTeamId =
            routingResult.map.get(routingKey) || e.toTeamId || null;

          // TM-EXCL-E2: For 2-team trades, auto-resolve missing toTeamId
          const autoResolvedToTeamId =
            teamsWithAssets.length === 2
              ? teamsWithAssets
                  .map((otherTeam, otherIndex) =>
                    resolveTeamIdentity(otherTeam, otherIndex)
                  )
                  .find((otherTeamId) => otherTeamId !== tId)
              : undefined;
          const finalToTeamId = resolvedToTeamId || autoResolvedToTeamId;

          return {
            ...e,
            fromTeamId: tId,
            toTeamId: finalToTeamId,
          };
        });
      });

      // TM-EXCL-E2: Use strict computePostTradeEntitlements with tradeParticipantIds
      const postTradeSet = computePostTradeEntitlements({
        currentEntitlements: team.validationEntitlements || [],
        entitlementsOut: team.entitlementsOut || [],
        allTeamsEntitlementsOut: allTeamsEntOut,
        teamId,
        tradeParticipantIds,
      });

      const exclusivityResult = validateEntitlementExclusivity({
        entitlements: postTradeSet as Parameters<
          typeof validateEntitlementExclusivity
        >[0]['entitlements'],
      });

      if (exclusivityResult.valid) {
        return { passed: true, details: 'No exclusivity conflicts' };
      }

      const messages = exclusivityResult.violations.map((v) => v.message);
      return {
        passed: false,
        details: messages.join('; '),
        violations: exclusivityResult.violations,
      };
    } catch (err) {
      const error = err as Error;
      // Integrity-first (TM-EXCL-E1.1 + E2): if routing or post-trade computation fails, BLOCK the trade.
      if (import.meta.env.DEV) {
        console.warn(
          '[entitlement-exclusivity] trade validation error, blocking trade:',
          err
        );
      }
      return {
        passed: false,
        details:
          error.message && error.message.startsWith('Pick Exclusivity:')
            ? error.message
            : 'Pick Exclusivity: Error computing post-trade entitlement set',
        violations: [
          error.message && error.message.startsWith('Pick Exclusivity:')
            ? error.message
            : 'Exclusivity validation unavailable — cannot verify trade legality',
        ],
      };
    }
  })();

  const allRules = {
    salaryMatching: createRuleEnvelope(
      'salaryMatching',
      salaryMatchingResult,
      'Salary Matching'
    ),
    apronRestriction: createRuleEnvelope(
      'apronRestriction',
      apronRestrictionResult,
      'Apron Restriction'
    ),
    hardCap: createRuleEnvelope('hardCap', hardCapResult, 'Hard Cap'),
    stepienRule: createRuleEnvelope(
      'stepienRule',
      stepienResult,
      'Stepien Rule'
    ),
    cash: createRuleEnvelope('cash', cashResult, 'Cash Inclusion'),
    faExceptionUsage: createRuleEnvelope(
      'faExceptionUsage',
      faExceptionUsageResult,
      'FA Exception Usage'
    ),
    tradeExceptions: createRuleEnvelope(
      'tradeExceptions',
      tradeExceptionsResult,
      'Trade Exceptions'
    ),
    signAndTrade: createRuleEnvelope(
      'signAndTrade',
      signAndTradeResult,
      'Sign-and-Trade'
    ),
    consent: createRuleEnvelope('consent', consentResult, 'Player Consent'),
    reacquisition: createRuleEnvelope(
      'reacquisition',
      reacquisitionResult,
      'Reacquisition'
    ),
    aggregation: createRuleEnvelope(
      'aggregation',
      aggregationResult,
      'Aggregation'
    ),
    consentEnforcement: createRuleEnvelope(
      'consentEnforcement',
      consentEnforcement,
      'Consent Enforcement'
    ),
    eligibilityEnforcement: createRuleEnvelope(
      'eligibilityEnforcement',
      eligibilityEnforcement,
      'Eligibility Enforcement'
    ),
    timingEnforcement: createRuleEnvelope(
      'timingEnforcement',
      timingEnforcement,
      'Timing Restrictions'
    ),
    secondApronEnforcement: createRuleEnvelope(
      'secondApronEnforcement',
      secondApronEnforcement,
      'Second Apron Restrictions'
    ),
    entitlementExclusivity: createRuleEnvelope(
      'entitlementExclusivity',
      entitlementExclusivityResult,
      'Pick Exclusivity'
    ),
    rosterCount: createRuleEnvelope(
      'rosterCount',
      rosterCountResult,
      'Roster Count'
    ),
  };

  const violations = Object.values(allRules).flatMap(
    (rule) => rule?.violations || []
  );
  const warnings = Object.values(allRules).flatMap(
    (rule) => rule?.warnings || []
  );

  const isTeamLegal = violations.length === 0;

  // Extract salary matching calculations for UI display
  const salaryMatchingCalcs =
    readSalaryMatchingRuleEnvelope(salaryMatchingResult);
  const signAndTradeResultObject =
    readSignAndTradeRuleEnvelope(signAndTradeResult);
  const hardCapResultObject = readHardCapRuleEnvelope(hardCapResult);
  const calculations = {
    salaryIn: team.salaryIn || 0,
    salaryOut: team.salaryOut || 0,
    salaryMatching: {
      allowedIncoming: salaryMatchingCalcs.allowableIncoming || 0,
      margin:
        (salaryMatchingCalcs.allowableIncoming || 0) - (team.salaryOut || 0),
      difference: (team.salaryIn || 0) - (team.salaryOut || 0),
    },
  };

  const totalSalary =
    team.team?.apronTeamSalary ?? team.teamTotalSalary ?? Number.NaN;
  const projectedSalary = team.projectedSalary ?? Number.NaN;
  const apronStatus = getApronStatus(projectedSalary, {
    salaryCap: context.capSettings?.salaryCap,
    firstApron: context.capSettings?.firstApron,
    secondApron: context.capSettings?.secondApron,
  });

  return {
    teamId,
    teamCode: teamId,
    teamName,
    legal: isTeamLegal,
    violations,
    warnings,
    rules: allRules,
    salaryOut: team.salaryOut || 0,
    salaryIn: team.salaryIn || 0,
    outgoingPlayers: team.outgoingPlayers || [],
    incomingPlayers: team.incomingPlayers || [],
    calculations,
    totalSalary,
    projectedSalary,
    capRoom: Math.max(
      0,
      (context.capSettings?.salaryCap || 141000000) - projectedSalary
    ),
    hardCapped: Boolean(
      teamForValidation.team?.hardCapped ||
        teamForValidation.team?.hardCapFirstApron?.active ||
        signAndTradeResultObject.hardCapped ||
        hardCapResultObject.hardCapStatus?.isHardCapped ||
        apronRestrictionResult.hardCapWillPersist
    ),
    apronStatus,
    faExceptionBuckets: teamForValidation.team?.faExceptionBuckets || [],
    notes: Array.isArray(teamForValidation.notes)
      ? teamForValidation.notes
      : [],
    createdTPE:
      isRuleEnvelopeObject(tradeExceptionsResult) &&
      'createdTPE' in tradeExceptionsResult
        ? tradeExceptionsResult.createdTPE || null
        : null,
    salaryMatchingPathEvaluation:
      salaryMatchingResult.details.pathEvaluation ?? null,
    apronRestrictionEvaluation: apronRestrictionResult,
    details: isTeamLegal
      ? 'Valid trade for this team'
      : summarizeValidationIssues(violations, 'Trade validation failed'),
    warningDetails: summarizeValidationIssues(warnings),
  };
}
