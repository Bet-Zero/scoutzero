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
import { toEndYear } from '@/features/architect/utils/seasonFormat';
import type {
  ArchitectMutationOfferSheet,
  ComputeResultLike,
  MutationCurrentState,
  MutationPayloadLike,
} from '@/features/architect/utils/mutationPipeline';

type StageValidationResult = {
  valid: boolean;
  error?: string | null;
  violations?: string[];
  warnings?: unknown[];
};

type CurrentStateWithTeam = MutationCurrentState & {
  team: NonNullable<MutationCurrentState['team']>;
};

type CurrentStateWithTeamAndPlayer = CurrentStateWithTeam & {
  player: NonNullable<MutationCurrentState['player']>;
};

type CurrentStateWithOfferSheetTeams = MutationCurrentState & {
  homeTeam: NonNullable<MutationCurrentState['homeTeam']>;
  offeringTeam: NonNullable<MutationCurrentState['offeringTeam']>;
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
  warnings?: unknown[];
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
  pipelineWarnings,
}: {
  mutationType: string;
  payload: MutationPayloadLike;
  currentState: MutationCurrentState;
  currentYear: number;
  asOfDate?: string | null;
  pipelineWarnings: unknown[];
}): StageValidationResult {
  const { team, player } = requireTeamAndPlayerState(currentState, mutationType);
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
    valid: result.valid,
    violations: result.violations,
    warnings:
      mutationType === 'signFreeAgent'
        ? [...result.warnings, ...pipelineWarnings]
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
  const { team, player } = requireTeamAndPlayerState(currentState, mutationType);

  switch (mutationType) {
    case 'waivePlayer': {
      const result = validateWaive({
        team,
        player,
        stretch: payload.stretch,
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
      });

      return formatValidatorResult({
        valid: result.valid,
        violations: result.violations,
        warnings: result.warnings,
      });
    }

    case 'optionDecision': {
      const teamCode = team.teamCode || null;
      const playerId = getPlayerId(
        player as Parameters<typeof getPlayerId>[0]
      );
      const updatedTeam = teamCode
        ? computeResult?.teamUpdates?.find((update) => update.teamCode === teamCode)
            ?.team
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
  pipelineWarnings: unknown[];
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
        })
      : mutationType === 'declineOfferSheet'
        ? validateOfferSheetResolution({
            offerSheet,
            actingTeamCode,
            action: 'decline',
            asOfDate: asOfDate ?? undefined,
          })
        : validateOfferSheetResolution({
            offerSheet,
            actingTeamCode,
            action: 'finalize',
            asOfDate: asOfDate ?? undefined,
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
  pipelineWarnings: unknown[];
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
}: {
  mutationType: string;
  payload: MutationPayloadLike;
  currentState: MutationCurrentState;
  computeResult: ComputeResultLike;
  seasonId: string;
  asOfDate?: string | null;
  dateDefaulted?: boolean;
}): StageValidationResult {
  const currentYear = toEndYear(seasonId) ?? new Date().getFullYear();
  const pipelineWarnings = buildPipelineWarnings({
    asOfDate,
    dateDefaulted,
  });

  switch (mutationType) {
    case 'signFreeAgent':
    case 'storeOfferSheet':
      return validateSigningSideMutation({
        mutationType,
        payload,
        currentState,
        currentYear,
        asOfDate,
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
