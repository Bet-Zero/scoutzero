import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers';
// Phase 14.2: Removed ensurePickId import (legacy picks state removed)
// Phase 16.3: Removed all rawPicks/picksWithIds processing - draft assets are entitlements-only
import {
  computeTradeDraftKey,
  isValidationCurrent,
} from '@/features/architect/tradeMachine/utils/computeTradeDraftKey';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';
// Wave 14 Step 1: player ops extracted to useTradeMachinePlayerOps.ts
import { useTradeMachinePlayerOps } from './useTradeMachinePlayerOps';
// Wave 14 Step 2: entitlement ops extracted to useTradeMachineEntitlementOps.ts
import { useTradeMachineEntitlementOps } from './useTradeMachineEntitlementOps';
// Wave 29 Step 2: init effect extracted to useTradeMachineInit.ts
import { useTradeMachineInit } from './useTradeMachineInit';
// Wave 29 Step 3: team management extracted to useTradeMachineTeamOps.ts
import { useTradeMachineTeamOps } from './useTradeMachineTeamOps';
// Wave 29 Step 4: validation extracted to useTradeMachineValidation.ts
import { useTradeMachineValidation } from './useTradeMachineValidation';
import {
  isUnknownRecord,
  hasTeamSlot,
} from './useTradeMachine.helpers';
// TM_DATAWARN_UI_E1: Data validation utilities
import { extractUsedTpeIds } from '@/features/architect/utils/tradeMachine/utils/tradeExportUtils';
import {
  injectSyntheticSntPlayersIntoTeams,
  clearSyntheticSntPlayersFromTeams,
  hasSyntheticSntPlayers,
} from '@/features/architect/tradeMachine/utils/devSntInjector';

// Wave 14 Step 1: shared types extracted to useTradeMachine.types.ts
import type {
  UnknownRecord,
  TradeMachineTeam,
  TradeMachineTeamSlot,
  TradeMachinePreviewAuthority,
  TradeMachineSnapshotValidationDetails,
} from './useTradeMachine.types';


