/**
 * FILE: src/features/architect/utils/nonTradeMutationValidationStage.ts
 * PURPOSE: Adapt non-trade mutation pipeline state into mutation-specific validators.
 * OWNERSHIP: Feature: architect/core
 *
 * This module owns only validation-stage dispatch and state adaptation.
 * Business-rule ownership remains in capLegalityValidation.ts.
 */

import { getPlayerId } from '@/features/architect/utils/capHelpers';
import {
  validateSigning,
  validateWaive,
  validateExtension,
  validateOptionDecision,
  validateOfferSheetResolution,
  validateRenounceRights,
  validateDeadCap,
  validateExceptions,
} from '@/features/architect/utils/capLegalityValidation';
import { validateGovernedPriorTeamOptionSigning } from '@/features/architect/utils/capLegalityValidation/governedPriorTeamOptionSigning';
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { resolveGovernedSigningAuthority } from '@/features/architect/utils/signings';
import { resolveSigningMechanismForPipeline } from './mutationPipeline.compute.signings';
import type {
  ArchitectMutationContract,
  ArchitectMutationTeamRecord,
  ArchitectMutationOfferSheet,
  ComputeResultLike,
  MutationCurrentState,
  MutationPayloadLike,
} from '@/features/architect/utils/mutationPipeline';

type StageValidationResult = {
  valid: boolean;
  error?: string | null;
  violations?: string[];
  warnings?: Array<Record<string, unknown>>;
};

type CurrentStateWithTeam = MutationCurrentState & {
  team: NonNullable<MutationCurrentState['team']>;
};

type CurrentStateWithTeamAndPlayer = CurrentStateWithTeam & {
  player: NonNullable<MutationCurrentState['player']>;
};

type OfferSheetResolutionHomeTeam = NonNullable<
  MutationCurrentState['homeTeam']
> & {
  incomingOfferSheets?: ArchitectMutationOfferSheet[] | null;
};

type OfferSheetResolutionOfferingTeam = NonNullable<
  MutationCurrentState['offeringTeam']
> & {
  offerSheets?: ArchitectMutationOfferSheet[] | null;
};

type CurrentStateWithOfferSheetTeams = MutationCurrentState & {
  homeTeam: OfferSheetResolutionHomeTeam;
  offeringTeam: OfferSheetResolutionOfferingTeam;
  offerSheetId: string;
};

type ValidationIssue = string | { message?: string | null };

function stringifyViolations(violations: ValidationIssue[] = []): string[] {
  return violations.map((violation) =>
    typeof violation === 'string' ? violation : JSON.stringify(violation)
  );
}

function getPrimaryError(violations: ValidationIssue[] = []): string | null {
  const firstViolation = violations[0];
  if (!firstViolation) {
    return null;
  }

  if (typeof firstViolation === 'string') {
    return firstViolation;
  }

  return firstViolation.message || null;
}

function formatValidatorResult({
  valid,
  violations,
  warnings = [],
}: {
  valid: boolean;
  violations: ValidationIssue[];
  warnings?: Array<Record<string, unknown>>;
}): StageValidationResult {
  return {
    valid,
    error: getPrimaryError(violations),
    violations: stringifyViolations(violations),
    warnings,
  };
}

function buildPipelineWarnings({
  asOfDate,
  dateDefaulted,
}: {
  asOfDate?: string | null;
  dateDefaulted?: boolean;
}) {
  const pipelineWarnings: Array<Record<string, unknown>> = [];

  if (dateDefaulted) {
    pipelineWarnings.push({
      rule: 'world_time_defaulted',
      message: `World time was defaulted to ${asOfDate}. For accurate timing-based validation, provide asOfDate in payload or world metadata.`,
      severity: 'warning',
      asOfDateUsed: asOfDate,
    });
  }

  return pipelineWarnings;
}

const INCOMPLETE_ROSTER_COUNT_MUTATIONS = new Set([
  'signFreeAgent',
  'storeOfferSheet',
  'waivePlayer',
  'renounceRights',
  'matchOfferSheet',
  'declineOfferSheet',
  'finalizeMatchedOfferSheet',
  'finalizeDeclinedOfferSheet',
]);

