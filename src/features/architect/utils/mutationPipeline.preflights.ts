/**
 * Wave 47 Step 1: computeWorldMutation and preflight functions extracted
 * from mutationPipeline.ts (lines 793–1137).
 *
 * Exports computeWorldMutation, preflightSignAndTradeMutation,
 * preflightOfferSheetMutation.
 */

import { toEndYear } from '@/features/architect/utils/seasonFormat';
import { validateSigning } from '@/features/architect/utils/capLegalityValidation';
import {
  isSupportedComputeMutationType,
  normalizeComputeWorldMutationArgs,
  computeNormalizedWorldMutation,
} from './mutationPipeline.normalize';
import {
  requireDestinationState,
  requireSigningState,
} from './mutationPipeline.helpers';
import {
  sanitizePayloadForOverride,
  withDefaultPlayerDeletes,
  loadStateForMutation,
  loadWorldAsOfDate,
  resolveWorldAsOfDate,
  validateSignAndTradeSigningPhase,
  summarizeSignAndTradeAuthority,
  dedupeMessages,
  getErrorMessage,
  AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
} from './mutationPipeline.read';
import type {
  ArchitectMutationContract,
  ArchitectMutationPayload,
  ComputeResultLike,
  MutationPayloadLike,
  OfferSheetPreflightResult,
  PublicComputeWorldMutationArgs,
  SignAndTradePreflightResult,
} from './mutationPipeline.types';
import type { GovernedOfferSheetProposal } from '@/schemas/governedOfferSheet';

/**
 * Compute mutation result without side effects.
 * This function is PURE - no Firestore, no Date.now(), deterministic output.
 */
export function computeWorldMutation(
  args: PublicComputeWorldMutationArgs
): ComputeResultLike {
  const mutationType = String(args?.mutationType || '');
  if (!isSupportedComputeMutationType(mutationType)) {
    return withDefaultPlayerDeletes({
      success: false,
      error: `Unknown mutation type: ${mutationType}`,
    });
  }

  return computeNormalizedWorldMutation(
    normalizeComputeWorldMutationArgs(args)
  );
}

export async function preflightSignAndTradeMutation({
  worldId,
  seasonId,
  payload,
  timestamp = Date.now(),
}: {
  worldId: string;
  seasonId: string;
  payload: ArchitectMutationPayload;
  timestamp?: number;
}): Promise<SignAndTradePreflightResult> {
  if (!worldId) {
    return {
      status: 'blocked',
      reasons: ['Sign-and-trade requires an active world to commit.'],
      warnings: [],
      source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
    };
  }

  if (!seasonId) {
    return {
      status: 'incomplete',
      reasons: [
        'Authoritative sign-and-trade preflight is missing season context.',
      ],
      warnings: [],
      source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
    };
  }

  const sanitizedPayload = sanitizePayloadForOverride(
    payload
  ) as MutationPayloadLike;
  if (!sanitizedPayload.destinationTeamCode) {
    return {
      status: 'blocked',
      reasons: ['Destination team is required for sign-and-trade.'],
      warnings: [],
      source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
    };
  }

  if (
    !sanitizedPayload.teamCode ||
    !sanitizedPayload.playerId ||
    !sanitizedPayload.contract
  ) {
    return {
      status: 'blocked',
      reasons: ['Cannot complete sign-and-trade: contract payload is invalid.'],
      warnings: [],
      source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
    };
  }

  try {
    const currentState = await loadStateForMutation(
      worldId,
      'signAndTrade',
      sanitizedPayload
    );
    const { team, player } = requireDestinationState(
      currentState,
      'signAndTrade'
    );
    const signingValidation = validateSignAndTradeSigningPhase({
      team,
      player,
      contract: sanitizedPayload.contract,
      signedUsing: sanitizedPayload.signedUsing,
      seasonId,
    });

    if (!signingValidation.valid) {
      const summary = summarizeSignAndTradeAuthority({
        signingValidation,
        tradeValidation: null,
      });

      return {
        status: summary.status,
        reasons: summary.reasons,
        warnings: summary.warnings,
        source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
      };
    }

    const worldAsOfDate = await loadWorldAsOfDate(worldId);
    const { asOfDate } = resolveWorldAsOfDate({
      payloadAsOfDate:
        sanitizedPayload.asOfDate != null
          ? String(sanitizedPayload.asOfDate)
          : null,
      worldAsOfDate,
    });
    const computeResult = computeWorldMutation({
      mutationType: 'signAndTrade',
      payload: sanitizedPayload,
      currentState,
      seasonId,
      timestamp,
      asOfDate,
      worldId,
    });

    if (!computeResult.success) {
      return {
        status: 'incomplete',
        reasons: [
          String(
            computeResult.error ||
              'Authoritative sign-and-trade preflight failed before legality could be determined.'
          ),
        ],
        warnings: dedupeMessages(
          Array.isArray(computeResult.warnings) ? computeResult.warnings : []
        ),
        source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
      };
    }

    const summary = summarizeSignAndTradeAuthority({
      signingValidation: computeResult._signingValidation || signingValidation,
      tradeValidation: computeResult._validatedTradeContext || null,
    });

    return {
      status: summary.status,
      reasons: summary.reasons,
      warnings: summary.warnings,
      source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
    };
  } catch (error) {
    return {
      status: 'incomplete',
      reasons: [
        getErrorMessage(error) ||
          'Authoritative sign-and-trade preflight failed before legality could be determined.',
      ],
      warnings: [],
      source: AUTHORITATIVE_SAT_PREFLIGHT_SOURCE,
    };
  }
}

