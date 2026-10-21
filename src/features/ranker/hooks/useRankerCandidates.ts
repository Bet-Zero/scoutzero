/**
 * FILE: src/features/ranker/hooks/useRankerCandidates.ts
 * PURPOSE: Shape every loaded player for the ranker's add-player drawer and filter panel, plus an id lookup
 * OWNERSHIP: Feature: ranker
 *
 * HISTORY:
 *  - 2026-10-21: Extracted from RankingBuilder.tsx
 *
 * LINKS:
 *  - Used in: src/features/ranker/RankingBuilder.tsx
 */
import { useMemo } from 'react';
import { POSITION_MAP } from '@/shared/utils/roles';
import { findSalaryForYear } from '@/features/roster/utils';
import type { RosterDrawerPlayer } from '@/features/roster/utils';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';

export const useRankerCandidates = (allPlayers: readonly unknown[]) => {
  const processedPlayers = useMemo<Array<RosterDrawerPlayer<RosterManagerPlayer>>>(
    () =>
      allPlayers.map((rawPlayer) => {
        const player = rawPlayer as RosterManagerPlayer;
        const contractValues = player.contracts
          ? Object.values(player.contracts).filter(Boolean)
          : [];
        const contractData =
          player.primaryContract ||
          contractValues[0] ||
          null;

        return {
          id: player.id,
          player_id: player.id,
          name: (player.bio?.displayName || player.name || '').toLowerCase(),
          team: String(player.bio?.display?.team || '').toLowerCase(),
          position:
            player.formattedPosition ||
            POSITION_MAP[player.bio?.position || ''] ||
            player.bio?.position ||
            '',
          offenseRoles: [
            player.offenseRole?.toLowerCase() || '',
            player.primaryEvaluation?.roles?.offense2?.toLowerCase() || '',
          ],
          defenseRoles: [
            player.defenseRole?.toLowerCase() || '',
            player.primaryEvaluation?.roles?.defense2?.toLowerCase() || '',
          ],
          offenseSubroles: player.subRoles?.offense || [],
          defenseSubroles: player.subRoles?.defense || [],
          shootingProfile: (player.shootingProfile || '').toLowerCase(),
          badges: player.badges || [],
          salary: findSalaryForYear(player) ?? undefined,
          freeAgentYear:
            player.bio?.display?.freeAgentYear?.toString() ||
            contractData?.freeAgency?.freeAgentYear?.toString() ||
            null,
          freeAgentType: (
            player.bio?.display?.freeAgentType ||
            contractData?.freeAgency?.freeAgentType ||
            ''
          ).toLowerCase(),
          contractType: (contractData?.contractType || '').toLowerCase(),
          extension: (() => {
            const extensionContract = contractValues.find(
              (contract) => contract?.isExtension
            );
            return extensionContract
              ? {
                  freeAgentYear:
                    extensionContract.freeAgency?.freeAgentYear ?? null,
                }
              : null;
          })(),
          options: contractData?.options || [],
          original: player,
        };
      }),
    [allPlayers]
  );

  const playersMap = useMemo(() => {
    const map: Record<string, RosterManagerPlayer> = {};
    allPlayers.forEach((rawPlayer) => {
      const player = rawPlayer as RosterManagerPlayer;
      map[player.id] = player;
    });
    return map;
  }, [allPlayers]);


  return { processedPlayers, playersMap };
};