function validateReconciledRosterBooks(
  mutationType: string,
  computeResult: ComputeResultLike,
  currentState: MutationCurrentState
): StageValidationResult | null {
  if (!INCOMPLETE_ROSTER_COUNT_MUTATIONS.has(mutationType)) return null;

  for (const currentTeam of [
    currentState.team,
    currentState.homeTeam,
    currentState.offeringTeam,
  ]) {
    const hasGovernedEvidence = Object.prototype.hasOwnProperty.call(
      currentTeam?.salaryBookInputs || {},
      'unsignedFirstRoundPickState'
    );
    if (!hasGovernedEvidence) continue;
    const teamCode =
      typeof currentTeam?.teamCode === 'string' && currentTeam.teamCode.trim()
        ? currentTeam.teamCode.trim()
        : null;
    const hasPostState =
      teamCode !== null &&
      (computeResult.teamUpdates || []).some(
        (update) => update.teamCode === teamCode
      );
    if (hasPostState) continue;
    const displayTeamCode = teamCode || 'the governed Team';
    const message = `No changes were saved for ${displayTeamCode}: the count-changing operation did not produce a reconciled post-action Team state.`;
    return {
      valid: false,
      error: message,
      violations: [
        JSON.stringify({
          rule: 'governed_incomplete_roster_books_required',
          ledger: 'teamUpdates',
          message,
          severity: 'error',
        }),
      ],
      warnings: [],
    };
  }

  for (const update of computeResult.teamUpdates || []) {
    const totals = update.team?.totals as Record<string, unknown> | undefined;
    const rosterResolution = totals?.incompleteRosterResolution as
      | { mode?: unknown }
      | undefined;
    const salaryBookInputs = update.team?.salaryBookInputs;
    const hasGovernedEvidence = Object.prototype.hasOwnProperty.call(
      salaryBookInputs || {},
      'unsignedFirstRoundPickState'
    );
    if (!hasGovernedEvidence && rosterResolution?.mode !== 'governed') continue;
    if (rosterResolution?.mode !== 'governed') {
      const message = `No changes were saved for ${update.teamCode}: the governed incomplete-roster result is missing from the post-action Team state.`;
      return {
        valid: false,
        error: message,
        violations: [
          JSON.stringify({
            rule: 'governed_incomplete_roster_books_required',
            ledger: 'incompleteRosterResolution',
            message,
            severity: 'error',
          }),
        ],
        warnings: [],
      };
    }
    const salaryBooks = totals?.salaryBooks as
      | {
          ledgers?: Record<
            string,
            { status?: unknown; reason?: unknown; missingInputs?: unknown }
          >;
        }
      | undefined;
    for (const ledgerName of ['teamSalary', 'apronTeamSalary'] as const) {
      const ledger = salaryBooks?.ledgers?.[ledgerName];
      if (ledger?.status === 'complete') continue;
      const missing = Array.isArray(ledger?.missingInputs)
        ? ledger.missingInputs.join(', ')
        : 'governed roster inputs';
      const reason =
        typeof ledger?.reason === 'string'
          ? ledger.reason
          : 'The post-action salary book is not complete.';
      const message = `No changes were saved for ${update.teamCode}: ${reason} Missing: ${missing}.`;
      return {
        valid: false,
        error: message,
        violations: [
          JSON.stringify({
            rule: 'governed_incomplete_roster_books_required',
            ledger: ledgerName,
            message,
            severity: 'error',
          }),
        ],
        warnings: [],
      };
    }
  }
  return null;
}

function toStrictSalaryCapYear(seasonId: string): number | null {
  const normalized = seasonId.trim();
  if (/^\d{4}$/.test(normalized)) {
    const year = Number(normalized);
    return year >= 1900 && year <= 9999 ? year : null;
  }

  const seasonMatch = normalized.match(/^(\d{4})-(\d{2})$/);
  if (!seasonMatch) return null;
  const startYear = Number(seasonMatch[1]);
  const endYear = startYear + 1;
  if (startYear < 1900 || endYear > 9999) return null;
  return String(endYear).slice(-2) === seasonMatch[2] ? endYear : null;
}

function requireTeamState(
  currentState: MutationCurrentState,
  mutationType: string
): CurrentStateWithTeam {
  if (!currentState.team) {
    throw new Error(`${mutationType} current state missing team`);
  }

  return currentState as CurrentStateWithTeam;
}

function requireTeamAndPlayerState(
  currentState: MutationCurrentState,
  mutationType: string
): CurrentStateWithTeamAndPlayer {
  const teamState = requireTeamState(currentState, mutationType);

  if (!teamState.player) {
    throw new Error(`${mutationType} current state missing player`);
  }

  return teamState as CurrentStateWithTeamAndPlayer;
}

