/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.contractActions.ts
 * PURPOSE: Sub-hook for contract, cap, DEV fixture, and player action handlers.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Wave 6 Step 5: Extracted from useArchitectActions.ts.
 */

import { useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import type { ArchitectMutationPayload } from '@/features/architect/utils/mutationPipeline';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  getRightsTypeFromPlayer,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import type { ManualExceptionsSavePayload } from '@/features/architect/capSheet/CapSheet/CapSheet';
import type { ArchitectDashboardPlayer } from './useArchitectState';
import {
  clearCapSheetFixtures,
  DEV_CAP_SHEET_FIXTURE_BOUNDARY,
  DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER,
  DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY,
  hasInjectedCapSheetFixtures as hasInjectedCapSheetFixturesInTeam,
  injectCapSheetFixtures,
} from '@/features/architect/capSheet/devCapSheetFixtures';
import {
  clearTeamHistoryFixtures,
  hasInjectedTeamHistoryFixtures as hasInjectedTeamHistoryFixturesInTeam,
  injectTeamHistoryFixtures,
} from '@/features/architect/history/devTeamHistoryFixtures';
import type { ArchitectReceiptActionContext } from '../postActionHandoff/types';
import type { CapSheetModalActionType } from '@/features/architect/capSheet/CapSheetFull/CapSheetFull';
import type { PlayerRulesProfileInput } from '@/features/architect/types';
import type { ActionContext } from './useArchitectModals';
import {
  type FreeAgencyWorldOnlyActionKind,
  type RenounceActionTarget,
  buildYearSeasonContext,
  isCapHoldTarget,
  getRenounceTargetCandidateValues,
  getRenounceTargetDisplayName,
  getRenounceTargetPrimaryId,
  normalizeEntityIdentity,
  recordOverrideAudit,
} from './useArchitectActions.helpers';
import type {
  ArchitectPlayer,
  CapHold,
  CapHoldActionItem,
  CapSheet,
  CapSheetDevTools,
  DeadCapEntry,
  ManualCapSheetLedgerMutationParams,
  MutationActionResult,
  OverrideMetadata,
  SalaryByYear,
  SigningDetails,
  TeamHistoryDevTools,
  WaiveOptions,
} from './useArchitectActions.types';
import { normalizeOptionalMutationString } from './useArchitectActions.types';

export type UseContractActionsParams = {
  currentYear: number;
  seasonId: string;
  teamCode: string;
  teamCapSheet: CapSheet | null | undefined;
  reportMutationError: (message: string, details?: Record<string, unknown>) => void;
  runManualCapSheetLedgerMutation: (params: ManualCapSheetLedgerMutationParams) => Promise<boolean>;
  applyCapAuditedTeamMutation: (params: {
    mutationType: string;
    playerIds?: string[];
    computeNextTeam: (beforeTeam: CapSheet) => CapSheet;
    persistPayload?: ArchitectMutationPayload;
    invalidMessage: string;
    seasonIdOverride?: string;
    yearOverride?: number;
    receiptContext?: ArchitectReceiptActionContext;
  }) => { applied: boolean; operationId: string | null; persistPromise: Promise<boolean> | null };
  finalizeCapMutationResult: (
    mutationResult: { applied: boolean; persistPromise: Promise<boolean> | null },
    failureMessage: string
  ) => Promise<MutationActionResult>;
  openPlayerContractModalRoute: (params: {
    player: PlayerRulesProfileInput | ArchitectPlayer;
    rulesYear: number;
    targetYear?: number | null;
    actionContext?: ActionContext;
    initialAction?: string | null;
  }) => void;
  setTeamCapSheetSafe: (team: CapSheet | null) => void;
};

export function useContractActions({
  currentYear,
  seasonId,
  teamCode,
  teamCapSheet,
  reportMutationError,
  runManualCapSheetLedgerMutation,
  applyCapAuditedTeamMutation,
  finalizeCapMutationResult,
  openPlayerContractModalRoute,
  setTeamCapSheetSafe,
}: UseContractActionsParams) {

  const handleSetDeadCap = useCallback(
    (deadCap: DeadCapEntry[]): Promise<boolean> =>
      runManualCapSheetLedgerMutation({
        type: 'deadCap',
        deadCap,
      }),
    [runManualCapSheetLedgerMutation]
  );

  // === Exception Management Actions (Phase 27) ===
  const handleSetExceptions = useCallback(
    (exceptions: ManualExceptionsSavePayload): Promise<boolean> =>
      runManualCapSheetLedgerMutation({
        type: 'exceptions',
        exceptions,
      }),
    [runManualCapSheetLedgerMutation]
  );

  const hasInjectedCapSheetFixtures = useMemo(
    () => hasInjectedCapSheetFixturesInTeam(teamCapSheet),
    [teamCapSheet]
  );

  const applyLocalDevCapSheetFixtureState = useCallback(
    (operation: 'inject' | 'clear'): MutationActionResult => {
      if (!import.meta.env.DEV) {
        return {
          success: false,
          message:
            'Cap sheet DEV fixtures are only available in local DEV builds.',
        };
      }

      if (!teamCapSheet) {
        return {
          success: false,
          message: `Cannot ${operation} fixtures: team state is not loaded.`,
        };
      }

      const nextTeam =
        operation === 'inject'
          ? injectCapSheetFixtures(teamCapSheet, currentYear)
          : clearCapSheetFixtures(teamCapSheet);

      // Local DEV seam only: fixture players never enter mutation persistence.
      setTeamCapSheetSafe(nextTeam as CapSheet);
      return { success: true };
    },
    [currentYear, setTeamCapSheetSafe, teamCapSheet]
  );

  const injectCapSheetDevFixtures = useCallback(
    (): MutationActionResult => applyLocalDevCapSheetFixtureState('inject'),
    [applyLocalDevCapSheetFixtureState]
  );

  const clearCapSheetDevFixtures = useCallback(
    (): MutationActionResult => applyLocalDevCapSheetFixtureState('clear'),
    [applyLocalDevCapSheetFixtureState]
  );

  const capSheetDevTools = useMemo<CapSheetDevTools>(
    () => ({
      injectLocalFixtures: injectCapSheetDevFixtures,
      clearLocalFixtures: clearCapSheetDevFixtures,
      hasInjectedLocalFixtures: hasInjectedCapSheetFixtures,
      localStateOwner: DEV_CAP_SHEET_FIXTURE_LOCAL_STATE_OWNER,
      syntheticCoverageBoundary: DEV_CAP_SHEET_FIXTURE_BOUNDARY,
      runtimeBoundary: DEV_CAP_SHEET_FIXTURE_RUNTIME_BOUNDARY,
      injectFixtures: injectCapSheetDevFixtures,
      clearFixtures: clearCapSheetDevFixtures,
      hasInjectedFixtures: hasInjectedCapSheetFixtures,
    }),
    [
      clearCapSheetDevFixtures,
      hasInjectedCapSheetFixtures,
      injectCapSheetDevFixtures,
    ]
  );

  const hasInjectedTeamHistoryFixtures = useMemo(
    () => hasInjectedTeamHistoryFixturesInTeam(teamCapSheet ?? null),
    [teamCapSheet]
  );

  const injectTeamHistoryDevFixtures = useCallback((): MutationActionResult => {
    if (!teamCapSheet) {
      return {
        success: false,
        message:
          'Cannot inject Team History fixtures: team state is not loaded.',
      };
    }

    const nextTeam = injectTeamHistoryFixtures(teamCapSheet);
    setTeamCapSheetSafe(nextTeam as CapSheet);
    return { success: true };
  }, [setTeamCapSheetSafe, teamCapSheet]);

  const clearTeamHistoryDevFixtures = useCallback((): MutationActionResult => {
    if (!teamCapSheet) {
      return {
        success: false,
        message:
          'Cannot clear Team History fixtures: team state is not loaded.',
      };
    }

    const nextTeam = clearTeamHistoryFixtures(teamCapSheet);
    setTeamCapSheetSafe(nextTeam as CapSheet);
    return { success: true };
  }, [setTeamCapSheetSafe, teamCapSheet]);

  const teamHistoryDevTools = useMemo<TeamHistoryDevTools>(
    () => ({
      injectFixtures: injectTeamHistoryDevFixtures,
      clearFixtures: clearTeamHistoryDevFixtures,
      hasInjectedFixtures: hasInjectedTeamHistoryFixtures,
    }),
    [
      clearTeamHistoryDevFixtures,
      hasInjectedTeamHistoryFixtures,
      injectTeamHistoryDevFixtures,
    ]
  );

  const handleEditContract = useCallback(
    (
      player: PlayerRulesProfileInput | ArchitectDashboardPlayer | ArchitectPlayer
    ): void => {
      openPlayerContractModalRoute({
        player: player as PlayerRulesProfileInput | ArchitectPlayer,
        rulesYear: currentYear,
        initialAction: null,
        targetYear: null,
        actionContext: null,
      });
    },
    [currentYear, openPlayerContractModalRoute]
  );

  // Home-base shortcut: open the existing contract modal pre-seeded to a
  // specific action so the Full Cap Table row kebab can deep-link into
  // waive/extend/stretch without reimplementing any mutation. The committed
  // write still happens inside EditContractModal via its existing callbacks.
  const handleLaunchPlayerContractAction = useCallback(
    (
      player: PlayerRulesProfileInput | ArchitectDashboardPlayer | ArchitectPlayer,
      action: 'waive' | 'extend' | 'stretch'
    ): void => {
      const initialAction = action === 'stretch' ? 'waiveStretch' : action;
      openPlayerContractModalRoute({
        player: player as PlayerRulesProfileInput | ArchitectPlayer,
        rulesYear: currentYear,
        initialAction,
        targetYear: null,
        actionContext: null,
      });
    },
    [currentYear, openPlayerContractModalRoute]
  );

  // Shared helper for renounce confirmation and execution
  // Now directly updates teamCapSheet instead of using capSheetState
  const confirmAndRenounceRights = useCallback(
    async (
      playerOrHold: RenounceActionTarget,
      overrideMetadata?: OverrideMetadata | null
    ): Promise<MutationActionResult> => {
      const playerName = getRenounceTargetDisplayName(playerOrHold);

      if (
        !window.confirm(
          `Are you sure you want to renounce rights to ${playerName}? This will clear their cap hold.`
        )
      ) {
        return {
          success: false,
          message: 'Action canceled. No changes were saved.',
        };
      }

      const candidateIdSet = new Set<string>();
      const candidateNameSet = new Set<string>();
      const collectCandidate = (value: unknown): void => {
        const trimmed = String(value || '').trim();
        if (trimmed) {
          candidateIdSet.add(trimmed);
        }
        const normalized = normalizeEntityIdentity(value);
        if (normalized) {
          candidateNameSet.add(normalized);
        }
      };

      for (const candidateValue of getRenounceTargetCandidateValues(
        playerOrHold
      )) {
        collectCandidate(candidateValue);
      }

      const idToRenounce = getRenounceTargetPrimaryId(playerOrHold);

      // Persist to world if in world mode
      if (!idToRenounce) {
        console.error('Renounce missing playerId');
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }

      const matchesHold = (hold: CapHold): boolean => {
        const holdId = String(hold?.playerId || '').trim();
        return (
          (holdId && candidateIdSet.has(holdId)) ||
          candidateNameSet.has(normalizeEntityIdentity(hold?.playerName)) ||
          candidateNameSet.has(normalizeEntityIdentity(holdId))
        );
      };
      const isPlayerRenounceable = (player: ArchitectPlayer): boolean => {
        const playerBirdStatus = String(
          player.contract?.birdRights?.status || ''
        ).toLowerCase();
        const rightsAlreadyCleared =
          Boolean(player.rightsRenounced) &&
          (!playerBirdStatus || playerBirdStatus === 'none');
        return !rightsAlreadyCleared;
      };
      const matchesPlayer = (player: ArchitectPlayer): boolean => {
        const playerId = String(player?.id || '').trim();
        const playerAltId = String(player?.player_id || '').trim();
        return (
          (playerId && candidateIdSet.has(playerId)) ||
          (playerAltId && candidateIdSet.has(playerAltId)) ||
          candidateNameSet.has(normalizeEntityIdentity(player?.name)) ||
          candidateNameSet.has(normalizeEntityIdentity(player?.displayName))
        );
      };

      const hasRemovableHold = (teamCapSheet?.capHolds || []).some((hold) =>
        matchesHold(hold as CapHold)
      );
      const hasRenounceablePlayer = (teamCapSheet?.players || []).some(
        (player) =>
          matchesPlayer(player as ArchitectPlayer) &&
          isPlayerRenounceable(player as ArchitectPlayer)
      );
      if (!hasRemovableHold && !hasRenounceablePlayer) {
        const message =
          'No matching cap hold or renounceable rights were found for this player.';
        reportMutationError(message, {
          playerName,
          idToRenounce,
          candidateIds: Array.from(candidateIdSet),
        });
        return { success: false, message };
      }

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'renounceRights',
        playerIds: [String(idToRenounce)],
        invalidMessage: 'Renounce rights blocked by post-state cap validation.',
        computeNextTeam: (beforeTeam) => {
          // Remove from capHolds array
          const updatedCapHolds = (beforeTeam.capHolds || []).filter(
            (h) => !matchesHold(h as CapHold)
          );

          // Update player object if it exists
          let rightsUpdates = 0;
          const updatedPlayers = (beforeTeam.players || []).map((p) => {
            if (matchesPlayer(p as ArchitectPlayer)) {
              let playerChanged = false;
              const updated: ArchitectPlayer = { ...p };
              if (!updated.rightsRenounced) {
                updated.rightsRenounced = true;
                playerChanged = true;
              }
              const currentStatus = String(
                updated.contract?.birdRights?.status || ''
              ).toLowerCase();
              if (updated.contract?.birdRights && currentStatus !== 'none') {
                updated.contract = {
                  ...updated.contract,
                  birdRights: {
                    ...updated.contract.birdRights,
                    status: 'None',
                  },
                };
                playerChanged = true;
              }
              if (playerChanged) {
                rightsUpdates += 1;
              }
              return updated;
            }
            return p;
          });

          const removedHoldsCount =
            (beforeTeam.capHolds || []).length - updatedCapHolds.length;
          if (removedHoldsCount === 0 && rightsUpdates === 0) {
            return beforeTeam;
          }

          // Record override audit log if override was used
          const overrideAuditLog = overrideMetadata?.overrideUsed
            ? recordOverrideAudit(
                beforeTeam,
                'renounce',
                overrideMetadata.overrideReasons || [],
                idToRenounce,
                playerName
              )
            : beforeTeam?.overrideAuditLog;

          return {
            ...beforeTeam,
            players: updatedPlayers,
            capHolds: updatedCapHolds,
            ...(overrideAuditLog ? { overrideAuditLog } : {}),
          };
        },
        persistPayload: {
          teamCode,
          playerId: idToRenounce,
        },
        receiptContext: {
          actionType: 'renounce-rights',
          headlineOverride: 'Rights renounced',
          playerId: idToRenounce,
          playerName,
          effectAreas: ['rights', 'cap'],
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save renounce action. Please try again.'
      );
    },
    [
      applyCapAuditedTeamMutation,
      finalizeCapMutationResult,
      reportMutationError,
      teamCapSheet,
      teamCode,
    ]
  );

  const handleCapTableModalAction = useCallback(
    (
      player: PlayerRulesProfileInput,
      actionType: CapSheetModalActionType,
      year: number
    ): void => {
      const contextMap: Record<CapSheetModalActionType, ActionContext> = {
        po: 'option',
        to: 'option',
        ufa: 'freeAgent',
        rfa: 'freeAgent',
      };

      openPlayerContractModalRoute({
        player,
        rulesYear: year || currentYear,
        initialAction: null,
        targetYear: year,
        actionContext: contextMap[actionType],
      });
    },
    [currentYear, openPlayerContractModalRoute]
  );

  const handleCapHoldRenounce = useCallback(
    (capHold: CapHoldActionItem): void => {
      void confirmAndRenounceRights(capHold);
    },
    [confirmAndRenounceRights]
  );

  // handleExtendContract - directly updates teamCapSheet
  const handleExtendContract = useCallback(
    async (
      player: ArchitectPlayer,
      extensionContract: SigningDetails
    ): Promise<MutationActionResult> => {
      const playerId = player.id || player.player_id || player.name;
      if (!playerId) {
        console.error('Extend player missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'extendPlayer',
        playerIds: [String(playerId)],
        invalidMessage: 'Extension blocked by post-state cap validation.',
        computeNextTeam: (beforeTeam) => {
          const updatedPlayers = (beforeTeam.players || []).map((p) => {
            if (
              p.id === playerId ||
              p.player_id === playerId ||
              p.name === playerId
            ) {
              // Add extension years to futureContract
              const futureContract = p.futureContract || {
                salariesByYear: [],
                extension: true,
              };

              const newYears: SalaryByYear[] = (
                extensionContract.salariesByYear || []
              ).map((y) => ({
                season: String(y.season || ''),
                salary: Number(y.salary ?? y.capHit ?? 0),
                capHit: Number(y.capHit ?? y.salary ?? 0),
                guaranteed: y.guaranteed ?? true,
                option: y.option ?? null,
                optionType: y.optionType ?? null,
                optionUsed: y.optionUsed ?? null,
                isExtensionSeason: true,
              }));

              return {
                ...p,
                futureContract: {
                  ...futureContract,
                  salariesByYear: [
                    ...(futureContract.salariesByYear || []),
                    ...newYears,
                  ],
                  extension: true,
                },
              };
            }
            return p;
          });

          // Record override audit log if override was used
          const overrideAuditLog = extensionContract.overrideUsed
            ? recordOverrideAudit(
                beforeTeam,
                'extend',
                extensionContract.overrideReasons || [],
                playerId,
                normalizeOptionalMutationString(
                  player.name || player.displayName
                )
              )
            : beforeTeam.overrideAuditLog;

          return {
            ...beforeTeam,
            players: updatedPlayers,
            ...(overrideAuditLog ? { overrideAuditLog } : {}),
          };
        },
        persistPayload: {
          teamCode,
          playerId,
          extension: {
            salariesByYear: extensionContract.salariesByYear || [],
          },
        },
        receiptContext: {
          actionType: 'extension',
          headlineOverride: 'Extension saved',
          playerId,
          playerName:
            normalizeOptionalMutationString(
              player.displayName || player.name
            ) || null,
          affectedSeasons:
            extensionContract.salariesByYear?.map((row) => row.season) || [],
          effectAreas: ['contract', 'cap'],
          notes: [
            'Current-year cap deltas only change when the extension affects the selected viewing season.',
          ],
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save extension. Please try again.'
      );
    },
    [applyCapAuditedTeamMutation, finalizeCapMutationResult, teamCode]
  );

  // handleWaiveContract - directly updates teamCapSheet
  const handleWaiveContract = useCallback(
    async (
      player: ArchitectPlayer,
      options: WaiveOptions
    ): Promise<MutationActionResult> => {
      const { stretch, buyout, buyoutAmount, overrideUsed, overrideReasons } =
        options;
      const confirmMsg = stretch
        ? 'Waive and stretch this player?'
        : buyout
          ? 'Buy out this player?'
          : 'Waive this player?';
      if (!window.confirm(confirmMsg)) {
        return {
          success: false,
          message: 'Action canceled. No changes were saved.',
        };
      }

      const playerId = player.id || player.player_id || player.name;
      if (!playerId) {
        console.error('Waive missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }

      const normalizedBuyoutAmount = buyout
        ? Math.max(0, Number(buyoutAmount) || 0)
        : 0;

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'waivePlayer',
        playerIds: [String(playerId)],
        invalidMessage: 'Waive action blocked by post-state cap validation.',
        computeNextTeam: (beforeTeam) => {
          const rosterPlayer = (beforeTeam.players || []).find(
            (p) =>
              p.id === playerId ||
              p.player_id === playerId ||
              p.name === playerId
          );
          const contractRows: SalaryByYear[] =
            rosterPlayer?.contract?.salariesByYear ||
            player.contract?.salariesByYear ||
            [];

          // Calculate remaining guaranteed money from current/future rows.
          const remainingGuaranteed = contractRows
            .filter((y) => {
              const season = String(y.season);
              const yearEnd = /^\d{4}-\d{2}$/.test(season)
                ? 2000 + parseInt(season.split('-')[1], 10)
                : parseInt(season, 10);
              return yearEnd >= currentYear && y.guaranteed !== false;
            })
            .reduce((sum, y) => sum + Number(y.salary || 0), 0);

          const boundedBuyoutAmount = buyout
            ? Math.min(remainingGuaranteed, normalizedBuyoutAmount)
            : 0;

          // Buyout follows the same model in local + world paths:
          // dead cap equals remaining guaranteed minus buyout reduction amount.
          const deadCapAmount = buyout
            ? Math.max(0, remainingGuaranteed - boundedBuyoutAmount)
            : remainingGuaranteed;

          const shouldStretch = !!stretch && deadCapAmount > 0;
          const stretchYears = shouldStretch ? 3 : 1;
          const baseAmount = shouldStretch
            ? Math.floor(deadCapAmount / stretchYears)
            : deadCapAmount;
          const remainder = shouldStretch
            ? deadCapAmount - baseAmount * stretchYears
            : 0;

          const deadCapEntries =
            deadCapAmount > 0
              ? [
                  {
                    playerId: String(playerId),
                    playerName:
                      rosterPlayer?.displayName ||
                      rosterPlayer?.name ||
                      player.displayName ||
                      player.name ||
                      String(playerId),
                    originalSalary: remainingGuaranteed,
                    amountByYear: Array.from(
                      { length: stretchYears },
                      (_, index) => ({
                        season: toSeasonCode(currentYear + index),
                        amount:
                          shouldStretch && index < remainder
                            ? baseAmount + 1
                            : baseAmount,
                        isStretched: shouldStretch,
                      })
                    ),
                    waiveDate: new Date().toISOString(),
                    notes: buyout
                      ? `Buyout reduction: $${boundedBuyoutAmount.toLocaleString()}`
                      : shouldStretch
                        ? `Stretched over ${stretchYears} years`
                        : undefined,
                  },
                ]
              : [];

          const updatedPlayers = (beforeTeam.players || []).filter(
            (p) =>
              p.id !== playerId &&
              p.player_id !== playerId &&
              p.name !== playerId
          );

          const updatedRoster = (
            Array.isArray(beforeTeam.roster) ? beforeTeam.roster : []
          ).filter((id) => String(id) !== String(playerId));

          // Record override audit log if override was used
          const overrideAuditLog = overrideUsed
            ? recordOverrideAudit(
                beforeTeam,
                stretch ? 'waiveStretch' : buyout ? 'buyout' : 'waive',
                overrideReasons || [],
                playerId,
                normalizeOptionalMutationString(
                  player.name || player.displayName
                )
              )
            : beforeTeam.overrideAuditLog;

          return {
            ...beforeTeam,
            roster: updatedRoster,
            players: updatedPlayers,
            deadCap: [...(beforeTeam.deadCap || []), ...deadCapEntries],
            ...(overrideAuditLog ? { overrideAuditLog } : {}),
          };
        },
        persistPayload: {
          teamCode,
          playerId,
          stretch: !!stretch,
          stretchYears: stretch ? 3 : 0, // Default stretch years
          buyout: !!buyout,
          buyoutAmount: buyout ? normalizedBuyoutAmount : 0,
          isGracePeriod: false, // Default, UI doesn't currently expose this
        },
        receiptContext: {
          actionType: stretch ? 'waive-stretch' : buyout ? 'buyout' : 'waive',
          headlineOverride: stretch
            ? 'Waive-and-stretch saved'
            : buyout
              ? 'Buyout saved'
              : 'Waiver saved',
          playerId,
          playerName:
            normalizeOptionalMutationString(
              player.displayName || player.name
            ) || null,
          effectAreas: ['roster', 'deadMoney', 'cap'],
          notes: [
            buyout
              ? 'Dead money reflects remaining guaranteed salary after the entered buyout reduction.'
              : stretch
                ? 'Dead money is allocated over the stretch schedule generated by this action.'
                : 'Dead money is based on remaining guaranteed salary available in this action path.',
          ],
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save waive/buyout action. Please try again.'
      );
    },
    [
      currentYear,
      applyCapAuditedTeamMutation,
      finalizeCapMutationResult,
      teamCode,
    ]
  );

  // handleOptionDecision - directly updates teamCapSheet and manages cap holds
  const handleOptionDecision = useCallback(
    async (
      player: ArchitectPlayer,
      accepted: boolean,
      overrideMetadata?: OverrideMetadata | null,
      targetYearOverride?: number | null
    ): Promise<MutationActionResult> => {
      const playerId = player.id || player.player_id || player.name;
      const yearSeasonContext = buildYearSeasonContext(
        targetYearOverride,
        currentYear + 1
      );
      const targetYear = yearSeasonContext.actionYear;
      if (!playerId) {
        console.error('Option decision missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'optionDecision',
        playerIds: [String(playerId)],
        invalidMessage: 'Option decision blocked by post-state cap validation.',
        seasonIdOverride: yearSeasonContext.seasonId,
        yearOverride: yearSeasonContext.actionYear,
        computeNextTeam: (beforeTeam) => {
          let newCapHold: CapHold | null = null;

          const updatedPlayers = (beforeTeam.players || []).map((p) => {
            if (
              p.id === playerId ||
              p.player_id === playerId ||
              p.name === playerId
            ) {
              const salaries: SalaryByYear[] = p.contract?.salariesByYear || [];

              // Find the option year entry
              const optionIndex = salaries.findIndex((y) => {
                const season = String(y.season);
                const yearEnd = /^\d{4}-\d{2}$/.test(season)
                  ? 2000 + parseInt(season.split('-')[1], 10)
                  : parseInt(season, 10);
                return yearEnd === targetYear && y.option;
              });

              if (optionIndex === -1) {
                console.warn(`No option found for year ${targetYear}`);
                return p;
              }

              // Mark option as used (canonical boolean format)
              const updatedSalaries: SalaryByYear[] = [...salaries];
              updatedSalaries[optionIndex] = {
                ...updatedSalaries[optionIndex],
                optionUsed: accepted, // CANONICAL: boolean, not string
              };

              if (!accepted) {
                const optionSeason = salaries[optionIndex]?.season || null;
                const faYearInfo = deriveFreeAgencyYearFromOptionSeason(
                  optionSeason,
                  targetYear
                );
                const freeAgencyYear =
                  typeof faYearInfo.year === 'number'
                    ? faYearInfo.year
                    : targetYear - 1;

                // Declining: remove this year and all future years
                const filteredSalaries: SalaryByYear[] = salaries.filter(
                  (_, idx) => idx < optionIndex
                );

                // Calculate cap hold for declined option
                const priorRow = salaries[optionIndex - 1];
                const lastSalary = priorRow?.salary ?? priorRow?.capHit ?? 0;
                const rightsType = getRightsTypeFromPlayer(p);
                const capHoldResult = computeExpectedCapHoldAmount({
                  player: p,
                  lastSalary,
                  rules: null,
                  rightsType,
                });
                if (lastSalary > 0 && capHoldResult.amount) {
                  newCapHold = {
                    playerId: p.id || p.player_id || p.name || '',
                    playerName: p.displayName || p.name || '',
                    amount: capHoldResult.amount,
                    type: 'FA Cap Hold',
                    season: toSeasonCode(targetYear),
                    isSigned: false,
                    reason: capHoldResult.usedFallback
                      ? 'Declined Option (fallback multiplier)'
                      : 'Declined Option',
                    notes: capHoldResult.usedFallback
                      ? 'Fallback multiplier used due to missing/unsupported Bird rights type.'
                      : undefined,
                    active: true,
                  };
                }

                return {
                  ...p,
                  contract: {
                    ...(p.contract || {}),
                    salariesByYear: filteredSalaries,
                    freeAgency: {
                      year: freeAgencyYear,
                      type: 'UFA' as const,
                    },
                  },
                  freeAgentYear: freeAgencyYear,
                };
              }

              // Accepted: just update the option status
              return {
                ...p,
                contract: {
                  ...(p.contract || {}),
                  salariesByYear: updatedSalaries,
                },
              };
            }
            return p;
          });

          // Update capHolds array
          let updatedCapHolds = beforeTeam.capHolds || [];
          const finalCapHold = newCapHold as CapHold | null;
          if (finalCapHold) {
            // Remove any existing hold for this player and add the new one
            const holdPlayerId = finalCapHold.playerId;
            updatedCapHolds = updatedCapHolds.filter(
              (h) => h.playerId !== holdPlayerId
            );
            updatedCapHolds = [...updatedCapHolds, finalCapHold];
          }

          const finalPlayers = accepted
            ? updatedPlayers
            : updatedPlayers.filter(
                (p) =>
                  p.id !== playerId &&
                  p.player_id !== playerId &&
                  p.name !== playerId
              );
          const updatedRoster = accepted
            ? beforeTeam.roster
            : (Array.isArray(beforeTeam.roster)
                ? beforeTeam.roster
                : []
              ).filter((id) => String(id) !== String(playerId));

          // Record override audit log if override was used
          const overrideAuditLog = overrideMetadata?.overrideUsed
            ? recordOverrideAudit(
                beforeTeam,
                accepted ? 'accept' : 'decline',
                overrideMetadata.overrideReasons || [],
                playerId,
                normalizeOptionalMutationString(
                  player.name || player.displayName
                )
              )
            : beforeTeam.overrideAuditLog;

          return {
            ...beforeTeam,
            roster: updatedRoster,
            players: finalPlayers,
            capHolds: updatedCapHolds,
            ...(overrideAuditLog ? { overrideAuditLog } : {}),
          };
        },
        persistPayload: {
          teamCode,
          playerId,
          accepted,
          targetYear,
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save option decision. Please try again.'
      );
    },
    [
      currentYear,
      applyCapAuditedTeamMutation,
      finalizeCapMutationResult,
      teamCode,
    ]
  );

  const handleRenounceRights = useCallback(
    async (
      player: ArchitectPlayer,
      overrideMetadata?: OverrideMetadata | null
    ): Promise<MutationActionResult> => {
      return confirmAndRenounceRights(player, overrideMetadata);
    },
    [confirmAndRenounceRights]
  );


  return {
    handleSetDeadCap,
    handleSetExceptions,
    handleEditContract,
    handleLaunchPlayerContractAction,
    handleCapTableModalAction,
    handleCapHoldRenounce,
    handleExtendContract,
    handleWaiveContract,
    handleOptionDecision,
    handleRenounceRights,
    capSheetDevTools,
    teamHistoryDevTools,
  };
}
