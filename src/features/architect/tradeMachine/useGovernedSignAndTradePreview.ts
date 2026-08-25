import { useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';
import { loadStateForMutation } from '@/features/architect/utils/mutationPipeline';
import type { ArchitectMutationPayload } from '@/features/architect/utils/mutationPipeline';
import { buildGovernedSignAndTradeAuthority } from '@/features/architect/utils/tradeMachine/signAndTrade/governedSignAndTrade';
import type { GovernedSignAndTradeAuthority } from '@/schemas/governedSignAndTrade';
import type { TradeMachineTeamSlot } from '@/features/architect/hooks/useTradeMachine.types';

type GovernedPreviewValidation = (
  authority?: GovernedSignAndTradeAuthority | null
) => 'insufficient' | 'started';

export function useGovernedSignAndTradePreview({
  teams,
  worldId,
  userId,
  worldAsOfDate,
  yearKey,
  validate,
}: {
  teams: TradeMachineTeamSlot[];
  worldId: string | null;
  userId: string | null;
  worldAsOfDate: string | null;
  yearKey: number;
  validate: GovernedPreviewValidation;
}) {
  const [isPreparingGovernedPreview, setIsPreparingGovernedPreview] =
    useState(false);

  const handleValidateTrade = useCallback(async () => {
    if (isPreparingGovernedPreview) return;
    const signAndTradePlayers = teams.flatMap((slot) =>
      (slot.sends || [])
        .filter((player) => player.signAndTrade === true)
        .map((player) => ({ player }))
    );
    if (signAndTradePlayers.length === 0) {
      const status = validate();
      if (status === 'insufficient') {
        toast.error('Add at least two teams to validate this trade.');
      }
      return;
    }
    if (
      signAndTradePlayers.length !== 1 ||
      !worldId ||
      !userId ||
      !worldAsOfDate
    ) {
      toast.error(
        'Governed sign-and-trade preview requires one player and an active dated saved world.'
      );
      return;
    }

    setIsPreparingGovernedPreview(true);
    try {
      const activeTeams = teams.filter((slot) => Boolean(slot.team));
      if (activeTeams.some((slot) => (slot.entitlementsOut || []).length > 0)) {
        throw new Error(
          'The governed V1 sign-and-trade route excludes draft entitlements.'
        );
      }
      const payload: ArchitectMutationPayload = {
        teams: activeTeams.map((slot) => ({
          teamCode: String(slot.team?.teamCode || slot.team?.id || ''),
          sends: (slot.sends || []).map((player) => ({
            ...player,
            id: player.id == null ? null : String(player.id),
            playerId: player.playerId == null ? null : String(player.playerId),
            player_id:
              player.player_id == null ? null : String(player.player_id),
            originTeamId:
              player.originTeamId == null ? null : String(player.originTeamId),
            tpeId: player.tpeId == null ? null : String(player.tpeId),
          })),
          entitlementsOut: [],
          salaryMatchingElection: slot.salaryMatchingElection ?? null,
        })),
        asOfDate: worldAsOfDate,
        tradeCtx: {
          source: 'tradeMachine',
          worldId,
          asOfDate: worldAsOfDate,
          tradeDate: worldAsOfDate,
          yearKey,
          offseason: true,
        },
      };
      const currentState = await loadStateForMutation(
        worldId,
        'executeTrade',
        payload
      );
      if (!currentState.governedSignAndTradeEvidence) {
        throw new Error(
          'Live saved-world sign-and-trade evidence is unavailable.'
        );
      }
      const { player } = signAndTradePlayers[0];
      const recordedAt = new Date().toISOString();
      const authority = buildGovernedSignAndTradeAuthority({
        evidence: currentState.governedSignAndTradeEvidence,
        contract: player.signAndTradeContract,
        proposal: player.governedSignAndTradeProposal,
        operationId: `sign-and-trade-preview:${Date.now()}`,
        authoringIdentity: userId,
        recordedAt,
      });
      const status = validate(authority);
      if (status === 'insufficient') {
        toast.error('Add at least two teams to validate this trade.');
      }
    } catch (error) {
      console.error(
        '[TradeEditor] Governed sign-and-trade preview failed:',
        error
      );
      toast.error(
        error instanceof Error
          ? error.message
          : 'Governed sign-and-trade authority could not be loaded.'
      );
    } finally {
      setIsPreparingGovernedPreview(false);
    }
  }, [
    isPreparingGovernedPreview,
    teams,
    userId,
    validate,
    worldAsOfDate,
    worldId,
    yearKey,
  ]);

  return { handleValidateTrade, isPreparingGovernedPreview };
}
