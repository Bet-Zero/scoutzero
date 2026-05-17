import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { loadWorldTeamData } from '@/features/architect/utils/worldTeamData';
import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers';
// Phase 14.2: Removed ensurePickId import (legacy picks state removed)
// Phase 16.3: Removed all rawPicks/picksWithIds processing - draft assets are entitlements-only
import { toSeasonKey } from '@/features/architect/utils/seasonFormat';
import {
  computeTradeDraftKey,
  isValidationCurrent,
} from '@/features/architect/tradeMachine/utils/computeTradeDraftKey';
import { resolveEntitlementsForTeam } from '@/features/architect/utils/entitlements/entitlementResolver';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';
import {
  type PickRuleDoc,
} from '@/features/architect/utils/entitlements/pickRulesResolver';
// Wave 14 Step 1: player ops extracted to useTradeMachinePlayerOps.ts
import { useTradeMachinePlayerOps } from './useTradeMachinePlayerOps';
// Wave 14 Step 2: entitlement ops extracted to useTradeMachineEntitlementOps.ts
import { useTradeMachineEntitlementOps } from './useTradeMachineEntitlementOps';
// Wave 29 Step 2: init effect extracted to useTradeMachineInit.ts
import { useTradeMachineInit } from './useTradeMachineInit';
import {
  DEBUG_ENT,
  ENABLE_PICK_RULES,
  isUnknownRecord,
  hasTeamSlot,
  resolveTeamCodeLike,
  resolvePickRulesForEntitlements,
  asUnknownRecord,
  getErrorMessage,
  resolveBaseTeamLike,
  getCapTotalsForYear,
  augmentTeamWithExceptions,
} from './useTradeMachine.helpers';
// Phase 65: Canonical TPE read accessor
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import { type TeamEntry } from '@/constants/teamList';
// TM_DATAWARN_UI_E1: Data validation utilities
import { validateTradeData } from '@/features/architect/utils/tradeMachine/utils/dataValidation';
import { extractUsedTpeIds } from '@/features/architect/utils/tradeMachine/utils/tradeExportUtils';
import {
  injectSyntheticSntPlayersIntoTeams,
  clearSyntheticSntPlayersFromTeams,
  hasSyntheticSntPlayers,
} from '@/features/architect/tradeMachine/utils/devSntInjector';
import {
  buildTradeApplyPreparation,
  getTradePreviewAuthority,
  type FullLegalityPreviewResult,
} from '@/features/architect/utils/tradeContext/tradeContext';
import type {
  TradeApplyPreparation,
  TradeContextPayload,
  TradeContextCurrentState,
} from '@/features/architect/utils/tradeContext/types';