function requireOfferSheetTeamState(
  currentState: MutationCurrentState,
  mutationType: string
): CurrentStateWithOfferSheetTeams {
  if (!currentState.homeTeam) {
    throw new Error(`${mutationType} current state missing home team`);
  }
  if (!currentState.offeringTeam) {
    throw new Error(`${mutationType} current state missing offering team`);
  }
  if (!currentState.offerSheetId) {
    throw new Error(`${mutationType} current state missing offerSheetId`);
  }

  return currentState as CurrentStateWithOfferSheetTeams;
}

function findOfferSheetByIdentity(
  offerSheets: ArchitectMutationOfferSheet[] | null | undefined,
  offerSheetId: string,
  dedupKey?: string | null
) {
  return offerSheets?.find(
    (offerSheetEntry) =>
      offerSheetEntry.id === offerSheetId ||
      (dedupKey && offerSheetEntry.dedupKey === dedupKey)
  );
}

function validateSigningSideMutation({
  mutationType,
  payload,
  currentState,
  currentYear,
  asOfDate,
  worldId,
  dateDefaulted,
  pipelineWarnings,
}: {
  mutationType: string;
  payload: MutationPayloadLike;
  currentState: MutationCurrentState;
  currentYear: number;
  asOfDate?: string | null;
  worldId?: string | null;
  dateDefaulted?: boolean;
  pipelineWarnings: Array<Record<string, unknown>>;
}): StageValidationResult {
  const { team, player } = requireTeamAndPlayerState(
    currentState,
    mutationType
  );
  const governedOptionSigningResult =
    mutationType === 'signFreeAgent'
      ? validateGovernedPriorTeamOptionSigning({
          team,
          player,
          contract: payload.contract,
          worldId,
          year: currentYear,
          asOfDate,
          dateDefaulted,
        })
      : { valid: true, violations: [], warnings: [] };
  const isGovernedSavedWorldSigning =
    mutationType === 'signFreeAgent' &&
    currentState.signingTeamSnapshot != null;
  const governedSigningAuthority =
    isGovernedSavedWorldSigning && !dateDefaulted
      ? resolveGovernedSigningAuthority({
          team: team as ArchitectMutationTeamRecord,
          contract: payload.contract as ArchitectMutationContract,
          mechanism: resolveSigningMechanismForPipeline(
            payload.contract,
            payload.signedUsing
          ),
          worldDate: asOfDate,
          salaryCapYear: currentYear,
        })
      : isGovernedSavedWorldSigning
        ? {
            status: 'needs-input' as const,
            reasons: [
              'Signing requires an exact saved-world date; runtime-clock fallback is not permitted.',
            ],
          }
        : null;
  const governedSigningViolations =
    governedSigningAuthority?.status === 'needs-input'
      ? governedSigningAuthority.reasons.map((message) => ({
          rule: 'governed_signing_needs_input',
          message,
          severity: 'error' as const,
        }))
      : [];
  const result = validateSigning({
    team,
    player,
    contract: payload.contract,
    signedUsing: payload.signedUsing,
    year: currentYear,
    ...(mutationType === 'signFreeAgent'
      ? { asOfDate: asOfDate ?? undefined }
      : {}),
  });

  return formatValidatorResult({
    valid:
      governedOptionSigningResult.valid &&
      governedSigningViolations.length === 0 &&
      result.valid,
    violations: [
      ...governedOptionSigningResult.violations,
      ...governedSigningViolations,
      ...result.violations,
    ],
    warnings:
      mutationType === 'signFreeAgent'
        ? [
            ...governedOptionSigningResult.warnings,
            ...result.warnings,
            ...pipelineWarnings,
          ]
        : result.warnings,
  });
}

