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
import {
  allocateStandardWaiverDeadCapBySeason,
  countRemainingContractSeasons,
  getStretchProvisionYears,
  sumWaiverDeadCapAllocations,
} from '@/features/architect/utils/waiverDeadCapAllocation';
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
  type RenounceActionTarget,
  buildYearSeasonContext,
  getRenounceTargetDisplayName,
  getRenounceTargetPrimaryId,
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
import {
  RIGHTS_LEDGER_WORLD_VERSION,
  renounceGovernedRights,
} from '@/features/architect/utils/rightsHistory';
import type { ComputeNextTeam } from './useArchitectActions.persistenceHelpers';

export type UseContractActionsParams = {
  currentYear: number;
  teamCode: string;
  worldId: string | null;
  userId: string | null;
  worldAsOfDate: string | null;
  rightsLedgerWorldVersion: number | null;
  teamCapSheet: CapSheet | null | undefined;
  reportMutationError: (message: string, details?: Record<string, unknown>) => void;
  runManualCapSheetLedgerMutation: (params: ManualCapSheetLedgerMutationParams) => Promise<boolean>;
  applyCapAuditedTeamMutation: (params: {
    mutationType: string;
    playerIds?: string[];
    computeNextTeam: ComputeNextTeam;
    persistPayload?: ArchitectMutationPayload;
    invalidMessage: string;
    seasonIdOverride?: string;
    yearOverride?: number;
    receiptContext?: ArchitectReceiptActionContext;
  }) => {
    applied: boolean;
    operationId: string | null;
    message?: string;
    persistPromise: Promise<boolean> | null;
  };
  finalizeCapMutationResult: (
    mutationResult: {
      applied: boolean;
      message?: string;
      persistPromise: Promise<boolean> | null;
    },
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
  teamCode,
  worldId,
  userId,
  worldAsOfDate,
  rightsLedgerWorldVersion,
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
  // waive/extend/stretch/buyout without reimplementing any mutation. The committed
  // write still happens inside EditContractModal via its existing callbacks.
  const handleLaunchPlayerContractAction = useCallback(
    (
      player: PlayerRulesProfileInput | ArchitectDashboardPlayer | ArchitectPlayer,
      action: 'waive' | 'extend' | 'stretch' | 'buyout'
    ): void => {
      const initialAction = action === 'stretch' ? 'waiveStretch' : action;
      openPlayerContractModalRoute({
        player: player as PlayerRulesProfileInput | ArchitectPlayer,
        rulesYear: currentYear,
        initialAction,
        targetYear: null,
        actionContext: 'underContract',
      });
    },
    [currentYear, openPlayerContractModalRoute]
  );

  // BZE-273: the saved-world rights ledger is the only renunciation authority.
  const confirmAndRenounceRights = useCallback(
    async (
      playerOrHold: RenounceActionTarget,
      overrideMetadata?: OverrideMetadata | null
    ): Promise<MutationActionResult> => {
      void overrideMetadata;
      const playerName = getRenounceTargetDisplayName(playerOrHold);
      const idToRenounce = getRenounceTargetPrimaryId(playerOrHold);
      if (!idToRenounce) {
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }
      if (
        !worldId ||
        !userId ||
        !worldAsOfDate ||
        rightsLedgerWorldVersion !== RIGHTS_LEDGER_WORLD_VERSION
      ) {
        const message = worldId
          ? 'This Team Plan predates governed rights history. Recreate it to manage free-agent rights.'
          : 'Renunciation requires a saved Team Plan with governed rights history.';
        reportMutationError(message, { playerName, idToRenounce });
        return { success: false, message };
      }
      if (!teamCapSheet?.rightsLedger) {
        const message =
          'Governed rights inputs are not available for this team and player.';
        reportMutationError(message, { playerName, idToRenounce });
        return { success: false, message };
      }
      const salaryCapYear = Number.isInteger(currentYear) ? currentYear : null;
      if (!salaryCapYear) {
        return {
          success: false,
          message: 'Renunciation requires a governed Salary Cap Year.',
        };
      }

      // Preflight before confirmation so an incomplete, repeated, too-early,
      // or ROFR-blocked action never presents itself as executable.
      const preflight = renounceGovernedRights({
        ledger: teamCapSheet.rightsLedger,
        worldId,
        teamId: teamCode,
        playerId: String(idToRenounce),
        asOfDate: worldAsOfDate,
        salaryCapYear,
        operationId: 'rights-renunciation-preflight',
        authoringIdentity: userId,
        recordedAt:
          worldAsOfDate.length === 10
            ? `${worldAsOfDate}T23:59:59Z`
            : worldAsOfDate,
      });
      if (!preflight.success) {
        reportMutationError(preflight.error, { playerName, idToRenounce });
        return { success: false, message: preflight.error };
      }

      if (
        !window.confirm(
          `Renounce ${preflight.before.birdType} rights to ${playerName} and remove the $${(
            preflight.before.freeAgentAmount ?? 0
          ).toLocaleString()} Free Agent Amount?`
        )
      ) {
        return {
          success: false,
          message: 'Action canceled. No changes were saved.',
        };
      }

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'renounceRights',
        playerIds: [String(idToRenounce)],
        invalidMessage: 'Renounce rights blocked by post-state cap validation.',
        computeNextTeam: (beforeTeam, context) => {
          const preview = renounceGovernedRights({
            ledger: beforeTeam.rightsLedger,
            worldId,
            teamId: teamCode,
            playerId: String(idToRenounce),
            asOfDate: worldAsOfDate,
            salaryCapYear,
            operationId: context.operationId,
            authoringIdentity: userId,
            recordedAt: context.occurredAt,
          });
          if (!preview.success) {
            throw new Error(preview.error);
          }
          return {
            ...beforeTeam,
            rightsLedger: preview.ledger,
            capHolds: (beforeTeam.capHolds || []).filter(
              (hold) => String(hold.playerId) !== String(idToRenounce)
            ),
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
      currentYear,
      finalizeCapMutationResult,
      reportMutationError,
      teamCapSheet,
      teamCode,
      userId,
      worldAsOfDate,
      worldId,
      rightsLedgerWorldVersion,
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

      // CBA stretch term for the persisted metadata: (2 x seasons remaining) + 1.
      const payloadStretchYears = stretch
        ? getStretchProvisionYears(
            countRemainingContractSeasons({
              salaryRows: player.contract?.salariesByYear || [],
              currentSeason: toSeasonCode(currentYear),
            })
          ) || 3
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
          const standardDeadCapBySeason =
            allocateStandardWaiverDeadCapBySeason({
              salaryRows: contractRows,
              currentSeason: toSeasonCode(currentYear),
            });
          const remainingGuaranteed = sumWaiverDeadCapAllocations(
            standardDeadCapBySeason
          );

          const boundedBuyoutAmount = buyout
            ? Math.min(remainingGuaranteed, normalizedBuyoutAmount)
            : 0;

          // Buyout follows the same model in local + world paths:
          // dead cap equals remaining guaranteed minus buyout reduction amount.
          const deadCapAmount = buyout
            ? Math.max(0, remainingGuaranteed - boundedBuyoutAmount)
            : remainingGuaranteed;

          const shouldStretch = !!stretch && deadCapAmount > 0;
          // CBA stretch term: (2 x seasons remaining) + 1, derived from the
          // contract. Falls back to 3 only when the term can't be computed.
          const remainingSeasonCount = countRemainingContractSeasons({
            salaryRows: contractRows,
            currentSeason: toSeasonCode(currentYear),
          });
          const stretchYears = shouldStretch
            ? getStretchProvisionYears(remainingSeasonCount) || 3
            : 1;
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
                    amountByYear:
                      !buyout && !shouldStretch
                        ? standardDeadCapBySeason
                        : Array.from({ length: stretchYears }, (_, index) => ({
                            season: toSeasonCode(currentYear + index),
                            amount:
                              shouldStretch && index < remainder
                                ? baseAmount + 1
                                : baseAmount,
                            isStretched: shouldStretch,
                          })),
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
          stretchYears: payloadStretchYears, // CBA term: (2 x seasons remaining) + 1
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
      const currentSeasonId = toSeasonCode(currentYear);
      if (!playerId) {
        console.error('Option decision missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'optionDecision',
        playerIds: [String(playerId)],
        invalidMessage: 'Option decision blocked by post-state cap validation.',
        seasonIdOverride: currentSeasonId,
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
        receiptContext: {
          actionType: accepted ? 'option-accept' : 'option-decline',
          headlineOverride: accepted ? 'Option accepted' : 'Option declined',
          playerId,
          playerName:
            normalizeOptionalMutationString(
              player.displayName || player.name
            ) || null,
          affectedSeasons: [yearSeasonContext.seasonId],
          effectAreas: ['roster', 'rights', 'cap', 'contract'],
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