export async function preflightOfferSheetMutation({
  worldId,
  seasonId,
  offeringTeamCode,
  playerId,
  contract,
  offerSheetProposal,
  timestamp = Date.now(),
}: {
  worldId: string;
  seasonId: string;
  offeringTeamCode: string;
  playerId: string;
  contract: ArchitectMutationContract;
  offerSheetProposal?: GovernedOfferSheetProposal;
  timestamp?: number;
}): Promise<OfferSheetPreflightResult> {
  const source = AUTHORITATIVE_SAT_PREFLIGHT_SOURCE;

  if (!worldId) {
    return {
      status: 'blocked',
      reasons: ['Offer sheet requires an active world to commit.'],
      warnings: [],
      source,
    };
  }

  if (!seasonId) {
    return {
      status: 'incomplete',
      reasons: [
        'Authoritative offer sheet preflight is missing season context.',
      ],
      warnings: [],
      source,
    };
  }

  if (!offeringTeamCode) {
    return {
      status: 'blocked',
      reasons: ['Offering team is required for offer sheet.'],
      warnings: [],
      source,
    };
  }

  if (!playerId) {
    return {
      status: 'incomplete',
      reasons: [
        'Authoritative offer sheet preflight is missing player context.',
      ],
      warnings: [],
      source,
    };
  }

  if (!contract) {
    return {
      status: 'blocked',
      reasons: ['Cannot complete offer sheet: contract payload is invalid.'],
      warnings: [],
      source,
    };
  }

  // Ensure offer-sheet flags are set; computeStoreOfferSheetResult hard-fails without them.
  const preflightContract: ArchitectMutationContract = {
    ...contract,
    rfaOfferSheet: true,
    rfaOfferSheetOnly: true,
    rfaOfferSheetStatus: contract.rfaOfferSheetStatus || 'PENDING_MATCH',
    contractType: 'Offer Sheet',
  };

  const payload: ArchitectMutationPayload = {
    teamCode: offeringTeamCode,
    playerId,
    contract: preflightContract,
    offerSheetProposal,
    signedUsing: contract.exceptionType ?? null,
  };

  try {
    // loadStateForMutation('storeOfferSheet') calls resolveStoreOfferSheetAuthority (E5):
    // scans world lineage snapshots, resolves authoritative home team, fails closed on ambiguity.
    const currentState = await loadStateForMutation(
      worldId,
      'storeOfferSheet',
      payload
    );
    const { team, player } = requireSigningState(
      currentState,
      'storeOfferSheet'
    );
    const currentYear = toEndYear(seasonId);
    if (!currentYear) {
      return {
        status: 'incomplete',
        reasons: ['The Offer Sheet Salary Cap Year could not be derived.'],
        warnings: [],
        source,
      };
    }

    // validateSigning with offer-sheet flags routes into the RFA/offer-sheet validation path:
    // validateOfferSheetTerms (years 1–4, raises ≤8%) + offering-team-vs-home-team checks.
    const signingValidation = validateSigning({
      team,
      player,
      contract: preflightContract,
      signedUsing: payload.signedUsing,
      year: currentYear,
    });

    if (!signingValidation.valid) {
      const reasons = dedupeMessages(
        signingValidation.violations.map((v) => v.message)
      );
      const warnMessages = dedupeMessages(
        signingValidation.warnings.map((w) => w.message)
      );
      return {
        status: 'blocked',
        reasons:
          reasons.length > 0 ? reasons : ['Offer sheet validation failed.'],
        warnings: warnMessages,
        source,
      };
    }

    // computeWorldMutation catches pre-compute guardrails: player in home team players[],
    // dedup/worldId checks. Pure compute — does not persist.
    const worldAsOfDate = await loadWorldAsOfDate(worldId);
    const { asOfDate } = resolveWorldAsOfDate({ worldAsOfDate });
    const computeResult = computeWorldMutation({
      mutationType: 'storeOfferSheet',
      payload,
      currentState,
      seasonId,
      timestamp,
      asOfDate,
      worldId,
    });

    if (!computeResult.success) {
      return {
        status: 'blocked',
        reasons: [
          String(
            computeResult.error ||
              'Offer sheet would be rejected by authoritative validation.'
          ),
        ],
        warnings: dedupeMessages(
          Array.isArray(computeResult.warnings) ? computeResult.warnings : []
        ),
        source,
      };
    }

    const warnings = dedupeMessages([
      ...signingValidation.warnings.map((w) => w.message),
      ...(Array.isArray(computeResult.warnings) ? computeResult.warnings : []),
    ]);

    return { status: 'legal', reasons: [], warnings, source };
  } catch (error) {
    return {
      status: 'incomplete',
      reasons: [
        getErrorMessage(error) ||
          'Authoritative offer sheet preflight failed before legality could be determined.',
      ],
      warnings: [],
      source,
    };
  }
}
