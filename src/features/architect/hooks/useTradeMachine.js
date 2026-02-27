import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import { loadWorldTeamData } from '@/features/architect/utils/worldTeamData';
import { getSalaryForYear } from '@/features/architect/utils/tradeHelpers';
// Phase 14.2: Removed ensurePickId import (legacy picks state removed)
// Phase 16.3: Removed all rawPicks/picksWithIds processing - draft assets are entitlements-only
import { TeamMap } from '@/constants/teamList';
import { toSeasonKey } from '@/features/architect/utils/seasonFormat';
import {
  computeTradeDraftKey,
  isValidationCurrent,
} from '@/features/architect/tradeMachine/utils/computeTradeDraftKey';
import { computeTeamCapTotals } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { resolveEntitlementsForTeam } from '@/features/architect/utils/entitlements/entitlementResolver';
import { decorateEntitlementForTrade } from '@/features/architect/utils/entitlements/entitlementTerms';
import {
  resolvePickRulesByIds,
  pickRulesMapToObject,
} from '@/features/architect/utils/entitlements/pickRulesResolver';
import { validateSignAndTradeContractPayload } from '@/features/architect/utils/tradeMachine/signAndTrade/signAndTradeEligibility';
// Phase 65: Canonical TPE read accessor
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
// TM_DATAWARN_UI_E1: Data validation utilities
import { validateTradeData } from '@/features/architect/utils/tradeMachine/utils/dataValidation';
import { extractUsedTpeIds } from '@/features/architect/utils/tradeMachine/utils/tradeExportUtils';

/* ============================
   DEBUG FLAG & TEAM CODE RESOLUTION
   ============================ */

/**
 * Enable debug logging for entitlements resolution.
 * Set VITE_DEBUG_ENTITLEMENTS=true in environment to enable.
 */
const DEBUG_ENT = Boolean(import.meta?.env?.VITE_DEBUG_ENTITLEMENTS);

/**
 * Phase 12.3B: Feature flag for pick rules fetching.
 * Set VITE_ENABLE_PICK_RULES=false to disable. Default: enabled.
 */
const ENABLE_PICK_RULES = import.meta?.env?.VITE_ENABLE_PICK_RULES !== 'false';

/**
 * Resolve a valid 3-letter team code from various team object shapes.
 * Returns the code (e.g., "LAL") or null if unable to resolve.
 */
function resolveTeamCodeLike(teamObjOrId, teamDataMaybe = null) {
  // Prefer teamData.teamCode if present
  if (teamDataMaybe?.teamCode) {
    return teamDataMaybe.teamCode;
  }
  // Else if teamData.id is exactly length 3, use that
  if (typeof teamDataMaybe?.id === 'string' && teamDataMaybe.id.length === 3) {
    return teamDataMaybe.id;
  }
  // Else if teamObjOrId is exactly length 3, use that (string id passed directly)
  if (typeof teamObjOrId === 'string' && teamObjOrId.length === 3) {
    return teamObjOrId;
  }
  // Else attempt teamObjOrId.code if 3 chars (from TeamMap entry)
  if (typeof teamObjOrId?.code === 'string' && teamObjOrId.code.length === 3) {
    return teamObjOrId.code;
  }
  // Else attempt teamObjOrId.abbreviation if 3 chars
  if (
    typeof teamObjOrId?.abbreviation === 'string' &&
    teamObjOrId.abbreviation.length === 3
  ) {
    return teamObjOrId.abbreviation;
  }
  // Else attempt teamObjOrId.id if 3 chars
  if (typeof teamObjOrId?.id === 'string' && teamObjOrId.id.length === 3) {
    return teamObjOrId.id;
  }
  // Else attempt teamData.team?.id if 3 chars
  if (
    typeof teamDataMaybe?.team?.id === 'string' &&
    teamDataMaybe.team.id.length === 3
  ) {
    return teamDataMaybe.team.id;
  }
  // Could not resolve
  if (DEBUG_ENT) {
    console.warn(
      '[DEBUG_ENT] resolveTeamCodeLike: could not resolve team code',
      { teamObjOrId, teamDataMaybe }
    );
  }
  return null;
}