function validateRosterAndContractMutation({
  mutationType,
  payload,
  currentState,
  computeResult,
  currentYear,
  asOfDate,
}: {
  mutationType: string;
  payload: MutationPayloadLike;
  currentState: MutationCurrentState;
  computeResult: ComputeResultLike;
  currentYear: number;
  asOfDate?: string | null;
}): StageValidationResult {
  const { team, player } = requireTeamAndPlayerState(
    currentState,
    mutationType
  );

  switch (mutationType) {
    case 'waivePlayer': {
      const result = validateWaive({
        team,
        player,
        stretch: payload.stretch ?? false,
        year: currentYear,
        isGracePeriod: payload.isGracePeriod || false,
        asOfDate: asOfDate ?? undefined,
      });

      return formatValidatorResult({
        valid: result.valid,
        violations: result.violations,
        warnings: result.warnings,
      });
    }

    case 'extendPlayer': {
      const result = validateExtension({
        team,
        player,
        extension: payload.extension,
        year: currentYear,
        asOfDate: asOfDate ?? undefined,
      });

      return formatValidatorResult({
        valid: result.valid,
        violations: result.violations,
        warnings: result.warnings,
      });
    }

    case 'optionDecision': {
      const teamCode = team.teamCode || null;
      const playerId = getPlayerId(player as Parameters<typeof getPlayerId>[0]);
      const updatedTeam = teamCode
        ? computeResult?.teamUpdates?.find(
            (update) => update.teamCode === teamCode
          )?.team
        : null;
      const updatedPlayer = playerId
        ? computeResult?.playerUpdates?.find(
            (update) => update.playerId === playerId
          )?.player
        : null;

      const result = validateOptionDecision({
        originalTeam: team,
        originalPlayer: player,
        updatedTeam,
        updatedPlayer,
        accepted: payload.accepted,
        contractId: payload.contractId,
        targetYear: payload.targetYear,
        currentYear,
      });

      return formatValidatorResult({
        valid: result.valid,
        violations: result.violations,
        warnings: result.warnings,
      });
    }

    case 'renounceRights': {
      const result = validateRenounceRights({
        team,
        player,
      });

      return formatValidatorResult({
        valid: result.valid,
        violations: result.violations,
        warnings: result.warnings,
      });
    }

    default:
      return {
        valid: false,
        error: `Unknown mutation type: ${mutationType}`,
        violations: [
          JSON.stringify({
            rule: 'unknown_type',
            message: `Unknown mutation type: ${mutationType}`,
            severity: 'error',
          }),
        ],
        warnings: [],
      };
  }
}

function resolveOfferSheetResolutionInputs({
  mutationType,
  payload,
  currentState,
}: {
  mutationType: string;
  payload: MutationPayloadLike;
  currentState: MutationCurrentState;
}) {
  const { homeTeam, offeringTeam, offerSheetId } = requireOfferSheetTeamState(
    currentState,
    mutationType
  );

  if (mutationType === 'matchOfferSheet') {
    return {
      action: 'match' as const,
      actingTeamCode: payload.teamCode as string,
      offerSheet: homeTeam.incomingOfferSheets?.find(
        (offerSheetEntry) => offerSheetEntry.id === offerSheetId
      ),
      offerSheetId,
    };
  }

  if (mutationType === 'declineOfferSheet') {
    return {
      action: 'decline' as const,
      actingTeamCode: payload.teamCode as string,
      offerSheet: homeTeam.incomingOfferSheets?.find(
        (offerSheetEntry) => offerSheetEntry.id === offerSheetId
      ),
      offerSheetId,
    };
  }

  const dedupKey = payload.dedupKey as string | null | undefined;
  const homeOfferSheet = findOfferSheetByIdentity(
    homeTeam.incomingOfferSheets,
    offerSheetId,
    dedupKey
  );
  const offeringOfferSheet = findOfferSheetByIdentity(
    offeringTeam.offerSheets,
    offerSheetId,
    dedupKey
  );

  return {
    action: 'finalize' as const,
    actingTeamCode: payload.teamCode as string,
    offerSheetId,
    offerSheet: homeOfferSheet || offeringOfferSheet,
  };
}

function validateOfferSheetResolutionMutation({
  mutationType,
  payload,
  currentState,
  asOfDate,
  pipelineWarnings,
}: {
  mutationType: string;
  payload: MutationPayloadLike;
  currentState: MutationCurrentState;
  asOfDate?: string | null;
  pipelineWarnings: Array<Record<string, unknown>>;
}): StageValidationResult {
  const { action, actingTeamCode, offerSheetId, offerSheet } =
    resolveOfferSheetResolutionInputs({
      mutationType,
      payload,
      currentState,
    });

  if (action === 'finalize' && !offerSheet) {
    return {
      valid: false,
      error: `Offer sheet ${offerSheetId} not found`,
      violations: [
        JSON.stringify({
          rule: 'offer_sheet_not_found',
          message: `Offer sheet ${offerSheetId} not found for finalize action.`,
          severity: 'error',
        }),
      ],
      warnings: pipelineWarnings,
    };
  }

  const result =
    mutationType === 'matchOfferSheet'
      ? validateOfferSheetResolution({
          offerSheet,
          actingTeamCode,
          action: 'match',
          asOfDate: asOfDate ?? undefined,
          resolutionAt:
            typeof payload.offerSheetResolutionAt === 'string'
              ? payload.offerSheetResolutionAt
              : undefined,
        })
      : mutationType === 'declineOfferSheet'
        ? validateOfferSheetResolution({
            offerSheet,
            actingTeamCode,
            action: 'decline',
            asOfDate: asOfDate ?? undefined,
            resolutionAt:
              typeof payload.offerSheetResolutionAt === 'string'
                ? payload.offerSheetResolutionAt
                : undefined,
          })
        : validateOfferSheetResolution({
            offerSheet,
            actingTeamCode,
            action: 'finalize',
            asOfDate: asOfDate ?? undefined,
            resolutionAt:
              typeof payload.offerSheetResolutionAt === 'string'
                ? payload.offerSheetResolutionAt
                : undefined,
          });

  return formatValidatorResult({
    valid: result.valid,
    violations: result.violations,
    warnings: [...result.warnings, ...pipelineWarnings],
  });
}

