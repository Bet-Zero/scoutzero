/**
 * Wave 29 Step 3: Team management callbacks extracted from useTradeMachine.ts
 * (lines 234–423 of the pre-extraction file).
 *
 * Owns selectTeam (world-aware load + entitlement resolution),
 * addTeam, and removeTeam (orphan-route cleanup).
 */

import { useCallback } from 'react';
import { loadWorldTeamData } from '@/features/architect/utils/worldTeamData';
import { resolveEntitlementsForTeam } from '@/features/architect/utils/entitlements/entitlementResolver';
import { type PickRuleDoc } from '@/features/architect/utils/entitlements/pickRulesResolver';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import { type TeamEntry } from '@/constants/teamList';
import {
  DEBUG_ENT,
  ENABLE_PICK_RULES,
  resolveBaseTeamLike,
  resolveTeamCodeLike,
  resolvePickRulesForEntitlements,
  augmentTeamWithExceptions,
  getCapTotalsForYear,
} from './useTradeMachine.helpers';
import type {
  UnknownRecord,
  TradeMachineTeam,
  TradeMachineTeamSlot,
} from './useTradeMachine.types';

export type UseTradeMachineTeamOpsParams = {
  teams: TradeMachineTeamSlot[];
  setTeams: React.Dispatch<React.SetStateAction<TradeMachineTeamSlot[]>>;
  capProjections: UnknownRecord | null | undefined;
  yearKey: number;
  worldId: string | null;
};

export type UseTradeMachineTeamOpsResult = {
  selectTeam: (index: number, teamId: string | null) => Promise<void>;
  addTeam: () => void;
  removeTeam: (index: number) => void;
};

