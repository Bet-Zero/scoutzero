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
import { resolveTeamCode } from './worldTeamData';
import type { ArchitectMutationPayload } from './mutationPipeline';

export async function prepareGovernedDraftWorldPreview(
  proposal: TradeContextPayload,
  seasonId: string
) {
  // Validate the same payload Apply submits: a governed world uses its own
  // date and the league cap levels, never the page's cap projections.
  const payload = { ...proposal };
  delete payload.capProjections;
  // Route players by team code, exactly as the Apply handoff does.
  const codes = payload.teams.map((t) => String(t.teamCode));
  payload.teams = payload.teams.map((team) => ({
    ...team,
    ...(team.sends?.length
      ? {
          sends: team.sends.map((player) => {
            const raw =
              player.receivingTeamId ??
              player.tradeTo ??
              player.toTeamId ??
              player.destTeamId;
            const to =
              raw == null
                ? undefined
                : resolveTeamCode(String(raw)) || String(raw);
            const routed = {
              ...player,
              playerId: player.playerId ?? player.id ?? player.player_id,
              tradeTo: to,
              receivingTeamId: to,
              receivingTeamIndex: to == null ? undefined : codes.indexOf(to),
            };
            delete routed.toTeamId;
            delete routed.destTeamId;
            return routed;
          }),
        }
      : {}),
  }));
  const worldId = payload.tradeCtx?.worldId;
  if (typeof worldId !== 'string' || !worldId) return null;
  const metadata = (await getDoc(worldMetadataRef(worldId))).data();
  if (!metadata?.draftBaseline) return null;
  const userId = auth.currentUser?.uid;
  if (!userId)
    throw new Error('Sign in to validate a saved-world draft trade.');
  // Players are checked by the governed review (identity, unchanged Contract,
  // exact salary basis) and by the ordinary trade validators.
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