function validateManualCapMutation({
  mutationType,
  payload,
  pipelineWarnings,
}: {
  mutationType: string;
  payload: MutationPayloadLike;
  pipelineWarnings: Array<Record<string, unknown>>;
}): StageValidationResult {
  if (mutationType === 'setDeadCap') {
    const result = validateDeadCap(payload.deadCap);

    return {
      valid: result.violations.length === 0,
      error: getPrimaryError(result.violations),
      violations: stringifyViolations(result.violations),
      warnings: pipelineWarnings,
    };
  }

  if (mutationType === 'setExceptions') {
    const result = validateExceptions(payload.exceptions);

    return {
      valid: result.violations.length === 0,
      error: getPrimaryError(result.violations),
      violations: stringifyViolations(result.violations),
      warnings: [...(result.warnings || []), ...pipelineWarnings],
    };
  }

  return {
    valid: false,
    error: `Unknown mutation type: ${mutationType}`,
    violations: [
      JSON.stringify({
        rule: 'unknown_type',
        message: `Unknown mutation type: ${mutationType}`,
        severity: 'error',
      }),
    ],
    warnings: [],
  };
}

export function validateNonTradeMutationStage({
  mutationType,
  payload,
  currentState,
  computeResult,
  seasonId,
  asOfDate,
  dateDefaulted,
  worldId,
}: {
  mutationType: string;
  payload: MutationPayloadLike;
  currentState: MutationCurrentState;
  computeResult: ComputeResultLike;
  seasonId: string;
  asOfDate?: string | null;
  dateDefaulted?: boolean;
  worldId?: string | null;
}): StageValidationResult {
  const salaryCapYear =
    mutationType === 'signFreeAgent'
      ? toStrictSalaryCapYear(seasonId)
      : toEndYear(seasonId);
  if (mutationType === 'signFreeAgent' && salaryCapYear === null) {
    const message =
      'The signing Salary Cap Year could not be derived. No changes were saved.';
    return {
      valid: false,
      error: message,
      violations: [
        JSON.stringify({
          rule: 'governed_signing_salary_cap_year_missing',
          message,
          severity: 'error',
        }),
      ],
      warnings: [],
    };
  }
  const currentYear = salaryCapYear ?? new Date().getFullYear();
  const pipelineWarnings = buildPipelineWarnings({
    asOfDate,
    dateDefaulted,
  });
  const rosterBooksResult = validateReconciledRosterBooks(
    mutationType,
    computeResult,
    currentState
  );
  if (rosterBooksResult) return rosterBooksResult;

  switch (mutationType) {
    case 'signFreeAgent':
    case 'storeOfferSheet':
      return validateSigningSideMutation({
        mutationType,
        payload,
        currentState,
        currentYear,
        asOfDate,
        worldId,
        dateDefaulted,
        pipelineWarnings,
      });

    case 'waivePlayer':
    case 'extendPlayer':
    case 'optionDecision':
    case 'renounceRights':
      return validateRosterAndContractMutation({
        mutationType,
        payload,
        currentState,
        computeResult,
        currentYear,
        asOfDate,
      });

    case 'matchOfferSheet':
    case 'declineOfferSheet':
    case 'finalizeMatchedOfferSheet':
    case 'finalizeDeclinedOfferSheet':
      return validateOfferSheetResolutionMutation({
        mutationType,
        payload,
        currentState,
        asOfDate,
        pipelineWarnings,
      });

    case 'setDeadCap':
    case 'setExceptions':
      return validateManualCapMutation({
        mutationType,
        payload,
        pipelineWarnings,
      });

    default:
      console.warn(
        `Unknown mutation type: ${mutationType}, blocking for safety`
      );
      return {
        valid: false,
        error: `Unknown mutation type: ${mutationType}`,
        violations: [
          JSON.stringify({
            rule: 'unknown_type',
            message: `Unknown mutation type: ${mutationType}`,
            severity: 'error',
          }),
        ],
        warnings: [],
      };
  }
}
