/** Ordinary Validate button: same loaded state and validators as Apply; no writes. */
import { auth } from '@/firebaseConfig';
import { getDoc } from 'firebase/firestore';
import { worldMetadataRef } from './architectFirestorePaths';
import { loadStateForMutation } from './mutationPipeline.read.stateLoader';
import { toTradeStateSlice } from './mutationPipeline.helpers';
import {
  prepareGovernedDraftWorldCapability,
  verifyDraftReviewApply,
} from './draftReview/capability';
import { buildTradeApplyPreparation } from './tradeContext';
import type { TradeContextPayload } from './tradeContext/types';
import type { ArchitectMutationPayload } from './mutationPipeline';

export async function prepareGovernedDraftWorldPreview(
  payload: TradeContextPayload,
  seasonId: string
) {
  const worldId = payload.tradeCtx?.worldId;
  if (typeof worldId !== 'string' || !worldId) return null;
  const metadata = (await getDoc(worldMetadataRef(worldId))).data();
  if (!metadata?.draftBaseline) return null;
  if (
    payload.teams.some(
      (t) => (t.sends ?? []).length || (t.receives ?? []).length
    )
  )
    throw new Error(
      'This governed draft path does not admit player consideration.'
    );
  const userId = auth.currentUser?.uid;
  if (!userId)
    throw new Error('Sign in to validate a saved-world draft trade.');
  // No player identity conversion occurs: this bounded route has no players.
  const state = await loadStateForMutation(
    worldId,
    'executeTrade',
    payload as ArchitectMutationPayload
  );
  const currentState = toTradeStateSlice(state);
  const operationId = `draft_preview_${crypto.randomUUID()}`;
  const asOfDate = String(metadata.asOfDate);
  const draftReviewAuthority = await prepareGovernedDraftWorldCapability({
    userId,
    worldId,
    seasonId,
    operationId,
    payload,
    state: currentState,
    asOfDate,
  });
  if (!draftReviewAuthority)
    throw new Error('The governed draft baseline disappeared.');
  verifyDraftReviewApply(draftReviewAuthority, {
    userId,
    worldId,
    seasonId,
    operationId,
    payload,
    state,
    asOfDate,
  });
  return {
    payload,
    currentState,
    seasonId,
    preparation: buildTradeApplyPreparation({
      draftReviewAuthority,
      payload,
      currentState,
      seasonId,
      timestamp: Date.now(),
      asOfDate,
      trustedWorldLineage: [worldId],
    }),
  };
}
