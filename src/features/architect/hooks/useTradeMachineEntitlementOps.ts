import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';
import { resolveEntitlementsForTeam } from '@/features/architect/utils/entitlements/entitlementResolver';
import type {
  UnknownRecord,
  TradeMachineTeamSlot,
} from './useTradeMachine.types';
import {
  isUnknownRecord,
  hasTeamSlot,
  deepMergeEntitlement,
  resolveTeamCodeLike,
  resolvePickRulesForEntitlements,
  ENABLE_PICK_RULES,
} from './useTradeMachine.helpers';

export interface UseTradeMachineEntitlementOpsParams {
  teams: TradeMachineTeamSlot[];
  setTeams: Dispatch<SetStateAction<TradeMachineTeamSlot[]>>;
  worldId: string | null;
}

export function useTradeMachineEntitlementOps({
  teams,
  setTeams,
  worldId,
}: UseTradeMachineEntitlementOpsParams) {
  // Phase 11.1: Toggle entitlement selection for trading
  // Phase 17: Updated to auto-set toTeamId for 2-team trades (closure of broadcast bug)
  const toggleEntitlement = useCallback(
    (index: number, entitlement: UnknownRecord) => {
      setTeams((prev) => {
        const newTeams = [...prev];
        const entitlementId = entitlement.id || entitlement.entitlementId;
        const existingIndex = (newTeams[index].entitlementsOut || []).findIndex(
          (e) => (e.id || e.entitlementId) === entitlementId
        );

        if (existingIndex >= 0) {
          // Remove from selection
          newTeams[index].entitlementsOut = newTeams[
            index
          ].entitlementsOut.filter((_, i) => i !== existingIndex);
        } else {
          // Phase 17: Count active teams (teams with a selected team object)
          const activeTeams = newTeams.filter(hasTeamSlot);
          const activeTeamCount = activeTeams.length;

          // Phase 17: For 2-team trades, auto-set toTeamId to the only other team
          // For 3+ team trades, leave toTeamId null (UI must prompt user to select)
          let autoToTeamId = null;
          if (activeTeamCount === 2) {
            // Find the other team's id
            const otherTeam = activeTeams.find(
              (t) => t.team?.id !== newTeams[index].team?.id
            );
            autoToTeamId = otherTeam?.team?.id || null;
          }

          // Add to selection with required metadata
          const decoratedEntitlement = decorateEntitlementForTrade({
            ...entitlement,
            entitlementId,
            fromTeamId: newTeams[index].team?.id,
            toTeamId: autoToTeamId, // Phase 17: Auto-set for 2-team, null for 3+
          });
          if (!isUnknownRecord(decoratedEntitlement)) {
            return newTeams;
          }
          newTeams[index].entitlementsOut = [
            ...(newTeams[index].entitlementsOut || []),
            decoratedEntitlement,
          ];
        }

        return newTeams;
      });
    },
    []
  );

  // Phase 17: Set destination team for an entitlement in 3+ team trades
  const setEntitlementDestination = useCallback(
    (fromTeamIndex: number, entitlementId: string, toTeamId: string | null) => {
      setTeams((prev) => {
        const newTeams = [...prev];
        const entitlementsOut = newTeams[fromTeamIndex].entitlementsOut || [];
        const entIdx = entitlementsOut.findIndex(
          (e) => (e.id || e.entitlementId) === entitlementId
        );

        if (entIdx >= 0) {
          newTeams[fromTeamIndex].entitlementsOut = entitlementsOut.map(
            (e, i) => (i === entIdx ? { ...e, toTeamId } : e)
          );
        }

        return newTeams;
      });
    },
    []
  );

  const applyEntitlementOverrideUpdate = useCallback(
    (entitlementId: string, document: UnknownRecord) => {
      if (!entitlementId || !document) return;

      const normalizedDoc: UnknownRecord = { ...document, id: entitlementId };
      const affectedIndexes: number[] = [];

      const updatedTeams = teams.map((slot, index) => {
        if (!slot.team) return slot;
        const slotTeam = slot.team;

        let entitlementsChanged = false;
        let updatedEntitlements = (slotTeam.entitlements || []).map((ent) => {
          const entId = ent.id || ent.entitlementId;
          if (entId !== entitlementId) return ent;
          entitlementsChanged = true;
          const merged = deepMergeEntitlement(ent, normalizedDoc);
          return { ...merged, id: entitlementId };
        });

        // TM-VACUUM-E1: If no existing entitlement matched (new vacuum create),
        // append the document to the entitlements list so it appears immediately.
        if (!entitlementsChanged) {
          const holderTeam =
            normalizedDoc.holderTeam || normalizedDoc.holder_team;
          const teamCode = slotTeam.teamCode || slotTeam.id;
          if (holderTeam && holderTeam === teamCode) {
            updatedEntitlements = [...updatedEntitlements, normalizedDoc];
            entitlementsChanged = true;
          }
        }

        if (entitlementsChanged) {
          affectedIndexes.push(index);
        }

        const updatedEntitlementsOut = (slot.entitlementsOut || [])
          .map((ent) => {
            const entId = ent.id || ent.entitlementId;
            if (entId !== entitlementId) return ent;
            const merged = deepMergeEntitlement(ent, normalizedDoc);
            return decorateEntitlementForTrade({
              ...merged,
              id: entitlementId,
              entitlementId: entitlementId,
            });
          })
          .filter(isUnknownRecord);

        return {
          ...slot,
          team: entitlementsChanged
            ? { ...slotTeam, entitlements: updatedEntitlements }
            : slotTeam,
          entitlementsOut: updatedEntitlementsOut,
        };
      });

      setTeams(updatedTeams as TradeMachineTeamSlot[]);

      if (!ENABLE_PICK_RULES || affectedIndexes.length === 0) return;

      const refreshPickRules = async () => {
        const updates = await Promise.all(
          affectedIndexes.map(async (index) => {
            const slot = updatedTeams[index];
            if (!slot?.team?.entitlements) return null;
            const pickRulesById = await resolvePickRulesForEntitlements(
              slot.team.entitlements
            );
            return { index, pickRulesById };
          })
        );

        setTeams((prev) =>
          prev.map((slot, index) => {
            const update = updates.find((u) => u && u.index === index);
            if (!update) return slot;
            return {
              ...slot,
              team: {
                ...slot.team,
                pickRulesById: update.pickRulesById,
              },
            };
          })
        );
      };

      refreshPickRules();
    },
    [teams]
  );

  // TM-VACUUM-E1: Re-resolve entitlements for all active team slots.
  // Used after clearing vacuum overlay to revert to base state.
  const refreshEntitlements = useCallback(async () => {
    const updatedTeams = await Promise.all(
      teams.map(async (slot) => {
        if (!slot.team) return slot;
        try {
          const teamCode = resolveTeamCodeLike(slot.team, slot.team);
          if (!teamCode) return slot;
          const entitlements = await resolveEntitlementsForTeam(
            worldId,
            teamCode
          );
          let pickRulesById = slot.team.pickRulesById || {};
          if (ENABLE_PICK_RULES) {
            pickRulesById = await resolvePickRulesForEntitlements(entitlements);
          }
          return {
            ...slot,
            team: { ...slot.team, entitlements, pickRulesById },
          };
        } catch (err) {
          console.warn('[refreshEntitlements] failed for team:', err);
          return slot;
        }
      })
    );
    setTeams(updatedTeams);
  }, [teams, worldId]);

  return {
    toggleEntitlement,
    setEntitlementDestination,
    applyEntitlementOverrideUpdate,
    refreshEntitlements,
  };
}