const isPlainObjectValue = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const deepMergeEntitlement = (base, override) => {
  if (!isPlainObjectValue(base) || !isPlainObjectValue(override)) {
    return { ...base, ...override };
  }
  const merged = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    const baseValue = base[key];
    if (isPlainObjectValue(baseValue) && isPlainObjectValue(value)) {
      merged[key] = deepMergeEntitlement(baseValue, value);
      return;
    }
    merged[key] = value;
  });
  return merged;
};

/* ============================
   PICK RULES RESOLUTION (Phase 12.3B)
   ============================ */

/**
 * Extract unique pickIds from entitlements for pick rules lookup.
 * Collects underlyingPickId, poolUnderlyingPickIds, and swapControllerPickId.
 */
const extractPickIdsFromEntitlements = (entitlements) => {
  if (!Array.isArray(entitlements) || entitlements.length === 0) return [];

  const pickIds = new Set();
  for (const ent of entitlements) {
    if (ent.underlyingPickId) pickIds.add(ent.underlyingPickId);
    if (Array.isArray(ent.poolUnderlyingPickIds)) {
      ent.poolUnderlyingPickIds.forEach((id) => id && pickIds.add(id));
    }
    if (ent.swapControllerPickId) pickIds.add(ent.swapControllerPickId);
  }
  return Array.from(pickIds);
};

/**
 * Resolve pick rules for a team's entitlements.
 * Returns plain object keyed by pickId for passing to projection layer.
 */
const resolvePickRulesForEntitlements = async (entitlements) => {
  const pickIds = extractPickIdsFromEntitlements(entitlements);
  if (pickIds.length === 0) return {};

  try {
    const rulesMap = await resolvePickRulesByIds(pickIds);
    return pickRulesMapToObject(rulesMap);
  } catch (err) {
    console.warn('[resolvePickRulesForEntitlements] Error:', err);
    return {};
  }
};

/* ============================
   SSOT WIRING
   ============================ */

/**
 * Convenience wrapper to get baseline payroll + dead money from SSOT.
 * Returns { playersTotal, deadMoneyTotal, totalWithDead } from computeTeamCapTotals.
 */
const getCapTotalsForYear = (teamCapSheet, yearKey) => {
  if (!teamCapSheet)
    return { playersTotal: 0, deadMoneyTotal: 0, totalWithDead: 0 };
  const totals = computeTeamCapTotals(teamCapSheet, yearKey);
  return {
    playersTotal: totals.playersTotal,
    deadMoneyTotal: totals.deadMoneyTotal,
    totalWithDead: totals.playersTotal + totals.deadMoneyTotal,
  };
};

/* ============================
   Helpers: FA buckets & test TPE seeding
   ============================ */

/**
 * Pull MLE/Room MLE/BAE values from capProjections using the **season end-year**.
 */
function getMLEBAEForYear(endYear, capProjections) {
  if (!capProjections) return { fullMLE: 0, roomMLE: 0, bae: 0 };

  const key = toSeasonKey(endYear); // e.g., 2025 -> "2024-25"
  const fromComposite = capProjections?.[key] || {};
  const fromNumeric = capProjections?.[endYear] || {};
  const src = Object.keys(fromComposite).length ? fromComposite : fromNumeric;

  return {
    fullMLE: src.fullMLE ?? src.mle ?? 0,
    roomMLE: src.roomMLE ?? src.rmle ?? 0,
    bae: src.bae ?? 0,
  };
}

/**
 * Mutates team to add FA exception buckets and (optionally) seed test TPEs if missing.
 */
function augmentTeamWithExceptions(team, endYear, capProjections) {
  if (!team) return team;

  // Seed FA buckets if not present
  if (!Array.isArray(team.faExceptionBuckets)) {
    const { fullMLE, roomMLE, bae } = getMLEBAEForYear(endYear, capProjections);
    const buckets = [];
    if (fullMLE > 0)
      buckets.push({ type: 'NTMLE', remaining: fullMLE, expiresAt: null });
    if (roomMLE > 0)
      buckets.push({ type: 'RMLE', remaining: roomMLE, expiresAt: null });
    if (bae > 0) buckets.push({ type: 'BAE', remaining: bae, expiresAt: null });
    if (buckets.length) team.faExceptionBuckets = buckets;
  }

  // Seed a couple of test TPEs for sandboxing if none exist
  // Phase 65: Use canonical TPE accessor for reading, but write to tradeExceptions
  // for internal sandbox state (not persisted - this is runtime-only)
  const existingTpes = getTeamTpeList(team);
  if (existingTpes.length === 0) {
    team.tradeExceptions = [
      {
        id: `${team.id}-tpe-a`,
        name: 'Test TPE A',
        amount: 6_500_000,
        expiresOn: null,
      },
      {
        id: `${team.id}-tpe-b`,
        name: 'Test TPE B',
        amount: 2_800_000,
        expiresOn: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 30
        ).toISOString(),
      },
    ];
  }

  return team;
}