export const useTradeMachine = (
  primaryTeam: string | null | undefined,
  capProjections: UnknownRecord | null | undefined,
  currentYear: number, // ← season **end-year**, e.g. 2025 for 2024-25
  primaryTeamData: TradeMachineTeam | null = null,
  worldId: string | null = null, // ← optional worldId for world-aware loading
  worldAsOfDate: string | null = null
) => {
  // Main state
  const [teams, setTeams] = useState<TradeMachineTeamSlot[]>([]);
  const [snapshotValidationDetails, setSnapshotValidationDetails] =
    useState<TradeMachineSnapshotValidationDetails | null>(null);
  const [forceTrade, setForceTrade] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // P0-3: Track validation in-flight state for UI loading indicators
  const [isValidating, setIsValidating] = useState(false);
  // Phase 16.3: Track init failure for error surfacing
  const [initError, setInitError] = useState<string | null>(null);
  // TM-1A / TM-3D follow-up: Primary preview authority surface for UI legality
  const [previewAuthority, setPreviewAuthority] =
    useState<TradeMachinePreviewAuthority | null>(null);

  // Stale validation fix: Track which draft configuration was validated
  const lastValidatedDraftKeyRef = useRef<string | null>(null);
  const validatedAtRef = useRef<number | null>(null);
  const lastInitInputsRef = useRef<{
    primaryTeam: string | null | undefined;
    primaryTeamData: TradeMachineTeam | null;
    yearKey: string | number;
    worldId: string | null;
  } | null>(null);

  // Use the selected season end-year everywhere (no hardcoding)
  const yearKey = currentYear;

  // Wave 14 Step 1: player trade operations sub-hook
  const { setPlayerTrade, undoPlayerTrade } = useTradeMachinePlayerOps({
    setTeams,
    yearKey,
  });

  // Wave 14 Step 2: entitlement operations sub-hook
  const {
    toggleEntitlement,
    setEntitlementDestination,
    applyEntitlementOverrideUpdate,
    refreshEntitlements,
  } = useTradeMachineEntitlementOps({ teams, setTeams, worldId });

  // Wave 29 Step 2: init effect sub-hook
  useTradeMachineInit({
    primaryTeam,
    primaryTeamData,
    capProjections,
    yearKey,
    worldId,
    setTeams,
    setInitError,
    lastInitInputsRef,
  });

  // Wave 29 Step 3: team management sub-hook
  const { selectTeam, addTeam, removeTeam } = useTradeMachineTeamOps({
    teams,
    setTeams,
    capProjections,
    yearKey,
    worldId,
  });

  // Stale validation fix: Compute current draft key whenever trade config changes
  const currentDraftKey = useMemo(() => {
    return computeTradeDraftKey({ yearKey, teams });
  }, [yearKey, teams]);

  // Wave 29 Step 4: validation sub-hook
  const { handleValidate } = useTradeMachineValidation({
    teams,
    capProjections,
    yearKey,
    worldId,
    worldAsOfDate,
    forceTrade,
    currentDraftKey,
    setSnapshotValidationDetails,
    setPreviewAuthority,
    setIsValidating,
    setPreviewOpen,
    lastValidatedDraftKeyRef,
    validatedAtRef,
  });

  // Phase 17: Count active teams for multi-team trade detection
  const activeTeamCount = useMemo(() => {
    return teams.filter(hasTeamSlot).length;
  }, [teams]);

  // Memoized calculations
  // Phase 14.2: incomingAssets no longer references picksOut - draft assets are entitlements-only
  // Phase 17: Updated to require toTeamId for 3+ team trades (no broadcast fallback)
  // Phase A5-E1: Updated to require tradeTo for players in 3+ team trades (parity with entitlements)
  const incomingAssets = useMemo(() => {
    const isMultiTeamTrade = activeTeamCount > 2;
    return teams.map((tm, idx) => {
      const players: UnknownRecord[] = [];
      // Phase 14.2: Incoming entitlements derived from entitlementsOut
      const entitlements: UnknownRecord[] = [];
      teams.forEach((t, j) => {
        if (j !== idx && t.team) {
          const sourceTeam = t.team;
          // Phase A5-E1: For 3+ team trades, require explicit tradeTo for players
          // For 2-team trades, allow broadcast fallback (backward compatibility)
          t.sends.forEach((p) => {
            if (isMultiTeamTrade) {
              // 3+ teams: only include if explicitly routed to this team
              if (p.tradeTo === tm.team?.id) {
                players.push({ ...p, fromTeamId: sourceTeam.id });
              }
            } else {
              // 2 teams: allow broadcast fallback for backward compatibility
              if (!p.tradeTo || p.tradeTo === tm.team?.id) {
                players.push({ ...p, fromTeamId: sourceTeam.id });
              }
            }
          });
          // Phase 17: For 3+ team trades, require explicit toTeamId
          // For 2-team trades, allow broadcast fallback (backward compatibility)
          (t.entitlementsOut || []).forEach((e) => {
            if (isMultiTeamTrade) {
              // 3+ teams: only include if explicitly routed to this team
              if (e.toTeamId === tm.team?.id) {
                entitlements.push({ ...e, fromTeamId: sourceTeam.id });
              }
            } else {
              // 2 teams: allow broadcast fallback for backward compatibility
              if (!e.toTeamId || e.toTeamId === tm.team?.id) {
                entitlements.push({ ...e, fromTeamId: sourceTeam.id });
              }
            }
          });
        }
      });
      return { teamId: tm.team?.id, players, entitlements };
    });
  }, [teams, activeTeamCount]);

  const salaryOut = useMemo(
    () => teams.map((t) => getSalaryForYear(t.sends, yearKey)),
    [teams, yearKey]
  );

  // Stale validation fix: Check if validation result is current for this draft
  const hasCurrentValidation = useMemo(() => {
    const teamResults = snapshotValidationDetails?.teamResults;
    return (
      Array.isArray(teamResults) &&
      teamResults.length > 0 &&
      isValidationCurrent(currentDraftKey, lastValidatedDraftKeyRef.current)
    );
  }, [snapshotValidationDetails, currentDraftKey]);

  const hasInjectedDevSntPlayers = useMemo(
    () => hasSyntheticSntPlayers(teams),
    [teams]
  );

  const injectDevSntPlayers = useCallback(() => {
    setTeams(
      (prev) =>
        injectSyntheticSntPlayersIntoTeams(
          prev,
          yearKey
        ) as TradeMachineTeamSlot[]
    );
  }, [yearKey]);

  const clearInjectedDevSntPlayers = useCallback(() => {
    setTeams(
      (prev) =>
        clearSyntheticSntPlayersFromTeams(prev) as TradeMachineTeamSlot[]
    );
  }, []);

  const exportCurrentTrade = useCallback(() => {
    const tradeData = teams.filter(hasTeamSlot).map((t) => {
      const teamId = t.team.id;
      const incomingTeamAssets = incomingAssets.find(
        (a) => a.teamId === teamId
      );
      return {
        teamId,
        outgoingPlayers: t.sends,
        // Phase 14.2: Removed outgoingPicks - draft assets are entitlements-only
        outgoingEntitlements: (t.entitlementsOut || [])
          .map((ent) => decorateEntitlementForTrade(ent))
          .filter(isUnknownRecord),
        incomingPlayers: incomingTeamAssets?.players || [],
        // Phase 14.2: Incoming entitlements derived from entitlementsOut routing
        incomingEntitlements: (incomingTeamAssets?.entitlements || [])
          .map((ent) => decorateEntitlementForTrade(ent))
          .filter(isUnknownRecord),
        usedTradeExceptions: extractUsedTpeIds(t.sends),
      };
    });

    return tradeData;
  }, [teams, incomingAssets]);

  const resetTrade = useCallback(() => {
    setTeams((prev) =>
      // Phase 14.2: Removed picksOut - draft assets are entitlements-only
      (clearSyntheticSntPlayersFromTeams(prev) as TradeMachineTeamSlot[]).map(
        (slot) => ({
          ...slot,
          sends: [] as UnknownRecord[],
          entitlementsOut: [] as UnknownRecord[],
        })
      )
    );
    setSnapshotValidationDetails(null);
    setForceTrade(false);
    setPreviewAuthority(null); // TM-1A / TM-3D: clear preview authority on reset
  }, []);

  return {
    teams,
    previewAuthority,
    snapshotValidationDetails,
    forceTrade,
    previewOpen,
    setPreviewOpen,
    setForceTrade,
    setPlayerTrade,
    // Phase 14.2: Removed togglePick and updatePickField - draft assets are entitlements-only
    // Phase 11.1: Expose entitlement toggle for trading
    toggleEntitlement,
    // Phase 17: Expose destination setter for multi-team entitlement routing
    setEntitlementDestination,
    selectTeam,
    addTeam,
    removeTeam,
    handleValidate,
    exportCurrentTrade,
    undoPlayerTrade,
    resetTrade,
    yearKey,
    incomingAssets,
    salaryOut,
    // Phase 17: Expose active team count for UI destination dropdown logic
    activeTeamCount,
    // TM-4: Expose entitlement override updater for local state refresh
    applyEntitlementOverrideUpdate,
    // TM-VACUUM-E1: Re-resolve entitlements for all active team slots
    refreshEntitlements,
    // P0-3: Expose validation in-flight state for UI loading indicators
    isValidating,
    // Stale validation fix: Expose current draft key state
    currentDraftKey,
    hasCurrentValidation,
    validatedAt: validatedAtRef.current,
    hasInjectedDevSntPlayers,
    injectDevSntPlayers,
    clearInjectedDevSntPlayers,
    // Expose ref getter for validatedAt (needed since ref doesn't trigger re-render)
    getValidatedAt: () => validatedAtRef.current,
    // Phase 16.3: Expose init error for UI error surfacing
    initError,
  };
};