export function useTradeMachineTeamOps({
  teams,
  setTeams,
  capProjections,
  yearKey,
  worldId,
}: UseTradeMachineTeamOpsParams): UseTradeMachineTeamOpsResult {
  // Team management
  const selectTeam = useCallback(
    async (index: number, teamId: string | null) => {
      if (!teamId) {
        setTeams((prev) => {
          const newTeams = [...prev];
          newTeams[index] = {
            team: null,
            sends: [],
            // Phase 14.2: Removed picksOut - draft assets are entitlements-only
            entitlementsOut: [],
          };
          return newTeams;
        });
        return;
      }

      const baseTeam = resolveBaseTeamLike(teamId);
      // World-aware loading for secondary teams in trade machine
      const data = (await loadWorldTeamData(
        worldId,
        teamId
      )) as TradeMachineTeam | null;

      if (baseTeam && data) {
        // Phase 16.3: Draft assets are entitlements-only, no legacy picks processing
        const teamObj = {
          ...baseTeam,
          ...data,
          // Phase 65: Use canonical accessor but store in tradeExceptions for runtime compatibility
          tradeExceptions: getTeamTpeList(data),
        } as TradeMachineTeam & Partial<TeamEntry>;

        // Phase 11.4: Load entitlements for secondary teams (slots 1+)
        // Same logic as primary team init, but for any slot
        if (worldId || (data.entitlementIds && data.entitlementIds.length)) {
          try {
            const resolvedTeamCode = resolveTeamCodeLike(baseTeam, data);
            if (DEBUG_ENT) {
              console.log('[DEBUG_ENT] selectTeam slot:', {
                slotIndex: index,
                teamId,
                teamCode: resolvedTeamCode,
                worldId,
                hasEntitlementIds: Boolean(data.entitlementIds?.length),
              });
            }
            if (resolvedTeamCode) {
              const entitlements = await resolveEntitlementsForTeam(
                worldId,
                resolvedTeamCode
              );
              teamObj.entitlements = entitlements;

              // Phase 12.3B: Fetch pick rules for entitlements
              let pickRulesById: Record<string, PickRuleDoc> = {};
              if (ENABLE_PICK_RULES) {
                pickRulesById =
                  await resolvePickRulesForEntitlements(entitlements);
              }
              teamObj.pickRulesById = pickRulesById;

              if (DEBUG_ENT) {
                console.log('[DEBUG_ENT] selectTeam resolved:', {
                  slotIndex: index,
                  teamCode: resolvedTeamCode,
                  entitlementsCount: entitlements?.length ?? 0,
                  pickRulesCount: Object.keys(pickRulesById).length,
                  usingLegacyFallback: false,
                });
              }
            } else {
              console.warn(
                `[selectTeam] Could not resolve team code for slot ${index}`
              );
              teamObj.entitlements = [];
              teamObj.pickRulesById = {};
            }
          } catch (err) {
            console.warn(
              `[selectTeam] Failed to resolve entitlements for slot ${index}:`,
              err
            );
            teamObj.entitlements = [];
            teamObj.pickRulesById = {};
          }
        } else {
          // No worldId and no entitlementIds - use legacy picks fallback
          if (DEBUG_ENT) {
            console.log('[DEBUG_ENT] selectTeam legacy fallback:', {
              slotIndex: index,
              teamId,
              reason: 'no worldId and no entitlementIds',
              usingLegacyFallback: true,
            });
          }
          teamObj.entitlements = [];
          teamObj.pickRulesById = {};
        }

        augmentTeamWithExceptions(teamObj, yearKey, capProjections);

        // === Baseline payroll wiring on select (SSOT) ===
        const {
          playersTotal: baseline,
          deadMoneyTotal: dead,
          totalWithDead,
        } = getCapTotalsForYear(teamObj, yearKey);
        teamObj.teamTotalSalary = totalWithDead;
        teamObj.projectedSalary = totalWithDead;

        // LOG B) After computing payroll in selectTeam()
        console.log(
          '[select payroll SSOT]',
          teamObj.nickname || teamObj.teamName || teamObj.id,
          {
            year: yearKey,
            baseline,
            dead,
            teamTotalSalary: teamObj.teamTotalSalary,
            projectedSalary: teamObj.projectedSalary,
          }
        );

        setTeams((prev) => {
          const newTeams = [...prev];
          newTeams[index] = {
            team: teamObj,
            sends: [],
            // Phase 14.2: Removed picksOut - draft assets are entitlements-only
            entitlementsOut: [],
          };
          return newTeams;
        });
      }
    },
    [capProjections, yearKey, worldId]
  );

  const addTeam = useCallback(() => {
    if (teams.length >= 5) return;
    setTeams((prev) => [
      ...prev,
      // Phase 14.2: Removed picksOut - draft assets are entitlements-only
      { team: null, sends: [], entitlementsOut: [] },
    ]);
  }, [teams.length]);

  // Phase A5-E1: Updated removeTeam to clean up orphaned routes
  // When removing a team, clear tradeTo/toTeamId for any assets that were routed to that team
  const removeTeam = useCallback((index: number) => {
    setTeams((prev) => {
      // Get the id of the team being removed (to clean up orphan routes)
      const removedTeamId = prev[index]?.team?.id || null;

      // Filter out the removed team
      const filteredTeams = prev.filter((_, i) => i !== index);

      // If no removedTeamId, just return filtered teams (team slot had no selection)
      if (!removedTeamId) return filteredTeams;

      // Clean up orphan routes: clear tradeTo/toTeamId pointing to the removed team
      return filteredTeams.map((teamSlot) => {
        // Clean sends: clear tradeTo if it points to removed team
        const cleanedSends = (teamSlot.sends || []).map((player) => {
          if (player.tradeTo === removedTeamId) {
            return { ...player, tradeTo: undefined };
          }
          return player;
        });

        // Clean entitlementsOut: clear toTeamId if it points to removed team
        const cleanedEntitlements = (teamSlot.entitlementsOut || []).map(
          (entitlement) => {
            if (entitlement.toTeamId === removedTeamId) {
              return { ...entitlement, toTeamId: undefined };
            }
            return entitlement;
          }
        );

        return {
          ...teamSlot,
          sends: cleanedSends,
          entitlementsOut: cleanedEntitlements,
        };
      });
    });
  }, []);

  return { selectTeam, addTeam, removeTeam };
}