export const useTradeMachine = (
  primaryTeam,
  capProjections,
  currentYear, // ← season **end-year**, e.g. 2025 for 2024-25
  primaryTeamData = null,
  worldId = null // ← optional worldId for world-aware loading
) => {
  // Main state
  const [teams, setTeams] = useState([]);
  const [result, setResult] = useState(null);
  const [forceTrade, setForceTrade] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // P0-3: Track validation in-flight state for UI loading indicators
  const [isValidating, setIsValidating] = useState(false);
  // Phase 16.3: Track init failure for error surfacing
  const [initError, setInitError] = useState(null);

  // Stale validation fix: Track which draft configuration was validated
  const lastValidatedDraftKeyRef = useRef(null);
  const validatedAtRef = useRef(null);

  // Use the selected season end-year everywhere (no hardcoding)
  const yearKey = currentYear;

  // Phase 17: Count active teams for multi-team trade detection
  const activeTeamCount = useMemo(() => {
    return teams.filter((t) => t.team).length;
  }, [teams]);

  // Memoized calculations
  // Phase 14.2: incomingAssets no longer references picksOut - draft assets are entitlements-only
  // Phase 17: Updated to require toTeamId for 3+ team trades (no broadcast fallback)
  // Phase A5-E1: Updated to require tradeTo for players in 3+ team trades (parity with entitlements)
  const incomingAssets = useMemo(() => {
    const isMultiTeamTrade = activeTeamCount > 2;
    return teams.map((tm, idx) => {
      const players = [];
      // Phase 14.2: Incoming entitlements derived from entitlementsOut
      const entitlements = [];
      teams.forEach((t, j) => {
        if (j !== idx && t.team) {
          // Phase A5-E1: For 3+ team trades, require explicit tradeTo for players
          // For 2-team trades, allow broadcast fallback (backward compatibility)
          t.sends.forEach((p) => {
            if (isMultiTeamTrade) {
              // 3+ teams: only include if explicitly routed to this team
              if (p.tradeTo === tm.team?.id) {
                players.push({ ...p, fromTeamId: t.team.id });
              }
            } else {
              // 2 teams: allow broadcast fallback for backward compatibility
              if (!p.tradeTo || p.tradeTo === tm.team?.id) {
                players.push({ ...p, fromTeamId: t.team.id });
              }
            }
          });
          // Phase 17: For 3+ team trades, require explicit toTeamId
          // For 2-team trades, allow broadcast fallback (backward compatibility)
          (t.entitlementsOut || []).forEach((e) => {
            if (isMultiTeamTrade) {
              // 3+ teams: only include if explicitly routed to this team
              if (e.toTeamId === tm.team?.id) {
                entitlements.push({ ...e, fromTeamId: t.team.id });
              }
            } else {
              // 2 teams: allow broadcast fallback for backward compatibility
              if (!e.toTeamId || e.toTeamId === tm.team?.id) {
                entitlements.push({ ...e, fromTeamId: t.team.id });
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
    return (
      result?.teamResults?.length > 0 &&
      isValidationCurrent(currentDraftKey, lastValidatedDraftKeyRef.current)
    );
  }, [result, currentDraftKey]);

  // Initialize teams (slot 0 = primary team, slot 1 = empty)
  useEffect(() => {
    const init = async () => {
      if (!primaryTeam) return;

      try {
        // Phase 16.3: Clear any previous init error on new init attempt
        setInitError(null);

        const baseTeam = TeamMap[primaryTeam];
        // Use primaryTeamData if provided (already world-aware from GMDashboard)
        // Otherwise load with world-awareness via loadWorldTeamData
        const data =
          primaryTeamData || (await loadWorldTeamData(worldId, primaryTeam));

        if (baseTeam && data) {
          // Build team object, augment exceptions/tpes
          // Phase 16.3: Draft assets are entitlements-only, no legacy picks processing
          const teamObj = {
            ...baseTeam,
            ...data,
            // Phase 65: Use canonical accessor but store in tradeExceptions for runtime compatibility
            tradeExceptions: getTeamTpeList(data),
          };

          if (worldId || (data.entitlementIds && data.entitlementIds.length)) {
            try {
              const resolvedTeamCode = resolveTeamCodeLike(baseTeam, data);
              if (DEBUG_ENT) {
                console.log('[DEBUG_ENT] init slot 0:', {
                  slotIndex: 0,
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
                let pickRulesById = {};
                if (ENABLE_PICK_RULES) {
                  pickRulesById =
                    await resolvePickRulesForEntitlements(entitlements);
                }
                teamObj.pickRulesById = pickRulesById;

                if (DEBUG_ENT) {
                  console.log('[DEBUG_ENT] init slot 0 resolved:', {
                    teamCode: resolvedTeamCode,
                    entitlementsCount: entitlements?.length ?? 0,
                    pickRulesCount: Object.keys(pickRulesById).length,
                    usingLegacyFallback: false,
                  });
                }
              } else {
                console.warn('[init] Could not resolve team code for slot 0');
                teamObj.entitlements = [];
                teamObj.pickRulesById = {};
              }
            } catch (err) {
              console.warn('Failed to resolve team entitlements:', err);
              teamObj.entitlements = [];
              teamObj.pickRulesById = {};
            }
          }
          augmentTeamWithExceptions(teamObj, yearKey, capProjections);

          // === Baseline payroll wiring (SSOT) ===
          const {
            playersTotal: baseline,
            deadMoneyTotal: dead,
            totalWithDead,
          } = getCapTotalsForYear(teamObj, yearKey);
          teamObj.teamTotalSalary = totalWithDead;
          teamObj.projectedSalary = totalWithDead;

          // LOG A) After computing teamObj.teamTotalSalary in init()
          console.log(
            '[init payroll SSOT]',
            teamObj.nickname || teamObj.name || teamObj.id,
            {
              year: yearKey,
              baseline,
              dead,
              teamTotalSalary: teamObj.teamTotalSalary,
              projectedSalary: teamObj.projectedSalary,
            }
          );

          setTeams([
            {
              team: teamObj,
              sends: [],
              // Phase 14.2: Removed picksOut - draft assets are entitlements-only
              entitlementsOut: [],
            },
            { team: null, sends: [], entitlementsOut: [] },
          ]);
        }
      } catch (err) {
        // Phase 16.3: Surface init failures instead of silent blank UI
        console.error('[tradeMachine:init] failed to init trade teams', err);
        setInitError(
          err.message || 'Unknown error during trade machine initialization'
        );
        // Attempt safe fallback: if primaryTeamData exists, try to set minimal slot0
        if (primaryTeamData) {
          const baseTeam = TeamMap[primaryTeam];
          if (baseTeam) {
            const fallbackTeamObj = {
              ...baseTeam,
              ...primaryTeamData,
              tradeExceptions: getTeamTpeList(primaryTeamData),
              entitlements: [],
              pickRulesById: {},
            };
            setTeams([
              { team: fallbackTeamObj, sends: [], entitlementsOut: [] },
              { team: null, sends: [], entitlementsOut: [] },
            ]);
          }
        }
      }
    };
    init();
  }, [primaryTeam, primaryTeamData, capProjections, yearKey, worldId]);

  // Core trade actions
  const setPlayerTrade = useCallback(
    (index, player, action, destTeamId = null, actionMeta = null) => {
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
                signAndTrade: true,
                signAndTradeContract: validation.contract,
                contractYears: validation.contract.contractYears,
                firstYearGuaranteed: validation.contract.firstYearGuaranteed,
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

  // Phase 14.2: togglePick removed - draft assets are entitlements-only
  // Use toggleEntitlement instead

  // Phase 11.1: Toggle entitlement selection for trading
  // Phase 17: Updated to auto-set toTeamId for 2-team trades (closure of broadcast bug)
  const toggleEntitlement = useCallback((index, entitlement) => {
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
        const activeTeams = newTeams.filter((t) => t.team);
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
        newTeams[index].entitlementsOut = [
          ...(newTeams[index].entitlementsOut || []),
          decorateEntitlementForTrade({
            ...entitlement,
            entitlementId,
            fromTeamId: newTeams[index].team?.id,
            toTeamId: autoToTeamId, // Phase 17: Auto-set for 2-team, null for 3+
          }),
        ];
      }

      return newTeams;
    });
  }, []);

  // Phase 17: Set destination team for an entitlement in 3+ team trades
  const setEntitlementDestination = useCallback(
    (fromTeamIndex, entitlementId, toTeamId) => {
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

  // Phase 14.2: updatePickField removed - draft assets are entitlements-only
  // Protection edits are no longer supported in Trade Machine

  // Team management
  const selectTeam = useCallback(
    async (index, teamId) => {
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

      const baseTeam = TeamMap[teamId];
      // World-aware loading for secondary teams in trade machine
      const data = await loadWorldTeamData(worldId, teamId);

      if (baseTeam && data) {
        // Phase 16.3: Draft assets are entitlements-only, no legacy picks processing
        const teamObj = {
          ...baseTeam,
          ...data,
          // Phase 65: Use canonical accessor but store in tradeExceptions for runtime compatibility
          tradeExceptions: getTeamTpeList(data),
        };

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
              let pickRulesById = {};
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
          teamObj.nickname || teamObj.name || teamObj.id,
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
  const removeTeam = useCallback((index) => {
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

  // Core validation function - extracted for reuse
  // P0-3: Wraps validation with isValidating state for UI loading indicators
  const validateCurrentTrade = useCallback(() => {
    if (teams.filter((t) => t.team).length < 2) {
      setResult(null);
      // P0-3: Clear isValidating since no validation will run (not enough teams)
      // This is intentional - if we don't have enough teams, there's nothing to validate
      setIsValidating(false);
      return null;
    }

    // P0-3: Set validating state before validation runs
    setIsValidating(true);

    // (Optional) last-second safety net: if any team is missing payroll, patch it (SSOT)
    const patchedTeams = teams.map((t) => {
      if (!t.team) return t;
      if (
        !Number.isFinite(t.team.teamTotalSalary) ||
        t.team.teamTotalSalary === 0
      ) {
        const { totalWithDead } = getCapTotalsForYear(t.team, yearKey);
        return {
          ...t,
          team: {
            ...t.team,
            teamTotalSalary: totalWithDead,
            projectedSalary: totalWithDead,
          },
        };
      }
      return t;
    });

    // LOG C) Right before validateTrade(...) in validateCurrentTrade()
    console.log(
      '[validate -> teams payroll]',
      teams.map(
        (t) =>
          t.team && {
            team: t.team.nickname || t.team.name || t.team.id,
            teamTotalSalary: t.team.teamTotalSalary,
            projectedSalary: t.team.projectedSalary,
          }
      )
    );
    const validation = validateTrade({
      teams: patchedTeams
        .filter((t) => t.team)
        .map((t) => ({
          team: t.team,
          sends: t.sends,
          // Phase 14.2: Removed picksOut - draft assets are entitlements-only
          hardCapped: t.team.hardCapped,
          // Phase 12.1: Pass entitlements for Stepien validation
          entitlementsOut: t.entitlementsOut || [],
          // Phase 12.2: Pass team's loaded entitlements for baseline calculation
          validationEntitlements: t.entitlements || [],
        })),
      capProjections,
      currentYear: yearKey,
      // Phase 12.2: Pass worldId and yearKey for validation context
      tradeCtx: {
        worldId,
        yearKey,
        source: 'tradeMachine',
      },
    });

    // TM_DATAWARN_UI_E1: Validate data quality for all players in trade
    const allPlayers = patchedTeams
      .filter((t) => t.team)
      .flatMap((t) => t.sends || []);
    const dataValidation = validateTradeData(allPlayers, yearKey);

    // Environment flag to enable force trade bypass
    // In production (canOverride=false), forceTrade has no effect
    const canOverride = import.meta.env.VITE_ENABLE_CBA_OVERRIDE === 'true';

    const result = {
      ...validation,
      legal: (canOverride && forceTrade) || validation.legal,
      // TM_DATAWARN_UI_E1: Attach data warnings to result
      hasDataIssues: dataValidation.hasIssues,
      dataWarnings: dataValidation.warnings,
      dataValidationSummary: dataValidation.summary,
    };

    setResult(result);
    // P0-3: Clear validating state after validation completes
    setIsValidating(false);

    // Stale validation fix: Record the draft key that was validated
    // This is only set on explicit validation, not auto-validation
    // (Note: Auto-validation has been removed to fix the stale state bug)

    console.log(
      '[after validate]',
      validation.teamResults.map((tr) => ({
        team: tr.team?.nickname || tr.team?.name || tr.team?.id,
        pre: tr.preTradeStatus?.projectedSalary,
        post: tr.postTradeStatus?.projectedSalary,
        apron: tr.postTradeStatus?.isAtOrAboveSecondApron,
      }))
    );

    return result;
  }, [teams, capProjections, yearKey, forceTrade]);

  // REMOVED: Auto-validation effect was causing stale "Validated" state
  // Validation now ONLY happens when user clicks "Validate Trade" (explicit action)
  // See: docs/tradeMachine/return-packages/RP_validation_state_stale_fix_*.md

  // Manual validation trigger - the ONLY way validation should happen
  const handleValidate = useCallback(() => {
    const result = validateCurrentTrade();
    if (result) {
      // Stale validation fix: Record the draft key that was validated
      lastValidatedDraftKeyRef.current = currentDraftKey;
      validatedAtRef.current = Date.now();
      setPreviewOpen(true);
    }
  }, [validateCurrentTrade, currentDraftKey]);

  const exportCurrentTrade = useCallback(() => {
    const tradeData = teams
      .filter((t) => t.team)
      .map((t) => ({
        teamId: t.team.id,
        outgoingPlayers: t.sends,
        // Phase 14.2: Removed outgoingPicks - draft assets are entitlements-only
        outgoingEntitlements: (t.entitlementsOut || [])
          .map((ent) => decorateEntitlementForTrade(ent))
          .filter(Boolean),
        incomingPlayers:
          incomingAssets.find((a) => a.teamId === t.team.id)?.players || [],
        // Phase 14.2: Incoming entitlements derived from entitlementsOut routing
        incomingEntitlements: (
          incomingAssets.find((a) => a.teamId === t.team.id)?.entitlements || []
        )
          .map((ent) => decorateEntitlementForTrade(ent))
          .filter(Boolean),
        usedTradeExceptions: extractUsedTpeIds(t.sends),
      }));

    return tradeData;
  }, [teams, incomingAssets]);

  const resetTrade = useCallback(() => {
    setTeams((prev) =>
      // Phase 14.2: Removed picksOut - draft assets are entitlements-only
      prev.map((t) => ({ ...t, sends: [], entitlementsOut: [] }))
    );
    setResult(null);
    setForceTrade(false);
  }, []);

  const undoPlayerTrade = useCallback((player) => {
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        sends: t.sends.filter(
          (p) => (p.id || p.player_id) !== (player.id || player.player_id)
        ),
      }))
    );
  }, []);

  const applyEntitlementOverrideUpdate = useCallback(
    (entitlementId, document) => {
      if (!entitlementId || !document) return;

      const normalizedDoc = { ...document, id: entitlementId };
      const affectedIndexes = [];

      const updatedTeams = teams.map((slot, index) => {
        if (!slot.team) return slot;

        let entitlementsChanged = false;
        let updatedEntitlements = (slot.team.entitlements || []).map((ent) => {
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
          const teamCode = slot.team.teamCode || slot.team.id;
          if (holderTeam && holderTeam === teamCode) {
            updatedEntitlements = [...updatedEntitlements, normalizedDoc];
            entitlementsChanged = true;
          }
        }

        if (entitlementsChanged) {
          affectedIndexes.push(index);
        }

        const updatedEntitlementsOut = (slot.entitlementsOut || []).map(
          (ent) => {
            const entId = ent.id || ent.entitlementId;
            if (entId !== entitlementId) return ent;
            const merged = deepMergeEntitlement(ent, normalizedDoc);
            return decorateEntitlementForTrade({
              ...merged,
              id: entitlementId,
              entitlementId: entitlementId,
            });
          }
        );

        return {
          ...slot,
          team: entitlementsChanged
            ? { ...slot.team, entitlements: updatedEntitlements }
            : slot.team,
          entitlementsOut: updatedEntitlementsOut,
        };
      });

      setTeams(updatedTeams);

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
    teams,
    result,
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
    // Expose ref getter for validatedAt (needed since ref doesn't trigger re-render)
    getValidatedAt: () => validatedAtRef.current,
    // Phase 16.3: Expose init error for UI error surfacing
    initError,
  };
};
