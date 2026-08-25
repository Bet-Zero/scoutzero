import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { validateSignAndTradeContractPayload } from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
import type {
  UnknownRecord,
  TradeMachinePlayer,
  TradeMachineActionMeta,
  TradeMachineTeamSlot,
} from './useTradeMachine.types';

export interface UseTradeMachinePlayerOpsParams {
  setTeams: Dispatch<SetStateAction<TradeMachineTeamSlot[]>>;
  yearKey: number;
}

export function useTradeMachinePlayerOps({
  setTeams,
  yearKey,
}: UseTradeMachinePlayerOpsParams) {
  // Core trade actions
  const setPlayerTrade = useCallback(
    (
      index: number,
      player: TradeMachinePlayer,
      action: string,
      destTeamId: string | null = null,
      actionMeta: TradeMachineActionMeta | null = null
    ) => {
      setTeams((prev) => {
        const newTeams = [...prev];
        const team = newTeams[index];
        const playerId = player.id || player.player_id;
        const playerIndex = team.sends.findIndex(
          (p) => (p.id || p.player_id) === playerId
        );

        switch (action) {
          case 'trade':
            if (playerIndex === -1) {
              newTeams[index].sends = [
                ...team.sends,
                {
                  ...player,
                  tradeTo: destTeamId,
                  signAndTrade: false,
                  signAndTradeContract: undefined,
                },
              ];
            } else {
              newTeams[index].sends[playerIndex] = {
                ...newTeams[index].sends[playerIndex],
                tradeTo: destTeamId,
                signAndTrade: false,
                signAndTradeContract: undefined,
              };
            }
            break;

          case 'signAndTrade':
            {
              const validation = validateSignAndTradeContractPayload(
                actionMeta?.signAndTradeContract || null,
                yearKey,
                { requireActiveYearRow: true }
              );

              if (!destTeamId || !validation.valid || !validation.contract) {
                return prev;
              }

              const signAndTradePatch = {
                tradeTo: destTeamId,
                receivingTeamId: actionMeta?.destinationTeamCode,
                signAndTrade: true,
                signAndTradeContract: validation.contract,
                contractYears: validation.contract.contractYears,
                firstYearGuaranteed: validation.contract.firstYearGuaranteed,
                governedSignAndTradeProposal:
                  actionMeta?.governedSignAndTradeProposal,
              };

              if (playerIndex === -1) {
                newTeams[index].sends = [
                  ...team.sends,
                  { ...player, ...signAndTradePatch },
                ];
              } else {
                newTeams[index].sends[playerIndex] = {
                  ...newTeams[index].sends[playerIndex],
                  ...signAndTradePatch,
                };
              }
            }
            break;

          case 'keep':
            newTeams[index].sends = team.sends.filter(
              (p) => (p.id || p.player_id) !== playerId
            );
            break;

          case 'setAbsorptionMode':
            // destTeamId is actually the absorptionMode value ('MATCH', 'TPE', 'FA_EXCEPTION')
            // For incoming players, find the sending team and update the player there
            {
              const absorptionMode = destTeamId;
              // First check if player is in this team's sends
              if (playerIndex !== -1) {
                newTeams[index].sends[playerIndex] = {
                  ...newTeams[index].sends[playerIndex],
                  absorptionMode,
                };
              } else {
                // Player is incoming - find which team is sending them and update there
                for (let i = 0; i < newTeams.length; i++) {
                  const otherTeam = newTeams[i];
                  const otherPlayerIdx = otherTeam.sends.findIndex(
                    (p) => (p.id || p.player_id) === playerId
                  );
                  if (otherPlayerIdx !== -1) {
                    newTeams[i].sends[otherPlayerIdx] = {
                      ...newTeams[i].sends[otherPlayerIdx],
                      absorptionMode,
                    };
                    break;
                  }
                }
              }
            }
            break;

          case 'setFaBucket':
            // Similar to setAbsorptionMode - destTeamId is the bucket type value
            {
              const bucketType = destTeamId;
              if (playerIndex !== -1) {
                newTeams[index].sends[playerIndex] = {
                  ...newTeams[index].sends[playerIndex],
                  bucketType,
                };
              } else {
                for (let i = 0; i < newTeams.length; i++) {
                  const otherTeam = newTeams[i];
                  const otherPlayerIdx = otherTeam.sends.findIndex(
                    (p) => (p.id || p.player_id) === playerId
                  );
                  if (otherPlayerIdx !== -1) {
                    newTeams[i].sends[otherPlayerIdx] = {
                      ...newTeams[i].sends[otherPlayerIdx],
                      bucketType,
                    };
                    break;
                  }
                }
              }
            }
            break;

          case 'setTpeId':
            // Set specific TPE ID on player (destTeamId is actually the tpeId)
            {
              const tpeId = destTeamId;
              if (playerIndex !== -1) {
                const current = newTeams[index].sends[playerIndex];
                newTeams[index].sends[playerIndex] = {
                  ...current,
                  tpeId,
                  // Only force into TPE mode if a TPE is explicitly selected.
                  // If clearing TPE (tpeId=''), leave mode as-is (likely already 'TPE')
                  absorptionMode: tpeId ? 'TPE' : current.absorptionMode,
                };
              } else {
                for (let i = 0; i < newTeams.length; i++) {
                  const otherTeam = newTeams[i];
                  const otherPlayerIdx = otherTeam.sends.findIndex(
                    (p) => (p.id || p.player_id) === playerId
                  );
                  if (otherPlayerIdx !== -1) {
                    const current = newTeams[i].sends[otherPlayerIdx];
                    newTeams[i].sends[otherPlayerIdx] = {
                      ...current,
                      tpeId,
                      absorptionMode: tpeId ? 'TPE' : current.absorptionMode,
                    };
                    break;
                  }
                }
              }
            }
            break;
        }

        return newTeams;
      });
    },
    [yearKey]
  );

  const undoPlayerTrade = useCallback((player: UnknownRecord) => {
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        sends: t.sends.filter(
          (p) => (p.id || p.player_id) !== (player.id || player.player_id)
        ),
      }))
    );
  }, []);

  return { setPlayerTrade, undoPlayerTrade };
}