// Wave 14 Step 1: shared types extracted to useTradeMachine.types.ts
import type {
  UnknownRecord,
  TradeMachinePlayer,
  TradeMachineEntitlement,
  TradeMachineActionMeta,
  TradeMachineTeam,
  TradeMachineTeamSlot,
  EntitlementOverrideDocument,
  TradeMachinePreviewAuthority,
  TradeMachineSnapshotValidationDetails,
  PreparedTradePreviewContext,
  ValidateCurrentTradeOutcome,
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

  // Stale validation fix: Compute current draft key whenever trade config changes
  const currentDraftKey = useMemo(() => {
    return computeTradeDraftKey({ yearKey, teams });
  }, [yearKey, teams]);

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


  // Phase 14.2: togglePick, updatePickField removed - draft assets are entitlements-only

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
            // Clear the orphan route - player will need re-routing
            return { ...player, tradeTo: undefined };
          }
          return player;
        });

        // Clean entitlementsOut: clear toTeamId if it points to removed team
        const cleanedEntitlements = (teamSlot.entitlementsOut || []).map(
          (entitlement) => {
            if (entitlement.toTeamId === removedTeamId) {
              // Clear the orphan route - entitlement will need re-routing
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

  const buildCurrentTradePreviewContext =
    useCallback((): PreparedTradePreviewContext | null => {
      const patchedTeams = teams.map((teamSlot) => {
        if (!teamSlot.team) {
          return teamSlot;
        }

        if (
          !Number.isFinite(teamSlot.team.teamTotalSalary) ||
          teamSlot.team.teamTotalSalary === 0
        ) {
          const { totalWithDead } = getCapTotalsForYear(teamSlot.team, yearKey);
          return {
            ...teamSlot,
            team: {
              ...teamSlot.team,
              teamTotalSalary: totalWithDead,
              projectedSalary: totalWithDead,
            },
          };
        }

        return teamSlot;
      });
      const activeTeams = patchedTeams.filter(hasTeamSlot);

      if (activeTeams.length < 2) {
        return null;
      }

      const seasonId = toSeasonKey(yearKey) ?? String(yearKey);
      const payload: TradeContextPayload = {
        teams: activeTeams.map((slot) => ({
          teamCode: String(slot.team.teamCode || slot.team.id || ''),
          teamId: String(slot.team.id || slot.team.teamCode || ''),
          sends: slot.sends,
          entitlementsOut: slot.entitlementsOut || [],
        })),
        capProjections: capProjections as TradeContextPayload['capProjections'],
        tradeCtx: {
          worldId: worldId ?? undefined,
          yearKey,
          source: 'tradeMachine',
          ...(worldAsOfDate ? { asOfDate: worldAsOfDate } : {}),
        },
      };
      const currentState: TradeContextCurrentState = {
        teams: activeTeams.map((slot) => ({
          teamCode: String(slot.team.teamCode || slot.team.id || '') || null,
          team: slot.team,
        })),
      };

      return {
        activeTeams,
        payload,
        currentState,
        seasonId,
        preparation: buildTradeApplyPreparation({
          payload,
          currentState,
          seasonId,
          timestamp: Date.now(),
        }),
      };
    }, [teams, capProjections, yearKey, worldId, worldAsOfDate]);

  // Core validation function - extracted for reuse
  // P0-3: Wraps validation with isValidating state for UI loading indicators
  const validateCurrentTrade =
    useCallback((): ValidateCurrentTradeOutcome | null => {
      const previewContext = buildCurrentTradePreviewContext();
      if (!previewContext) {
        setSnapshotValidationDetails(null);
        setPreviewAuthority(null); // TM-1A / TM-3D: clear stale preview authority
        // P0-3: Clear isValidating since no validation will run (not enough teams)
        // This is intentional - if we don't have enough teams, there's nothing to validate
        setIsValidating(false);
        return null;
      }

      // P0-3: Set validating state before validation runs
      setIsValidating(true);

      try {
        const { activeTeams, preparation } = previewContext;

        console.log(
          '[validate -> teams payroll]',
          activeTeams.map((teamSlot) => ({
            team:
              teamSlot.team.nickname || teamSlot.team.name || teamSlot.team.id,
            teamTotalSalary: teamSlot.team.teamTotalSalary,
            projectedSalary: teamSlot.team.projectedSalary,
          }))
        );

        const validation = asUnknownRecord(
          preparation.validatedContext._rawValidation ||
            preparation.validatedContext
        ) as UnknownRecord & {
          teamResults?: UnknownRecord[] | null;
          violations?: unknown[];
          warnings?: unknown[];
          reason?: unknown;
          error?: unknown;
        };
        // TM_DATAWARN_UI_E1: Validate data quality for all players in trade
        const allPlayers = activeTeams.flatMap(
          (teamSlot) => teamSlot.sends || []
        );
        const dataValidation = validateTradeData(
          allPlayers,
          yearKey
        ) as UnknownRecord & {
          hasIssues?: boolean;
          warnings?: unknown[];
          summary?: unknown;
        };

        // Environment flag to enable force trade bypass
        // In production (canOverride=false), forceTrade has no effect
        const canOverride = import.meta.env.VITE_ENABLE_CBA_OVERRIDE === 'true';

        const snapshotValidationDetails: TradeMachineSnapshotValidationDetails =
          {
            summaryByTeamIndex: Array.isArray(validation.summaryByTeamIndex)
              ? validation.summaryByTeamIndex
              : [],
            teamResults: Array.isArray(validation.teamResults)
              ? validation.teamResults
              : preparation.validatedContext.teamResults,
            capSettings: validation.capSettings ?? null,
            tradeReceipt: validation.tradeReceipt ?? null,
            override: {
              requested: Boolean(forceTrade),
              enabled: canOverride,
              appliedToLegality: false,
              message: forceTrade
                ? canOverride
                  ? 'Force-trade was requested, but authoritative legality remains unchanged.'
                  : 'Force-trade was requested, but override is disabled in this environment.'
                : null,
            },
            // TM_DATAWARN_UI_E1: Attach data warnings to snapshot detail payload
            hasDataIssues: dataValidation.hasIssues,
            dataWarnings: dataValidation.warnings,
            dataValidationSummary: dataValidation.summary,
          };

        setSnapshotValidationDetails(snapshotValidationDetails);

        console.log(
          '[after validate]',
          (Array.isArray(validation.teamResults)
            ? validation.teamResults
            : []
          ).map((teamResult) => {
            const result = asUnknownRecord(teamResult);
            const team = asUnknownRecord(result.team);
            const preTradeStatus = asUnknownRecord(result.preTradeStatus);
            const postTradeStatus = asUnknownRecord(result.postTradeStatus);

            return {
              team: team.nickname || team.name || team.id,
              pre: preTradeStatus.projectedSalary,
              post: postTradeStatus.projectedSalary,
              apron: postTradeStatus.isAtOrAboveSecondApron,
            };
          })
        );

        return { snapshotValidationDetails, previewContext };
      } catch (error) {
        console.error(
          '[useTradeMachine] validateCurrentTrade unexpected error:',
          error
        );
        setSnapshotValidationDetails(null);
        setPreviewAuthority(null);
        return null;
      } finally {
        // P0-3: Clear validating state after validation completes
        setIsValidating(false);
      }
    }, [buildCurrentTradePreviewContext, yearKey, forceTrade, worldAsOfDate]);

  // REMOVED: Auto-validation effect was causing stale "Validated" state
  // Validation now ONLY happens when user clicks "Validate Trade" (explicit action)
  // See: docs/tradeMachine/return-packages/RP_validation_state_stale_fix_*.md

  // Manual validation trigger - the ONLY way validation should happen
  const handleValidate = useCallback(() => {
    const validationOutcome = validateCurrentTrade();
    if (validationOutcome) {
      const { previewContext } = validationOutcome;

      // Stale validation fix: Record the draft key that was validated
      lastValidatedDraftKeyRef.current = currentDraftKey;
      validatedAtRef.current = Date.now();

      try {
        const previewAuthority = getTradePreviewAuthority({
          payload: previewContext.payload,
          currentState: previewContext.currentState,
          seasonId: previewContext.seasonId,
          preparation: previewContext.preparation,
        });
        setPreviewAuthority(previewAuthority);
      } catch (err) {
        console.error(
          '[useTradeMachine] getTradePreviewAuthority unexpected error:',
          err
        );
        setPreviewAuthority(null);
      }

      setPreviewOpen(true);
    }
  }, [validateCurrentTrade, currentDraftKey]);

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
