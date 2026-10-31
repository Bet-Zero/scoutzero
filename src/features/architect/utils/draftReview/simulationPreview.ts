/** Same preparation and post-state preview as the existing trade journey. */
import {
  prepareRetainedDraftSimulation,
  verifyDraftReviewApply,
} from '@/features/architect/utils/draftReview/capability';
import { loadStateForMutation } from '@/features/architect/utils/mutationPipeline.read.stateLoader';
import {
  buildTradeApplyPreparation,
  getTradePreviewAuthority,
} from '@/features/architect/utils/tradeContext';
import type { ApplyWorldMutationArgs } from '@/features/architect/utils/mutationPipeline.types.ingress';

export type DraftSimulationHandoff = { operationId: string; authority: object };
export async function previewRetainedDraftSimulation(
  args: ApplyWorldMutationArgs
) {
  const result = await prepareRetainedDraftSimulation(args);
  if (result.status !== 'prepared') return result;
  const state = await loadStateForMutation(
    args.worldId,
    'executeTrade',
    args.payload
  );
  verifyDraftReviewApply(result.authority, {
    ...args,
    state,
    operationId: args.operationId!,
    asOfDate: String(args.payload.asOfDate),
  });
  const payload = { ...args.payload, teams: args.payload.teams ?? [] };
  const currentState = {
    ...state,
    teams: (state.teams ?? []).map((t) => ({
      ...t,
      teamCode: t.teamCode ?? null,
      team: { ...t.team },
    })),
  };
  const preparation = buildTradeApplyPreparation({
    draftReviewAuthority: result.authority,
    payload,
    currentState,
    seasonId: args.seasonId,
    timestamp: Date.now(),
    trustedWorldLineage: [args.worldId],
  });
  const preview = getTradePreviewAuthority({
    payload,
    currentState,
    seasonId: args.seasonId,
    preparation,
  });
  return {
    ...result,
    preview,
    details: {
      ...(preparation.validatedContext._rawValidation ?? {}),
      teamResults: preparation.validatedContext.teamResults,
      override: {
        requested: false,
        enabled: false,
        appliedToLegality: false,
        message: null,
      },
      hasDataIssues: false,
      dataWarnings: [],
    },
  };
}
