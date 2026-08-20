/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.contractActions.ts
 * PURPOSE: Sub-hook for contract, cap, DEV fixture, and player action handlers.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Wave 6 Step 5: Extracted from useArchitectActions.ts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type {
  ArchitectMutationPayload,
  ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';
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
import {
  applyGovernedOptionResult,
  decideGovernedOption,
  loadWorldGovernedOptionEntries,
  type GovernedOptionDecisionAvailability,
  type WorldGovernedOptionEntry,
} from '@/features/architect/utils/optionDecisions';
import type { GovernedOptionNoticeInput } from '@/schemas/governedOptionDecision';
import type { GovernedExtensionProposal } from '@/schemas/governedExtension';
import {
  applyGovernedExtensionResult,
  decideGovernedExtension,
  loadWorldGovernedExtensionEntries,
  type GovernedExtensionAvailability,
  type WorldGovernedExtensionEntry,
} from '@/features/architect/utils/extensions';
import {
  applyGovernedWaiverResult,
  decideGovernedWaiver,
  loadWorldGovernedWaiverEntries,
  readGovernedWaiverLifecycles,
  type GovernedWaiverAvailability,
  type WorldGovernedWaiverEntry,
} from '@/features/architect/utils/waivers';
import { resolveGovernedSeasonEnvelope } from '@/features/architect/utils/governedSeason';

export type UseContractActionsParams = {
  currentYear: number;
  teamCode: string;
  worldId: string | null;
  userId: string | null;
  worldAsOfDate: string | null;
  rightsLedgerWorldVersion: number | null;
  teamCapSheet: CapSheet | null | undefined;
  reportMutationError: (
    message: string,
    details?: Record<string, unknown>
  ) => void;
  runManualCapSheetLedgerMutation: (
    params: ManualCapSheetLedgerMutationParams
  ) => Promise<boolean>;
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
  const [governedOptionEntries, setGovernedOptionEntries] = useState<
    readonly WorldGovernedOptionEntry[]
  >([]);
  const [governedOptionLoadState, setGovernedOptionLoadState] = useState<
    'idle' | 'loading' | 'ready' | 'incompatible'
  >('idle');
  const [governedOptionLoadReason, setGovernedOptionLoadReason] = useState<
    string | null
  >(null);
  const [governedExtensionEntries, setGovernedExtensionEntries] = useState<
    readonly WorldGovernedExtensionEntry[]
  >([]);
  const [governedExtensionLoadState, setGovernedExtensionLoadState] = useState<
    'idle' | 'loading' | 'ready' | 'incompatible'
  >('idle');
  const [governedExtensionLoadReason, setGovernedExtensionLoadReason] =
    useState<string | null>(null);
  const [governedWaiverEntries, setGovernedWaiverEntries] = useState<
    readonly WorldGovernedWaiverEntry[]
  >([]);
  const [governedWaiverLoadState, setGovernedWaiverLoadState] = useState<
    'idle' | 'loading' | 'ready' | 'incompatible'
  >('idle');
  const [governedWaiverLoadReason, setGovernedWaiverLoadReason] = useState<
    string | null
  >(null);

  useEffect(() => {
    let active = true;
    if (!worldId || !worldAsOfDate || !teamCode) {
      setGovernedOptionEntries([]);
      setGovernedOptionLoadState('idle');
      setGovernedOptionLoadReason(null);
      return () => {
        active = false;
      };
    }
    setGovernedOptionLoadState('loading');
    setGovernedOptionLoadReason(null);
    void loadWorldGovernedOptionEntries({
      worldId,
      teamId: teamCode,
      overlays: teamCapSheet?.contractEventLedgers ?? [],
      worldAsOfDate,
    })
      .then((entries) => {
        if (!active) return;
        setGovernedOptionEntries(entries);
        setGovernedOptionLoadState('ready');
      })
      .catch((error) => {
        if (!active) return;
        setGovernedOptionEntries([]);
        setGovernedOptionLoadState('incompatible');
        setGovernedOptionLoadReason(
          error instanceof Error
            ? error.message
            : 'Governed option history could not be loaded.'
        );
      });
    return () => {
      active = false;
    };
  }, [teamCapSheet?.contractEventLedgers, teamCode, worldAsOfDate, worldId]);

  useEffect(() => {
    let active = true;
    if (!worldId || !worldAsOfDate || !teamCode) {
      setGovernedWaiverEntries([]);
      setGovernedWaiverLoadState('idle');
      setGovernedWaiverLoadReason(null);
      return () => {
        active = false;
      };
    }
    setGovernedWaiverLoadState('loading');
    setGovernedWaiverLoadReason(null);
    void loadWorldGovernedWaiverEntries({
      worldId,
      teamId: teamCode,
      overlays: teamCapSheet?.contractEventLedgers ?? [],
      existingLifecycles: readGovernedWaiverLifecycles(teamCapSheet),
      worldAsOfDate,
    })
      .then((entries) => {
        if (!active) return;
        setGovernedWaiverEntries(entries);
        setGovernedWaiverLoadState('ready');
      })
      .catch((error) => {
        if (!active) return;
        setGovernedWaiverEntries([]);
        setGovernedWaiverLoadState('incompatible');
        setGovernedWaiverLoadReason(
          error instanceof Error
            ? error.message
            : 'Governed waiver history could not be loaded.'
        );
      });
    return () => {
      active = false;
    };
  }, [
    teamCapSheet?.contractEventLedgers,
    teamCapSheet?.deadCap,
    teamCode,
    worldAsOfDate,
    worldId,
  ]);

  useEffect(() => {
    let active = true;
    if (!worldId || !worldAsOfDate || !teamCode) {
      setGovernedExtensionEntries([]);
      setGovernedExtensionLoadState('idle');
      setGovernedExtensionLoadReason(null);
      return () => {
        active = false;
      };
    }
    setGovernedExtensionLoadState('loading');
    setGovernedExtensionLoadReason(null);
    void loadWorldGovernedExtensionEntries({
      worldId,
      teamId: teamCode,
      overlays: teamCapSheet?.contractEventLedgers ?? [],
      worldAsOfDate,
    })
      .then((entries) => {
        if (!active) return;
        setGovernedExtensionEntries(entries);
        setGovernedExtensionLoadState('ready');
      })
      .catch((error) => {
        if (!active) return;
        setGovernedExtensionEntries([]);
        setGovernedExtensionLoadState('incompatible');
        setGovernedExtensionLoadReason(
          error instanceof Error
            ? error.message
            : 'Extension history could not be loaded.'
        );
      });
    return () => {
      active = false;
    };
  }, [teamCapSheet?.contractEventLedgers, teamCode, worldAsOfDate, worldId]);

  const getWaiverAvailability = useCallback(
    (player: ArchitectPlayer): GovernedWaiverAvailability => {
      const playerId = String(
        player.id || player.player_id || player.name || ''
      );
      const fallback = (
        status: 'needs-input' | 'incompatible',
        reason: string
      ): GovernedWaiverAvailability =>
        Object.freeze({
          status,
          playerId,
          contractId: null,
          reasons: Object.freeze([reason]),
        });
      if (!worldId) {
        return fallback(
          'incompatible',
          'Open a fresh governed Team Plan to record this waiver.'
        );
      }
      if (!playerId) {
        return fallback(
          'needs-input',
          'The exact player identity is required.'
        );
      }
      if (governedWaiverLoadState === 'loading') {
        return fallback(
          'needs-input',
          'Checking the pinned Contract, protection schedule, and league inputs…'
        );
      }
      if (governedWaiverLoadState === 'idle') {
        return fallback(
          'needs-input',
          'The Team and Team Plan date must finish loading first.'
        );
      }
      if (governedWaiverLoadState === 'incompatible') {
        return fallback(
          'incompatible',
          governedWaiverLoadReason ||
            'This Team Plan predates governed waiver history. Recreate it.'
        );
      }
      const matches = governedWaiverEntries.filter(
        (entry) => entry.playerId === playerId
      );
      if (matches.length !== 1) {
        return fallback(
          matches.length > 1 ? 'incompatible' : 'needs-input',
          matches.length > 1
            ? 'More than one governed Contract matches this player.'
            : 'Required governed Contract information is missing for this player.'
        );
      }
      return matches[0].availability;
    },
    [
      governedWaiverEntries,
      governedWaiverLoadReason,
      governedWaiverLoadState,
      worldId,
    ]
  );

  const getExtensionAvailability = useCallback(
    (player: ArchitectPlayer): GovernedExtensionAvailability => {
      const playerId = String(
        player.id || player.player_id || player.name || ''
      );
      const fallback = (
        status: 'needs-input' | 'incompatible',
        reason: string
      ): GovernedExtensionAvailability =>
        Object.freeze({
          status,
          playerId,
          contractId: null,
          reasons: Object.freeze([reason]),
          suggestedRoute: null,
          allowedRoutes: Object.freeze([]),
          firstExtendedSeason: null,
        });
      if (!worldId) {
        return fallback(
          'incompatible',
          'Open a fresh Team Plan to record this extension.'
        );
      }
      if (!playerId) {
        return fallback(
          'needs-input',
          'The exact player identity is required.'
        );
      }
      if (governedExtensionLoadState === 'loading') {
        return fallback(
          'needs-input',
          'Checking the pinned Contract, extension evidence, and league inputs…'
        );
      }
      if (governedExtensionLoadState === 'idle') {
        return fallback(
          'needs-input',
          'The team and Team Plan date must finish loading before this extension can be checked.'
        );
      }
      if (governedExtensionLoadState === 'incompatible') {
        return fallback(
          'incompatible',
          governedExtensionLoadReason ||
            'This Team Plan predates extension history. Recreate it.'
        );
      }
      const matches = governedExtensionEntries.filter(
        (entry) => entry.playerId === playerId
      );
      if (matches.length !== 1) {
        return fallback(
          matches.length > 1 ? 'incompatible' : 'needs-input',
          matches.length > 1
            ? 'More than one saved contract matches this player.'
            : 'Required contract information is missing for this player.'
        );
      }
      return matches[0].availability;
    },
    [
      governedExtensionEntries,
      governedExtensionLoadReason,
      governedExtensionLoadState,
      worldId,
    ]
  );

  const getOptionDecisionAvailability = useCallback(
    (
      player: ArchitectPlayer,
      targetYear: number | null | undefined
    ): GovernedOptionDecisionAvailability => {
      const playerId = String(
        player.id || player.player_id || player.name || ''
      );
      const hasTargetYear = targetYear !== null && targetYear !== undefined;
      const normalizedTargetYear = hasTargetYear
        ? Number(targetYear)
        : Number.NaN;
      const fallback = (
        status: 'needs-input' | 'incompatible',
        reason: string
      ): GovernedOptionDecisionAvailability =>
        Object.freeze({
          status,
          playerId,
          contractId: null,
          targetYear: normalizedTargetYear,
          optionType: null,
          reasons: Object.freeze([reason]),
          noticeRequirements: null,
        });
      if (!worldId) {
        return fallback(
          'incompatible',
          'Open a fresh governed Team Plan to record this option decision.'
        );
      }
      if (
        !playerId ||
        !hasTargetYear ||
        !Number.isInteger(normalizedTargetYear)
      ) {
        return fallback(
          'needs-input',
          'The player and exact option Season are required.'
        );
      }
      if (governedOptionLoadState === 'loading') {
        return fallback(
          'needs-input',
          'Checking the pinned contract deadline and notice terms…'
        );
      }
      if (governedOptionLoadState === 'idle') {
        return fallback(
          'needs-input',
          'The Team and governed Team Plan date must finish loading before this option can be checked.'
        );
      }
      if (governedOptionLoadState === 'incompatible') {
        return fallback(
          'incompatible',
          governedOptionLoadReason ||
            'This Team Plan predates governed option history. Recreate it.'
        );
      }
      const matches = governedOptionEntries.filter(
        (entry) =>
          entry.playerId === playerId &&
          entry.targetYear === normalizedTargetYear
      );
      if (matches.length !== 1) {
        return fallback(
          matches.length > 1 ? 'incompatible' : 'needs-input',
          matches.length > 1
            ? 'More than one governed Contract claims this option Season.'
            : 'No pinned governed Contract matches this player and option Season.'
        );
      }
      return matches[0].availability;
    },
    [
      governedOptionEntries,
      governedOptionLoadReason,
      governedOptionLoadState,
      worldId,
    ]
  );

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
      player:
        | PlayerRulesProfileInput
        | ArchitectDashboardPlayer
        | ArchitectPlayer
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
      player:
        | PlayerRulesProfileInput
        | ArchitectDashboardPlayer
        | ArchitectPlayer,
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
        eto: 'option',
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

  // Governed Rookie Scale / Veteran / Designated Veteran Extension path.
  const handleExtendContract = useCallback(
    async (
      player: ArchitectPlayer,
      extensionProposal: GovernedExtensionProposal
    ): Promise<MutationActionResult> => {
      const playerId = player.id || player.player_id || player.name;
      if (!playerId) {
        console.error('Extend player missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }
      const availability = getExtensionAvailability(player);
      if (availability.status !== 'ready' || !availability.contractId) {
        const message =
          availability.reasons[0] ||
          'This extension is unavailable because required contract or league information is incomplete.';
        reportMutationError(message, { playerId, availability });
        return { success: false, message };
      }
      if (!worldId || !worldAsOfDate || !userId || !teamCapSheet) {
        return {
          success: false,
          message:
            'A compatible saved Team Plan, exact date, and signed-in author are required.',
        };
      }
      const entry = governedExtensionEntries.find(
        (candidate) =>
          candidate.playerId === String(playerId) &&
          candidate.contractId === availability.contractId
      );
      if (!entry) {
        return {
          success: false,
          message: 'The extension information changed. Reload and try again.',
        };
      }
      const proposal = {
        ...extensionProposal,
        contractId: entry.contractId,
      };
      const preview = decideGovernedExtension({
        authority: entry.authority,
        worldId,
        teamId: teamCode,
        playerId: String(playerId),
        contractId: entry.contractId,
        worldAsOfDate,
        proposal,
        operationId: `preview:${entry.contractId}:extension`,
        authoringIdentity: userId,
        recordedAt: proposal.signedAt,
      });
      if (!preview.success) {
        const message = preview.reasons[0] || 'This extension is unavailable.';
        reportMutationError(message, {
          playerId,
          reasons: preview.reasons,
        });
        return { success: false, message };
      }
      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'extendPlayer',
        playerIds: [String(playerId)],
        invalidMessage: 'Extension blocked by post-state cap validation.',
        seasonIdOverride: toSeasonCode(entry.authority.baselineSalaryCapYear),
        yearOverride: entry.authority.baselineSalaryCapYear,
        computeNextTeam: (beforeTeam, context) => {
          const committedPreview = decideGovernedExtension({
            authority: entry.authority,
            worldId,
            teamId: teamCode,
            playerId: String(playerId),
            contractId: entry.contractId,
            worldAsOfDate,
            proposal,
            operationId: context.operationId,
            authoringIdentity: userId,
            recordedAt: context.occurredAt,
          });
          if (!committedPreview.success) {
            throw new Error(
              committedPreview.reasons[0] ||
                'The extension information changed before it could be saved.'
            );
          }
          return applyGovernedExtensionResult({
            team: beforeTeam as ArchitectMutationTeamRecord,
            playerId: String(playerId),
            result: committedPreview,
          }).team as CapSheet;
        },
        persistPayload: {
          teamCode,
          playerId,
          contractId: entry.contractId,
          extensionProposal: proposal,
        },
        receiptContext: {
          actionType: 'extension',
          headlineOverride: 'Extension saved',
          playerId,
          playerName:
            normalizeOptionalMutationString(
              player.displayName || player.name
            ) || null,
          affectedSeasons: proposal.salariesByYear.map((row) => row.season),
          effectAreas: ['contract', 'cap'],
          notes: [
            `${preview.route === 'designated-veteran' ? 'Designated Veteran' : preview.route === 'rookie-scale' ? 'Rookie Scale' : 'Veteran'} Extension saved from the required contract and league information.`,
          ],
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save extension. Please try again.'
      );
    },
    [
      applyCapAuditedTeamMutation,
      finalizeCapMutationResult,
      getExtensionAvailability,
      governedExtensionEntries,
      reportMutationError,
      teamCapSheet,
      teamCode,
      userId,
      worldAsOfDate,
      worldId,
    ]
  );

  // Governed ordinary unclaimed waiver / stretch / buyout path.
  const handleWaiveContract = useCallback(
    async (
      player: ArchitectPlayer,
      options: WaiveOptions
    ): Promise<MutationActionResult> => {
      const { stretch, buyout, waiverProposal, overrideUsed } = options;
      const playerId = player.id || player.player_id || player.name;
      if (!playerId) {
        console.error('Waive missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }

      if (overrideUsed) {
        return {
          success: false,
          message:
            'Governed waiver history cannot be bypassed with an override.',
        };
      }
      const availability = getWaiverAvailability(player);
      if (availability.status !== 'ready' || !availability.contractId) {
        const message =
          availability.reasons[0] ||
          'This waiver needs governed Contract or league information.';
        reportMutationError(message, { playerId, availability });
        return { success: false, message };
      }
      if (
        !worldId ||
        !worldAsOfDate ||
        !userId ||
        !teamCapSheet ||
        !waiverProposal
      ) {
        return {
          success: false,
          message:
            'A compatible saved Team Plan, exact League receipt, and signed-in author are required.',
        };
      }
      const entry = governedWaiverEntries.find(
        (candidate) =>
          candidate.playerId === String(playerId) &&
          candidate.contractId === availability.contractId
      );
      if (!entry) {
        return {
          success: false,
          message: 'The governed Contract changed. Reload and try again.',
        };
      }
      const proposal = {
        ...waiverProposal,
        contractId: entry.contractId,
      };
      const seasonEnvelope = resolveGovernedSeasonEnvelope({
        asOfDate: proposal.leagueReceivedAt,
        salaryCapYear: currentYear,
        requiredAuthority: 'official',
        team: { teamId: teamCode, teamCode, worldId },
      });
      const salaryCap =
        seasonEnvelope.systemLevels['salary-cap']?.amount ?? null;
      if (seasonEnvelope.status !== 'complete' || salaryCap === null) {
        const message =
          seasonEnvelope.unavailableReasons[0] ||
          'Governed Salary Cap and calendar inputs are unavailable.';
        reportMutationError(message, { playerId });
        return { success: false, message };
      }
      const playerName =
        normalizeOptionalMutationString(player.displayName || player.name) ||
        String(playerId);
      const preview = decideGovernedWaiver({
        authority: entry.authority,
        existingLifecycles: readGovernedWaiverLifecycles(teamCapSheet),
        existingDeadCap: teamCapSheet.deadCap,
        worldId,
        teamId: teamCode,
        playerId: String(playerId),
        playerName,
        contractId: entry.contractId,
        worldAsOfDate,
        salaryCapAtElection: salaryCap,
        proposal,
        operationId: `preview:${entry.contractId}:waiver`,
        authoringIdentity: userId,
        recordedAt: proposal.leagueReceivedAt,
      });
      if (!preview.success) {
        const message = preview.reasons[0] || 'This waiver needs input.';
        reportMutationError(message, { playerId, reasons: preview.reasons });
        return { success: false, message };
      }
      const confirmMsg = stretch
        ? `Place ${playerName} on irrevocable waivers and record the written Team Salary stretch election?`
        : buyout
          ? `Record the signed buyout and place ${playerName} on irrevocable waivers?`
          : `Place ${playerName} on irrevocable waivers?`;
      if (!window.confirm(confirmMsg)) {
        return {
          success: false,
          message: 'Action canceled. No changes were saved.',
        };
      }

      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'waivePlayer',
        playerIds: [String(playerId)],
        invalidMessage: 'Waive action blocked by post-state cap validation.',
        seasonIdOverride: toSeasonCode(currentYear),
        yearOverride: currentYear,
        computeNextTeam: (beforeTeam, context) => {
          const committedPreview = decideGovernedWaiver({
            authority: entry.authority,
            existingLifecycles: readGovernedWaiverLifecycles(beforeTeam),
            existingDeadCap: beforeTeam.deadCap,
            worldId,
            teamId: teamCode,
            playerId: String(playerId),
            playerName,
            contractId: entry.contractId,
            worldAsOfDate,
            salaryCapAtElection: salaryCap,
            proposal,
            operationId: context.operationId,
            authoringIdentity: userId,
            recordedAt: context.occurredAt,
          });
          if (!committedPreview.success) {
            throw new Error(
              committedPreview.reasons[0] ||
                'The waiver inputs changed before save.'
            );
          }
          return applyGovernedWaiverResult({
            team: beforeTeam as ArchitectMutationTeamRecord,
            playerId: String(playerId),
            result: committedPreview,
          }) as CapSheet;
        },
        persistPayload: {
          teamCode,
          playerId,
          contractId: entry.contractId,
          waiverProposal: proposal,
          stretch: !!stretch,
          stretchYears: preview.lifecycle.stretchYears ?? 0,
          buyout: !!buyout,
          buyoutAmount: preview.lifecycle.buyoutReduction,
        },
        receiptContext: {
          actionType: stretch ? 'waive-stretch' : buyout ? 'buyout' : 'waive',
          headlineOverride: stretch
            ? 'Waiver and stretch scheduled'
            : buyout
              ? 'Signed buyout waiver scheduled'
              : 'Waiver request recorded',
          playerId,
          playerName:
            normalizeOptionalMutationString(
              player.displayName || player.name
            ) || null,
          effectAreas: ['roster', 'deadMoney', 'cap'],
          notes: [
            `Player List removal is immediate; the Team remains financially responsible through ${preview.lifecycle.expiresAt}.`,
            buyout
              ? 'The written reduction is allocated pro rata across remaining protected Base Compensation.'
              : stretch
                ? 'Player payments stay on the original schedule; only Team Salary is re-attributed by the written election.'
                : 'Protected Base Compensation becomes dead salary only at ordinary unclaimed expiry.',
            'Set-off remains pending until authenticated later earnings exist.',
          ],
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save waive/buyout action. Please try again.'
      );
    },
    [
      applyCapAuditedTeamMutation,
      currentYear,
      finalizeCapMutationResult,
      getWaiverAvailability,
      governedWaiverEntries,
      reportMutationError,
      teamCapSheet,
      teamCode,
      userId,
      worldAsOfDate,
      worldId,
    ]
  );

  // Governed Full Cap Table TO/PO/ETO decision path.
  const handleOptionDecision = useCallback(
    async (
      player: ArchitectPlayer,
      accepted: boolean,
      _overrideMetadata?: OverrideMetadata | null,
      targetYearOverride?: number | null,
      notice?: GovernedOptionNoticeInput | null
    ): Promise<MutationActionResult> => {
      const playerId = player.id || player.player_id || player.name;
      if (!playerId) {
        return { success: false, message: 'Cannot save: Player ID missing.' };
      }
      if (!Number.isInteger(targetYearOverride)) {
        return {
          success: false,
          message: 'Cannot save: the exact governed option Season is missing.',
        };
      }
      const targetYear = targetYearOverride as number;
      const availability = getOptionDecisionAvailability(player, targetYear);
      if (availability.status !== 'ready' || !availability.contractId) {
        const message =
          availability.reasons[0] ||
          'This option decision needs governed source input.';
        reportMutationError(message, {
          playerId,
          targetYear,
          availability,
        });
        return { success: false, message };
      }
      if (!notice) {
        return {
          success: false,
          message:
            'Enter the exact governed notice delivery and league-forwarding evidence before saving.',
        };
      }
      if (!worldId || !worldAsOfDate || !userId || !teamCapSheet) {
        return {
          success: false,
          message:
            'A compatible saved Team Plan, governed date, and signed-in author are required.',
        };
      }
      const entry = governedOptionEntries.find(
        (candidate) =>
          candidate.playerId === String(playerId) &&
          candidate.targetYear === targetYear &&
          candidate.contractId === availability.contractId
      );
      if (!entry) {
        return {
          success: false,
          message:
            'The governed option authority changed. Reload and try again.',
        };
      }
      const preview = decideGovernedOption({
        authority: entry.authority,
        rightsLedger: teamCapSheet.rightsLedger,
        worldId,
        teamId: teamCode,
        playerId: String(playerId),
        contractId: entry.contractId,
        baselineSalaryCapYear: entry.authority.baselineSalaryCapYear,
        worldAsOfDate,
        targetYear,
        choice: accepted ? 'exercise' : 'decline',
        notice,
        operationId: `preview:${entry.contractId}:${targetYear}`,
        authoringIdentity: userId,
      });
      if (!preview.success) {
        const message =
          preview.reasons[0] || 'This option decision needs governed input.';
        reportMutationError(message, {
          playerId,
          targetYear,
          reasons: preview.reasons,
        });
        return { success: false, message };
      }
      const optionType = preview.optionType;
      const actionLabel =
        optionType === 'ETO'
          ? accepted
            ? 'ETO exercised'
            : 'ETO not exercised'
          : accepted
            ? `${optionType} exercised`
            : `${optionType} declined`;
      const mutationResult = applyCapAuditedTeamMutation({
        mutationType: 'optionDecision',
        playerIds: [String(playerId)],
        invalidMessage: 'Option decision blocked by post-state cap validation.',
        seasonIdOverride: toSeasonCode(entry.authority.baselineSalaryCapYear),
        yearOverride: entry.authority.baselineSalaryCapYear,
        computeNextTeam: (beforeTeam, context) => {
          const committedPreview = decideGovernedOption({
            authority: entry.authority,
            rightsLedger: beforeTeam.rightsLedger,
            worldId,
            teamId: teamCode,
            playerId: String(playerId),
            contractId: entry.contractId,
            baselineSalaryCapYear: entry.authority.baselineSalaryCapYear,
            worldAsOfDate,
            targetYear,
            choice: accepted ? 'exercise' : 'decline',
            notice,
            operationId: context.operationId,
            authoringIdentity: userId,
          });
          if (!committedPreview.success) {
            throw new Error(
              committedPreview.reasons[0] ||
                'The governed option decision changed before local apply.'
            );
          }
          return applyGovernedOptionResult({
            team: beforeTeam as ArchitectMutationTeamRecord,
            playerId: String(playerId),
            result: committedPreview,
          }).team as CapSheet;
        },
        persistPayload: {
          teamCode,
          playerId,
          accepted,
          targetYear,
          contractId: entry.contractId,
          optionNotice: notice,
        },
        receiptContext: {
          actionType:
            optionType === 'ETO'
              ? accepted
                ? 'eto-exercise'
                : 'eto-decline'
              : accepted
                ? 'option-accept'
                : 'option-decline',
          headlineOverride: actionLabel,
          playerId,
          playerName:
            normalizeOptionalMutationString(
              player.displayName || player.name
            ) || null,
          affectedSeasons: [toSeasonCode(targetYear)],
          effectAreas: ['roster', 'rights', 'cap', 'contract'],
        },
      });

      return finalizeCapMutationResult(
        mutationResult,
        'Failed to save option decision. Please try again.'
      );
    },
    [
      applyCapAuditedTeamMutation,
      finalizeCapMutationResult,
      getOptionDecisionAvailability,
      governedOptionEntries,
      reportMutationError,
      teamCapSheet,
      teamCode,
      userId,
      worldAsOfDate,
      worldId,
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
    getWaiverAvailability,
    getExtensionAvailability,
    getOptionDecisionAvailability,
    handleRenounceRights,
    capSheetDevTools,
    teamHistoryDevTools,
  };
}
