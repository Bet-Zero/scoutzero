/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.ts
 * PURPOSE: Centralized action handlers for GMDashboard - manages all user interactions and mutations.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-12: Created - extracted all handlers from GMDashboard.jsx (Phase 3 refactor)
 *  - 2025-12-12: Converted to TypeScript with proper type annotations
 *  - 2025-12-14: Option B refactor - removed capSheetState dependency, all mutations now update teamCapSheet directly
 *  - 2026-01-18: Phase 7.2 option decline FA-year derivation + cap hold multipliers
 *
 * LINKS:
 *  - Plan: plans/cap-sheet-contract-rules-phase-7-2/plan.md
 */
import { useCallback, useMemo } from 'react';
import { loadArchitectBasePlayer } from '@/features/architect/utils/loadArchitectBasePlayer';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import capProjections from '@/features/architect/utils/capProjections';
import {
  applyWorldMutation,
  computeWorldMutation,
} from '@/features/architect/utils/mutationPipeline';
import {
  loadWorldTeamData,
  resolveTeamCode,
} from '@/features/architect/utils/worldTeamData';
import {
  computeExpectedCapHoldAmount,
  deriveFreeAgencyYearFromOptionSeason,
  getRightsTypeFromPlayer,
} from '@/features/architect/utils/capHoldTransitionHelpers';
import { validateSigning } from '@/features/architect/utils/capLegalityValidation';
import toast from 'react-hot-toast';

// ==== Type Definitions ====

/** Salary entry by year in a contract */
interface SalaryByYear {
  season: string;
  salary?: number;
  option?: string;
  optionType?: string;
  capHit?: number;
  guaranteed?: boolean;
  optionUsed?: boolean | null; // CANONICAL: boolean, not string
}

/** Local contract structure for architect actions (avoids schema naming pattern) */
interface LocalContract {
  salariesByYear?: SalaryByYear[];
  birdRights?: {
    status?: string;
    yearsOfService?: number;
    yearsWithTeam?: number;
    eligibleFor?: string[];
  };
  contractType?: string;
  isExtension?: boolean;
  isRookieScale?: boolean;
  signingTeam?: string;
  [key: string]: unknown;
}

/** Bio structure for player data (avoids schema naming pattern) */
interface LocalBio {
  playerId?: string;
  displayName?: string;
  position?: string;
  age?: number;
  [key: string]: unknown;
}

/** Player data structure */
interface ArchitectPlayer {
  id?: string;
  player_id?: string;
  name?: string;
  displayName?: string;
  position?: string;
  formattedPosition?: string;
  age?: number | null;
  teamCode?: string;
  teamName?: string;
  contract?: LocalContract | null;
  futureContract?: LocalContract | null;
  bio?: LocalBio;
  representation?: unknown;
  options?: Record<string, unknown>;
  isMinimum?: boolean;
  yearsOfService?: number;
  guaranteed?: boolean;
  signAndTrade?: boolean;
  contractType?: string;
  isExtension?: boolean;
  isRookieScale?: boolean;
  [key: string]: unknown;
}

/** Trade data item for a single team */
interface TradeDataItem {
  teamId: string;
  incoming?: ArchitectPlayer[];
  outgoing?: ArchitectPlayer[];
  /** TM-PICKS-E1: Entitlements this team is trading away */
  outgoingEntitlements?: Record<string, unknown>[];
  /** TM-PICKS-E1: Entitlements this team is receiving */
  incomingEntitlements?: Record<string, unknown>[];
  /** Alias used by exportCurrentTrade */
  outgoingPlayers?: ArchitectPlayer[];
  incomingPlayers?: ArchitectPlayer[];
}

/** Contract details for signing/saving (avoids schema naming pattern) */
interface SigningDetails {
  salariesByYear?: SalaryByYear[];
  options?: Record<string, unknown>;
  signAndTrade?: boolean;
  guaranteed?: boolean;
  isMinimum?: boolean;
  yearsOfService?: number;
  contractType?: string;
  isExtension?: boolean;
  isRookieScale?: boolean;
  // Override metadata when action bypasses validation
  overrideUsed?: boolean;
  overrideReasons?: string[];
  overrideTimestamp?: string;
  [key: string]: unknown;
}

/** Waive options */
interface WaiveOptions {
  stretch?: boolean;
  buyout?: boolean;
  buyoutAmount?: number;
  // Override metadata when action bypasses validation
  overrideUsed?: boolean;
  overrideReasons?: string[];
  overrideTimestamp?: string;
}

/** Active contract entry in cap sheet */
interface ActiveContract {
  name?: string;
  player_id?: string;
  id?: string;
  years?: number;
  options?: Record<string, unknown>;
  type?: string;
  signAndTrade?: boolean;
  guaranteed?: boolean;
  isMinimum?: boolean;
  yearsOfService?: number;
  contract?: LocalContract;
  [key: string]: unknown;
}

/** Cap hold structure */
interface CapHold {
  playerId: string;
  playerName: string;
  amount: number;
  season: string;
  type: string;
  active: boolean;
  isSigned: boolean;
  reason?: string;
  notes?: string;
}

/** Override audit log entry */
interface OverrideAuditEntry {
  actionType: string;
  timestamp: string;
  reasons: string[];
  overrideUsed: true;
  playerId?: string;
  playerName?: string;
}

/** Cap sheet structure */
interface CapSheet {
  teamCode?: string;
  teamName?: string;
  players?: ArchitectPlayer[];
  activeContracts?: ActiveContract[];
  waivedContracts?: unknown[];
  tradeExceptions?: unknown[];
  exceptionHistory?: unknown[];
  mleHistory?: unknown[];
  pickLog?: unknown[];
  currentPicks?: Record<string, unknown>;
  deadCap?: unknown[];
  capHolds?: CapHold[];
  exceptions?: unknown;
  draftPicks?: unknown[];
  totals?: unknown;
  amount?: number;
  overrideAuditLog?: OverrideAuditEntry[];
  [key: string]: unknown;
}

/** Override metadata passed from EditContractModal when bypassing validation */
interface OverrideMetadata {
  overrideUsed: boolean;
  overrideReasons: string[];
  overrideTimestamp: string;
}

/** Free agent type extending ArchitectPlayer */
interface FreeAgent extends ArchitectPlayer {
  previousSalary: number;
  birdRights: string;
  freeAgentType: 'UFA' | 'RFA' | 'PO' | 'TO';
}

interface OfferSheet {
  id?: string;
  status?: string;
  offeringTeamCode?: string;
  homeTeamCode?: string;
  dedupKey?: string;
  playerId?: string;
  seasonKey?: string;
  [key: string]: unknown;
}

import type { ActionContext, EditModalContext } from './useArchitectModals';

/** Map of players by various keys for fast lookup */
type PlayersMap = Record<string, ArchitectPlayer>;

/** State object from useArchitectState (subset needed by actions) */
interface ArchitectStateForActions {
  teamCapSheet: CapSheet | null;
  currentYear: number;
  setTeamCapSheet: React.Dispatch<React.SetStateAction<CapSheet | null>>;
  setSelectedRulesYear: React.Dispatch<React.SetStateAction<number>>;
  setSelectedPlayer: React.Dispatch<
    React.SetStateAction<ArchitectPlayer | null>
  >;
  setFreeAgents: React.Dispatch<React.SetStateAction<FreeAgent[]>>;
  startSave: () => void;
  finishSave: (errorMsg?: string) => void;
  setOffseasonRun: React.Dispatch<React.SetStateAction<boolean>>;
  setOffseasonSummary: React.Dispatch<React.SetStateAction<unknown | null>>;
  refreshWorldRosterIndex: () => Promise<Set<string>>;
}

/** Modal helpers from useArchitectModals (subset needed by actions) */
interface ArchitectModalsForActions {
  openContractModal: (context?: EditModalContext) => void;
  closeContractModal: () => void;
}

/** Hook input parameters */
export interface UseArchitectActionsParams {
  teamId: string;
  userId: string | null;
  authLoading?: boolean;
  state: ArchitectStateForActions;
  playersMap: PlayersMap;
  modals: ArchitectModalsForActions;
  worldId: string | null;
  seasonId: string;
}

/** Return type of the useArchitectActions hook */
export interface UseArchitectActionsReturn {
  // Contract/Player actions
  handleSign: (playerObj: ArchitectPlayer, contract: SigningDetails) => void;
  handleSignAndTrade: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails,
    destinationTeamCode: string
  ) => void;
  handleEditContract: (player: ArchitectPlayer) => void;
  handleCapSheetAction: (
    player: ArchitectPlayer,
    actionType: string,
    year?: number
  ) => void;
  handleSaveContract: (
    player: ArchitectPlayer,
    contractData: SigningDetails
  ) => void;
  handleExtendContract: (
    player: ArchitectPlayer,
    extensionContract: SigningDetails
  ) => void;
  handleWaiveContract: (player: ArchitectPlayer, options: WaiveOptions) => void;
  handleOptionDecision: (
    player: ArchitectPlayer,
    accepted: boolean,
    overrideMetadata?: OverrideMetadata | null
  ) => void;
  handleRenounceRights: (
    player: ArchitectPlayer,
    overrideMetadata?: OverrideMetadata | null
  ) => void;
  handleUpdateRoster: (updatedCapSheet: CapSheet) => void;
  handleResetCapSheet: () => void;

  // RFA Offer Sheet Actions (Phase 16)
  handleStoreOfferSheet: (
    playerObj: ArchitectPlayer,
    contract: SigningDetails
  ) => void;
  handleMatchOfferSheet: (
    offeringTeamCode: string,
    offerSheetId: string
  ) => void;
  handleDeclineOfferSheet: (
    offeringTeamCode: string,
    offerSheetId: string
  ) => void;
  handleFinalizeOfferSheet: (offerSheet: OfferSheet | null | undefined) => void;

  // Trade actions
  applyTradeToCapSheet: (tradeData: TradeDataItem[]) => Promise<void>;

  // Manual Dead Money (Phase 24)
  handleSetDeadCap: (deadCap: any[]) => void;

  // Manual Exception Management (Phase 27)
  handleSetExceptions: (exceptions: Record<string, any>) => void;
}

// ==== Season helpers ====
// Phase 3.1: Use canonical toSeasonKey from seasonFormat
import { toSeasonKey } from '@/features/architect/utils/seasonFormat';

// Helper to ensure contract has proper structure
const ensureContractStructure = (
  contract: LocalContract | null | undefined,
  overrides: Partial<LocalContract> = {}
): LocalContract | null => {
  if (!contract) return null;

  // If contract already has salariesByYear array, use it directly
  if (contract.salariesByYear && Array.isArray(contract.salariesByYear)) {
    return {
      ...contract,
      ...overrides,
    };
  }

  // If no contract data, return null
  return null;
};

/**
 * Helper to record override audit entry in cap sheet
 */
const recordOverrideAudit = (
  prev: CapSheet | null,
  actionType: string,
  reasons: string[],
  playerId?: string,
  playerName?: string
): OverrideAuditEntry[] => {
  const existingLog = prev?.overrideAuditLog || [];
  const newEntry: OverrideAuditEntry = {
    actionType,
    timestamp: new Date().toISOString(),
    reasons,
    overrideUsed: true,
    playerId,
    playerName,
  };
  return [...existingLog, newEntry];
};

/**
 * Centralized action handlers hook for GMDashboard
 *
 * @param params - Hook parameters
 * @returns All action handlers
 */
export function useArchitectActions({
  teamId,
  userId,
  // authLoading is available but not currently used by handlers
  state,
  playersMap,
  modals,
  worldId,
  seasonId,
}: UseArchitectActionsParams): UseArchitectActionsReturn {
  // Normalize teamId (route slug like "lakers") to canonical teamCode (like "LAL")
  // This ensures all mutation payloads use the same team code format as Firestore base teams
  const teamCode = useMemo(() => resolveTeamCode(teamId) || teamId, [teamId]);

  // Destructure state for easier access
  const {
    teamCapSheet,
    currentYear,
    setTeamCapSheet,
    setSelectedRulesYear,
    setSelectedPlayer,
    setFreeAgents,
    startSave,
    finishSave,
    setOffseasonRun,
    setOffseasonSummary,
    refreshWorldRosterIndex,
  } = state;

  // Destructure modals for easier access
  const { openContractModal, closeContractModal } = modals;

  // === Persistence Helper ===
  /**
   * Persist mutation to Firestore if in world mode.
   * Skips persistence when worldId is null (base mode) or userId is missing.
   */
  const persistMutation = useCallback(
    async (
      mutationType: string,
      payload: Record<string, unknown>
    ): Promise<void> => {
      // Base mode: no persistence
      if (!worldId) return;
      // Cannot persist without userId
      if (!userId) {
        console.warn('[Architect] Cannot save: missing userId');
        return;
      }

      try {
        console.log(`💾 Saving ${mutationType}...`);
        const result = await applyWorldMutation({
          userId,
          worldId,
          seasonId,
          mutationType,
          payload,
        });

        if (result.success) {
          console.log(`✅ Saved ${mutationType}!`, result);
          toast.success('Saved changes');
        } else {
          console.error(`❌ Save failed:`, result.error);
          toast.error(`Save failed: ${result.error}`);
        }
      } catch (err) {
        console.error('[Architect][PersistMutation] failed', {
          mutationType,
          payload,
          err,
        });
        toast.error('Failed to save changes');
      }
    },
    [worldId, userId, seasonId]
  );

  const reportMutationError = useCallback(
    (message: string, details?: Record<string, unknown>): void => {
      console.error('[Architect][FreeAgency]', message, {
        teamCode,
        worldId,
        ...details,
      });
      toast.error(message);
    },
    [teamCode, worldId]
  );

  const syncTeamFromMutationResult = useCallback(
    async (mutationType: string, result: any): Promise<void> => {
      const changedTeams = Array.isArray(result?.changedTeams)
        ? result.changedTeams
        : [];
      const currentTeamUpdate = changedTeams.find(
        (update: any) => update?.teamCode === teamCode && update?.team
      );

      if (currentTeamUpdate?.team) {
        setTeamCapSheet(currentTeamUpdate.team as CapSheet);
      } else if (worldId) {
        const refreshedTeam = await loadWorldTeamData(worldId, teamCode);
        if (refreshedTeam) {
          setTeamCapSheet(refreshedTeam as CapSheet);
        }
      }

      try {
        await refreshWorldRosterIndex();
      } catch (error) {
        console.warn(
          `[Architect][FreeAgency] Failed to refresh roster index after ${mutationType}:`,
          error
        );
      }
    },
    [refreshWorldRosterIndex, setTeamCapSheet, teamCode, worldId]
  );

  const runAuthoritativeFAMutation = useCallback(
    async (
      mutationType: string,
      payload: Record<string, unknown>,
      options: {
        worldRequiredMessage?: string;
      } = {}
    ): Promise<any> => {
      if (!worldId) {
        const message =
          options.worldRequiredMessage ||
          'This action requires an active world to commit.';
        reportMutationError(message, { mutationType, payload });
        return { success: false, error: message };
      }

      if (!userId) {
        const message = 'Cannot save changes: missing user identity.';
        reportMutationError(message, { mutationType, payload });
        return { success: false, error: message };
      }

      startSave();
      try {
        const result = await applyWorldMutation({
          userId,
          worldId,
          seasonId,
          mutationType,
          payload,
        });

        if (!result.success) {
          const message =
            result.error || `Failed to run ${mutationType} mutation.`;
          reportMutationError(message, { mutationType, payload, result });
          finishSave(message);
          return result;
        }

        await syncTeamFromMutationResult(mutationType, result);
        toast.success('Saved changes');
        finishSave();
        return result;
      } catch (error: any) {
        const message =
          error?.message || `Failed to run ${mutationType} mutation.`;
        reportMutationError(message, { mutationType, payload, error });
        finishSave(message);
        return { success: false, error: message };
      }
    },
    [
      finishSave,
      reportMutationError,
      seasonId,
      startSave,
      syncTeamFromMutationResult,
      userId,
      worldId,
    ]
  );

  // === Trade Actions ===

  const applyTradeToCapSheet = useCallback(
    async (tradeData: TradeDataItem[]): Promise<void> => {
      if (!tradeData || !Array.isArray(tradeData)) return;

      // Persist to world if in world mode
      // Transform tradeData to mutation pipeline format
      // Note: Each team's teamId needs to be resolved to canonical teamCode
      const teams = tradeData.map((t) => ({
        teamCode: resolveTeamCode(t.teamId) || t.teamId,
        sends: (
          (t.outgoing || t.outgoingPlayers || []) as ArchitectPlayer[]
        ).map((p) => ({
          ...p,
          // Explicitly map ID for pipeline consumption
          playerId: p.id || p.player_id,
        })),
        picksOut: [],
        // TM-PICKS-E1: Include outgoing entitlements in persistence payload
        outgoingEntitlements: t.outgoingEntitlements || [],
        entitlementsOut: t.outgoingEntitlements || [],
      }));

      // Validation guard
      for (const team of teams) {
        for (const player of team.sends) {
          if (!player.playerId) {
            console.error('Trade missing playerId', { player, team });
            toast.error('Cannot save trade: Player ID missing');
            throw new Error(
              `Trade missing playerId for ${player.name || 'unknown'}`
            );
          }
        }
      }

      if (worldId) {
        await runAuthoritativeFAMutation('executeTrade', { teams });
        return;
      }

      const updated: CapSheet = {
        ...teamCapSheet,
        activeContracts: teamCapSheet?.activeContracts || [],
        players: teamCapSheet?.players || [],
      };

      const targetTrade = tradeData.find((t) => t.teamId === teamId);
      if (!targetTrade) return;

      const incoming =
        targetTrade.incoming || targetTrade.incomingPlayers || [];
      const outgoing =
        targetTrade.outgoing || targetTrade.outgoingPlayers || [];

      const normalize = (str: string = ''): string =>
        str.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isSamePlayer = (
        a: ActiveContract | ArchitectPlayer,
        b: ArchitectPlayer
      ): boolean => {
        const aId = a.player_id || a.id;
        const bId = b.id || b.player_id;
        if (aId && bId) return aId === bId;
        return normalize(a.name || '') === normalize(b.name || '');
      };

      updated.players = (updated.players || []).filter(
        (player) => !outgoing.some((out) => isSamePlayer(player, out))
      );

      updated.activeContracts = (updated.activeContracts || []).filter(
        (contract) => !outgoing.some((out) => isSamePlayer(contract, out))
      );

      const newContracts: ActiveContract[] = incoming.map((p) => {
        const architectContract = ensureContractStructure(p.contract || null, {
          contractType: p.contractType || 'Trade',
          isExtension: !!p.isExtension,
          isRookieScale: !!p.isRookieScale,
          signingTeam: teamCode,
        });

        return {
          name: p.name,
          player_id: p.id || p.player_id,
          years: architectContract?.salariesByYear?.length || 1,
          options: p.options || {},
          type: 'Trade',
          signAndTrade: !!p.signAndTrade,
          guaranteed: p.guaranteed ?? true,
          isMinimum: p.isMinimum ?? false,
          yearsOfService: p.yearsOfService ?? 0,
          contract: architectContract || undefined,
        };
      });

      const newPlayers: ArchitectPlayer[] = await Promise.all(
        incoming.map(async (p) => {
          const base =
            playersMap[p.name || ''] || playersMap[p.player_id || ''] || null;
          let playerData = base;
          if (!playerData && (p.id || p.player_id)) {
            try {
              const loaded = await loadArchitectBasePlayer(
                p.id || p.player_id || '',
                p.name
              );
              if (loaded) playerData = loaded;
            } catch (err) {
              console.warn(`Failed to load player ${p.id || p.player_id}:`, err);
            }
          }

          const architectContract = ensureContractStructure(
            p.contract || playerData?.contract || null,
            {
              contractType: p.contractType || 'Trade',
              isExtension: !!p.isExtension,
              isRookieScale: !!p.isRookieScale,
              signingTeam: teamCode,
            }
          );

          const position =
            playerData?.position ||
            playerData?.formattedPosition ||
            getPlayerPositionLabel(
              playerData?.bio?.position || p.position || ''
            );
          return {
            ...(playerData || {}),
            name: playerData?.name || p.name,
            player_id: p.id || p.player_id || playerData?.player_id,
            displayName:
              playerData?.bio?.displayName || p.bio?.displayName || p.name,
            position,
            contract: architectContract || playerData?.contract,
          };
        })
      );

      updated.activeContracts?.push(...newContracts);
      updated.players?.push(...newPlayers);

      const outgoingEntitlements = targetTrade.outgoingEntitlements || [];
      const incomingEntitlements = targetTrade.incomingEntitlements || [];
      const outgoingEntitlementIds = outgoingEntitlements
        .map(
          (e: Record<string, unknown>) => (e.entitlementId || e.id) as string
        )
        .filter(Boolean);
      const incomingEntitlementIds = incomingEntitlements
        .map(
          (e: Record<string, unknown>) => (e.entitlementId || e.id) as string
        )
        .filter(Boolean);

      if (
        outgoingEntitlementIds.length > 0 ||
        incomingEntitlementIds.length > 0
      ) {
        const currentEntitlementIds: string[] =
          ((updated as Record<string, unknown>).entitlementIds as string[]) ||
          [];
        (updated as Record<string, unknown>).entitlementIds = [
          ...currentEntitlementIds.filter(
            (id: string) => !outgoingEntitlementIds.includes(id)
          ),
          ...incomingEntitlementIds,
        ];
      }

      setTeamCapSheet(updated);
    },
    [
      teamCapSheet,
      teamCode,
      teamId,
      playersMap,
      runAuthoritativeFAMutation,
      setTeamCapSheet,
      worldId,
    ]
  );

  // === Contract/Player Actions ===

  const handleSign = useCallback(
    (playerObj: ArchitectPlayer, contract: SigningDetails): void => {
      void (async () => {
        const idToSign = playerObj.id || playerObj.player_id;
        if (!idToSign) {
          reportMutationError('Cannot sign player: missing player ID.', {
            playerObj,
          });
          return;
        }

        const architectContract = ensureContractStructure(
          contract as LocalContract,
          {
            contractType: contract.contractType || 'Signed FA',
            isExtension: !!contract.isExtension,
            isRookieScale: !!contract.isRookieScale,
            signingTeam: teamCode,
          }
        );

        if (!architectContract) {
          reportMutationError(
            'Cannot sign player: contract payload is missing salaries.',
            {
              playerId: idToSign,
              contract,
            }
          );
          return;
        }

        const signingPayload = {
          teamCode,
          playerId: idToSign,
          contract: architectContract,
          signedUsing: contract.signedUsing || null,
        };

        if (worldId) {
          const result = await runAuthoritativeFAMutation(
            'signFreeAgent',
            signingPayload,
            {
              worldRequiredMessage:
                'Signing requires an active world to commit.',
            }
          );

          if (result?.success) {
            setFreeAgents((prev) =>
              prev.filter(
                (p) =>
                  p.name !== playerObj.name &&
                  p.id !== playerObj.id &&
                  p.player_id !== playerObj.player_id
              )
            );
          }
          return;
        }

        if (!teamCapSheet) {
          reportMutationError(
            'Cannot sign player in vacuum mode: team state is not loaded.',
            {
              playerId: idToSign,
            }
          );
          return;
        }

        const canonicalPlayer =
          playersMap[playerObj.name || ''] ||
          playersMap[playerObj.player_id || ''] ||
          playersMap[playerObj.id || ''] ||
          playerObj;

        const validation = validateSigning({
          team: teamCapSheet,
          player: canonicalPlayer,
          contract: architectContract,
          signedUsing: contract.signedUsing || null,
          year: currentYear,
        });

        if (!validation.valid) {
          const firstViolation = validation.violations?.[0];
          reportMutationError(
            firstViolation?.message ||
              'Signing failed cap validation in vacuum mode.',
            {
              playerId: idToSign,
              violations: validation.violations,
            }
          );
          return;
        }

        const computeResult = computeWorldMutation({
          mutationType: 'signFreeAgent',
          payload: signingPayload,
          currentState: {
            team: teamCapSheet,
            player: canonicalPlayer,
            teamCode,
          },
          seasonId,
          timestamp: Date.now(),
          worldId: null,
        });

        if (!computeResult.success) {
          reportMutationError(
            computeResult.error ||
              'Unable to apply signing in vacuum mode with canonical compute.',
            {
              playerId: idToSign,
              computeResult,
            }
          );
          return;
        }

        const updatedTeam = computeResult.teamUpdates?.find(
          (update: any) => update?.teamCode === teamCode && update?.team
        )?.team;

        if (!updatedTeam) {
          reportMutationError(
            'Signing compute succeeded but no updated team snapshot was returned.',
            {
              playerId: idToSign,
              computeResult,
            }
          );
          return;
        }

        setTeamCapSheet(updatedTeam as CapSheet);
        setFreeAgents((prev) =>
          prev.filter(
            (p) =>
              p.name !== playerObj.name &&
              p.id !== playerObj.id &&
              p.player_id !== playerObj.player_id
          )
        );
      })();
    },
    [
      currentYear,
      playersMap,
      reportMutationError,
      runAuthoritativeFAMutation,
      seasonId,
      setFreeAgents,
      setTeamCapSheet,
      teamCapSheet,
      teamCode,
      worldId,
    ]
  );

  const handleSignAndTrade = useCallback(
    (
      playerObj: ArchitectPlayer,
      contract: SigningDetails,
      destinationTeamCode: string
    ): void => {
      void (async () => {
        if (!worldId) {
          reportMutationError(
            'Sign-and-trade requires an active world to commit.',
            {
              playerObj,
              destinationTeamCode,
            }
          );
          return;
        }

        if (!destinationTeamCode) {
          reportMutationError(
            'Cannot complete sign-and-trade: destination team is required.',
            {
              playerObj,
            }
          );
          return;
        }

        const playerId = playerObj.id || playerObj.player_id;
        if (!playerId) {
          reportMutationError(
            'Cannot complete sign-and-trade: missing player ID.',
            { playerObj }
          );
          return;
        }

        const architectContract = ensureContractStructure(
          contract as LocalContract,
          {
            contractType: 'Sign & Trade',
            isExtension: false,
            isRookieScale: !!contract.isRookieScale,
            signingTeam: teamCode,
          }
        );

        if (!architectContract) {
          reportMutationError(
            'Cannot complete sign-and-trade: contract payload is invalid.',
            {
              playerId,
              contract,
            }
          );
          return;
        }

        await runAuthoritativeFAMutation(
          'signAndTrade',
          {
            teamCode,
            destinationTeamCode,
            playerId,
            contract: architectContract,
            signedUsing: contract.signedUsing || null,
            signAndTrade: true,
          },
          {
            worldRequiredMessage:
              'Sign-and-trade requires an active world to commit.',
          }
        );
      })();
    },
    [reportMutationError, runAuthoritativeFAMutation, teamCode, worldId]
  );

  // === RFA Offer Sheet Actions ===

  const handleStoreOfferSheet = useCallback(
    (playerObj: ArchitectPlayer, contract: SigningDetails): void => {
      void (async () => {
        if (!worldId) {
          reportMutationError(
            'Offer sheet actions require an active world to commit.',
            {
              playerObj,
            }
          );
          return;
        }

        const playerId = playerObj.id || playerObj.player_id;
        if (!playerId) {
          reportMutationError('Cannot store offer sheet: missing player ID.', {
            playerObj,
          });
          return;
        }

        const offerContract = ensureContractStructure(
          contract as LocalContract,
          {
            ...contract,
            contractType: 'Offer Sheet',
            signingTeam: teamCode,
            rfaOfferSheet: true,
            rfaOfferSheetOnly: true,
            rfaOfferSheetStatus: 'PENDING_MATCH',
          }
        );

        if (!offerContract) {
          reportMutationError(
            'Cannot store offer sheet: contract payload is invalid.',
            {
              playerId,
              contract,
            }
          );
          return;
        }

        await runAuthoritativeFAMutation(
          'storeOfferSheet',
          {
            teamCode,
            playerId,
            worldId,
            contract: offerContract,
            signedUsing: contract.signedUsing || null,
          },
          {
            worldRequiredMessage:
              'Offer sheet actions require an active world to commit.',
          }
        );
      })();
    },
    [reportMutationError, runAuthoritativeFAMutation, teamCode, worldId]
  );

  const handleMatchOfferSheet = useCallback(
    (offeringTeamCode: string, offerSheetId: string): void => {
      void (async () => {
        if (!worldId) {
          reportMutationError(
            'Offer sheet actions require an active world to commit.',
            { offeringTeamCode, offerSheetId }
          );
          return;
        }

        if (!offeringTeamCode || !offerSheetId) {
          reportMutationError(
            'Cannot match offer sheet: missing offering team or offer sheet ID.',
            {
              offeringTeamCode,
              offerSheetId,
            }
          );
          return;
        }

        await runAuthoritativeFAMutation(
          'matchOfferSheet',
          {
            teamCode,
            offeringTeamCode,
            offerSheetId,
          },
          {
            worldRequiredMessage:
              'Offer sheet actions require an active world to commit.',
          }
        );
      })();
    },
    [reportMutationError, runAuthoritativeFAMutation, teamCode, worldId]
  );

  const handleDeclineOfferSheet = useCallback(
    (offeringTeamCode: string, offerSheetId: string): void => {
      void (async () => {
        if (!worldId) {
          reportMutationError(
            'Offer sheet actions require an active world to commit.',
            { offeringTeamCode, offerSheetId }
          );
          return;
        }

        if (!offeringTeamCode || !offerSheetId) {
          reportMutationError(
            'Cannot decline offer sheet: missing offering team or offer sheet ID.',
            {
              offeringTeamCode,
              offerSheetId,
            }
          );
          return;
        }

        await runAuthoritativeFAMutation(
          'declineOfferSheet',
          {
            teamCode,
            offeringTeamCode,
            offerSheetId,
          },
          {
            worldRequiredMessage:
              'Offer sheet actions require an active world to commit.',
          }
        );
      })();
    },
    [reportMutationError, runAuthoritativeFAMutation, teamCode, worldId]
  );

  const handleFinalizeOfferSheet = useCallback(
    (offerSheet: OfferSheet | null | undefined): void => {
      void (async () => {
        if (!worldId) {
          reportMutationError(
            'Offer sheet actions require an active world to commit.',
            {
              offerSheet,
            }
          );
          return;
        }

        if (!offerSheet) {
          reportMutationError(
            'Cannot finalize offer sheet: offer sheet data is missing.'
          );
          return;
        }

        if (!offerSheet.id) {
          reportMutationError(
            'Cannot finalize offer sheet: missing offer sheet ID.',
            {
              offerSheet,
            }
          );
          return;
        }

        if (
          offerSheet.status === 'MATCHED' &&
          offerSheet.homeTeamCode === teamCode
        ) {
          await runAuthoritativeFAMutation(
            'finalizeMatchedOfferSheet',
            {
              teamCode,
              offeringTeamCode: offerSheet.offeringTeamCode,
              offerSheetId: offerSheet.id,
            },
            {
              worldRequiredMessage:
                'Offer sheet actions require an active world to commit.',
            }
          );
          return;
        }

        if (
          offerSheet.status === 'DECLINED' &&
          offerSheet.offeringTeamCode === teamCode
        ) {
          await runAuthoritativeFAMutation(
            'finalizeDeclinedOfferSheet',
            {
              teamCode,
              offeringTeamCode: teamCode,
              homeTeamCode: offerSheet.homeTeamCode,
              offerSheetId: offerSheet.id,
              dedupKey: offerSheet.dedupKey,
              playerId: offerSheet.playerId,
              seasonKey: offerSheet.seasonKey,
            },
            {
              worldRequiredMessage:
                'Offer sheet actions require an active world to commit.',
            }
          );
          return;
        }

        reportMutationError(
          `Cannot finalize offer sheet: status/team mismatch (status=${offerSheet.status || 'unknown'}).`,
          {
            offerSheet,
          }
        );
      })();
    },
    [reportMutationError, runAuthoritativeFAMutation, teamCode, worldId]
  );

  // === Dead Money Actions (Phase 24) ===
  const handleSetDeadCap = useCallback(
    (deadCap: any[]): void => {
      // Optimistic update
      setTeamCapSheet((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          deadCap,
        };
      });

      persistMutation('setDeadCap', {
        teamCode,
        deadCap,
      });
    },
    [teamCode, persistMutation, setTeamCapSheet]
  );

  // === Exception Management Actions (Phase 27) ===
  const handleSetExceptions = useCallback(
    (exceptions: Record<string, any>): void => {
      // Optimistic update
      setTeamCapSheet((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          exceptions,
        };
      });

      persistMutation('setExceptions', {
        teamCode,
        exceptions,
      });
    },
    [teamCode, persistMutation, setTeamCapSheet]
  );

  const handleEditContract = useCallback(
    (player: ArchitectPlayer): void => {
      setSelectedPlayer(player);
      setSelectedRulesYear(currentYear);
      // No pre-selection when just clicking player name - show based on player state
      openContractModal({
        initialAction: null,
        targetYear: null,
        actionContext: null,
      });
    },
    [currentYear, setSelectedPlayer, setSelectedRulesYear, openContractModal]
  );

  // Shared helper for renounce confirmation and execution
  // Now directly updates teamCapSheet instead of using capSheetState
  const confirmAndRenounceRights = useCallback(
    (
      playerOrHold: ArchitectPlayer | CapHold,
      overrideMetadata?: OverrideMetadata | null
    ): void => {
      const playerName =
        (playerOrHold as ArchitectPlayer).displayName ||
        (playerOrHold as ArchitectPlayer).name ||
        (playerOrHold as CapHold).playerName ||
        'this player';

      if (
        window.confirm(
          `Are you sure you want to renounce rights to ${playerName}? This will clear their cap hold.`
        )
      ) {
        const idToRenounce =
          (playerOrHold as ArchitectPlayer).id ||
          (playerOrHold as ArchitectPlayer).player_id ||
          (playerOrHold as CapHold).playerId ||
          (playerOrHold as ArchitectPlayer).name;

        setTeamCapSheet((prev: CapSheet | null) => {
          if (!prev) return prev;

          // Remove from capHolds array
          const updatedCapHolds = (prev.capHolds || []).filter(
            (h) => h.playerId !== idToRenounce && h.playerName !== idToRenounce
          );

          // Update player object if it exists
          const updatedPlayers = (prev.players || []).map((p) => {
            if (
              p.id === idToRenounce ||
              p.player_id === idToRenounce ||
              p.name === idToRenounce
            ) {
              const updated = { ...p, rightsRenounced: true };
              if (updated.contract?.birdRights) {
                updated.contract = {
                  ...updated.contract,
                  birdRights: {
                    ...updated.contract.birdRights,
                    status: 'None',
                  },
                };
              }
              return updated;
            }
            return p;
          });

          // Record override audit log if override was used
          const overrideAuditLog = overrideMetadata?.overrideUsed
            ? recordOverrideAudit(
                prev,
                'renounce',
                overrideMetadata.overrideReasons || [],
                idToRenounce,
                playerName
              )
            : prev?.overrideAuditLog;

          return {
            ...prev,
            players: updatedPlayers,
            capHolds: updatedCapHolds,
            ...(overrideAuditLog ? { overrideAuditLog } : {}),
          };
        });

        // Persist to world if in world mode
        if (!idToRenounce) {
          console.error('Renounce missing playerId');
          toast.error('Cannot save: Player ID missing');
          throw new Error('Renounce missing playerId');
        }

        persistMutation('renounceRights', {
          teamCode,
          playerId: idToRenounce,
        });
      }
    },
    [setTeamCapSheet, teamCode, persistMutation]
  );

  // Handler for clicking action cells (PO/TO/UFA/RFA) in CapSheetFull or Renounce
  const handleCapSheetAction = useCallback(
    (player: ArchitectPlayer, actionType: string, year?: number): void => {
      if (actionType === 'renounce') {
        confirmAndRenounceRights(player);
        return;
      }

      setSelectedPlayer(player);
      setSelectedRulesYear(year || currentYear);

      // Determine action context based on what was clicked
      const contextMap: Record<string, ActionContext> = {
        po: 'option',
        to: 'option',
        ufa: 'freeAgent',
        rfa: 'freeAgent',
      };

      // No pre-selection - user picks
      openContractModal({
        initialAction: null,
        targetYear: year ?? null, // Store which year was clicked
        actionContext: contextMap[actionType] || null,
      });
    },
    [
      currentYear,
      confirmAndRenounceRights,
      setSelectedPlayer,
      setSelectedRulesYear,
      openContractModal,
    ]
  );

  // handleSaveContract - directly updates teamCapSheet
  // NOTE: This handler is for editing existing contracts in the UI. It updates local state only.
  // Actual persistence occurs when a specific action (sign, extend, etc.) is performed via the
  // EditContractModal actions. This keeps the editor as a preview until the user commits an action.
  const handleSaveContract = useCallback(
    (player: ArchitectPlayer, contractData: SigningDetails): void => {
      const playerId = player.id || player.player_id || player.name;
      const startYear = currentYear + 1;

      setTeamCapSheet((prev: CapSheet | null) => {
        if (!prev) return prev;

        // Build new contract salaries
        const salaries: SalaryByYear[] = [];
        const providedSalaries = (contractData.salariesByYear || []).slice(
          0,
          contractData.salariesByYear?.length || 0
        );
        const hasProvidedSalaries = providedSalaries.length > 0;

        if (hasProvidedSalaries) {
          providedSalaries.forEach((s, i) => {
            const endYear = startYear + i;
            salaries.push({
              season: toSeasonCode(endYear),
              salary: Math.round(s.salary || s.capHit || 0),
              capHit: Math.round(s.capHit || s.salary || 0),
              guaranteed: s.guaranteed ?? true,
              option: s.option || null,
            });
          });
        }

        // Update player's contract in players array
        const updatedPlayers = (prev.players || []).map((p) => {
          if (
            p.id === playerId ||
            p.player_id === playerId ||
            p.name === playerId
          ) {
            return {
              ...p,
              contract: {
                ...(p.contract || {}),
                salariesByYear: salaries,
                contractType: contractData.contractType || 'Signed FA',
                isExtension: !!contractData.isExtension,
                isRookieScale: !!contractData.isRookieScale,
                signingTeam: teamCode,
              },
              freeAgentYear: null,
              futureContract: null,
            };
          }
          return p;
        });

        // Remove cap hold if any
        const updatedCapHolds = (prev.capHolds || []).filter(
          (h) => h.playerId !== playerId && h.playerName !== player.name
        );

        return {
          ...prev,
          players: updatedPlayers,
          capHolds: updatedCapHolds,
        };
      });

      closeContractModal();
    },
    [currentYear, teamCode, setTeamCapSheet, closeContractModal]
  );

  // handleExtendContract - directly updates teamCapSheet
  const handleExtendContract = useCallback(
    (player: ArchitectPlayer, extensionContract: SigningDetails): void => {
      const playerId = player.id || player.player_id || player.name;

      setTeamCapSheet((prev: CapSheet | null) => {
        if (!prev) return prev;

        const updatedPlayers = (prev.players || []).map((p) => {
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

            const newYears = (extensionContract.salariesByYear || []).map(
              (y) => ({
                ...y,
                isExtensionSeason: true,
              })
            );

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
              prev,
              'extend',
              extensionContract.overrideReasons || [],
              playerId,
              player.name || player.displayName
            )
          : prev.overrideAuditLog;

        return {
          ...prev,
          players: updatedPlayers,
          ...(overrideAuditLog ? { overrideAuditLog } : {}),
        };
      });

      closeContractModal();

      // Persist to world if in world mode
      if (!playerId) {
        console.error('Extend player missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        throw new Error('Extend player missing playerId');
      }

      persistMutation('extendPlayer', {
        teamCode,
        playerId,
        extension: {
          salariesByYear: extensionContract.salariesByYear || [],
        },
      });
    },
    [setTeamCapSheet, closeContractModal, teamCode, persistMutation]
  );

  // handleWaiveContract - directly updates teamCapSheet
  const handleWaiveContract = useCallback(
    (player: ArchitectPlayer, options: WaiveOptions): void => {
      const { stretch, buyout, buyoutAmount, overrideUsed, overrideReasons } =
        options;
      const confirmMsg = stretch
        ? 'Waive and stretch this player?'
        : 'Waive this player?';
      if (!window.confirm(confirmMsg)) return;

      const playerId = player.id || player.player_id || player.name;

      setTeamCapSheet((prev: CapSheet | null) => {
        if (!prev) return prev;

        // Calculate remaining guaranteed money
        const remainingGuaranteed = (player.contract?.salariesByYear || [])
          .filter((y) => {
            const season = String(y.season);
            const yearEnd = /^\d{4}-\d{2}$/.test(season)
              ? 2000 + parseInt(season.split('-')[1], 10)
              : parseInt(season, 10);
            return yearEnd >= currentYear && y.guaranteed !== false;
          })
          .reduce((sum, y) => sum + (y.salary || 0), 0);

        // For buyouts, dead cap = remaining guaranteed minus buyout amount
        const deadCapAmount = buyout
          ? Math.max(0, remainingGuaranteed - (buyoutAmount || 0))
          : remainingGuaranteed;

        const updatedPlayers = (prev.players || []).map((p) => {
          if (
            p.id === playerId ||
            p.player_id === playerId ||
            p.name === playerId
          ) {
            return {
              ...p,
              waived: true,
              waivedDate: new Date().toISOString(),
              deadCap: {
                amount: deadCapAmount,
                stretched: stretch,
                buyout,
              },
              contract: {
                ...(p.contract || {}),
                salariesByYear: [],
                waived: true,
              },
              futureContract: null,
            };
          }
          return p;
        });

        // Record override audit log if override was used
        const overrideAuditLog = overrideUsed
          ? recordOverrideAudit(
              prev,
              stretch ? 'waiveStretch' : buyout ? 'buyout' : 'waive',
              overrideReasons || [],
              playerId,
              player.name || player.displayName
            )
          : prev.overrideAuditLog;

        return {
          ...prev,
          players: updatedPlayers,
          ...(overrideAuditLog ? { overrideAuditLog } : {}),
        };
      });

      closeContractModal();

      // Persist to world if in world mode
      if (!playerId) {
        console.error('Waive missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        throw new Error('Waive missing playerId');
      }

      persistMutation('waivePlayer', {
        teamCode,
        playerId,
        stretch: !!stretch,
        stretchYears: stretch ? 3 : 0, // Default stretch years
        isGracePeriod: false, // Default, UI doesn't currently expose this
      });
    },
    [
      currentYear,
      setTeamCapSheet,
      closeContractModal,
      teamCode,
      persistMutation,
    ]
  );

  // handleOptionDecision - directly updates teamCapSheet and manages cap holds
  const handleOptionDecision = useCallback(
    (
      player: ArchitectPlayer,
      accepted: boolean,
      overrideMetadata?: OverrideMetadata | null
    ): void => {
      const playerId = player.id || player.player_id || player.name;
      const targetYear = currentYear + 1;

      setTeamCapSheet((prev: CapSheet | null) => {
        if (!prev) return prev;

        let newCapHold: CapHold | null = null;

        const updatedPlayers = (prev.players || []).map((p) => {
          if (
            p.id === playerId ||
            p.player_id === playerId ||
            p.name === playerId
          ) {
            const salaries = p.contract?.salariesByYear || [];

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
            const updatedSalaries = [...salaries];
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
              const filteredSalaries = salaries.filter(
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
        let updatedCapHolds = prev.capHolds || [];
        if (newCapHold) {
          // Remove any existing hold for this player and add the new one
          const holdPlayerId = newCapHold.playerId;
          updatedCapHolds = updatedCapHolds.filter(
            (h) => h.playerId !== holdPlayerId
          );
          updatedCapHolds = [...updatedCapHolds, newCapHold];
        }

        // Record override audit log if override was used
        const overrideAuditLog = overrideMetadata?.overrideUsed
          ? recordOverrideAudit(
              prev,
              accepted ? 'accept' : 'decline',
              overrideMetadata.overrideReasons || [],
              playerId,
              player.name || player.displayName
            )
          : prev.overrideAuditLog;

        return {
          ...prev,
          players: updatedPlayers,
          capHolds: updatedCapHolds,
          ...(overrideAuditLog ? { overrideAuditLog } : {}),
        };
      });

      closeContractModal();

      // Persist to world if in world mode
      if (!playerId) {
        console.error('Option decision missing playerId', { player });
        toast.error('Cannot save: Player ID missing');
        throw new Error('Option decision missing playerId');
      }

      persistMutation('optionDecision', {
        teamCode,
        playerId,
        accepted,
        targetYear,
      });
    },
    [
      currentYear,
      setTeamCapSheet,
      closeContractModal,
      teamCode,
      persistMutation,
    ]
  );

  const handleRenounceRights = useCallback(
    (
      player: ArchitectPlayer,
      overrideMetadata?: OverrideMetadata | null
    ): void => {
      confirmAndRenounceRights(player, overrideMetadata);
      closeContractModal();
    },
    [confirmAndRenounceRights, closeContractModal]
  );

  const handleUpdateRoster = useCallback(
    (updatedCapSheet: CapSheet): void => {
      setTeamCapSheet(updatedCapSheet);
    },
    [setTeamCapSheet]
  );

  const handleResetCapSheet = useCallback((): void => {
    const confirmReset = window.confirm(
      'Are you sure you want to clear all contracts and reset the cap sheet?'
    );
    if (!confirmReset) return;

    const seasonKey = toSeasonKey(currentYear);
    const capProjectionsTyped = capProjections as Record<
      string,
      { fullMLE?: number }
    >;

    const resetSheet: CapSheet = {
      ...teamCapSheet,
      activeContracts: [],
      waivedContracts: [],
      tradeExceptions: [],
      exceptionHistory: [],
      mleHistory: [],
      pickLog: [],
      currentPicks: {},
      amount: capProjectionsTyped[seasonKey]?.fullMLE || 0,
    };

    setTeamCapSheet(resetSheet);
    setOffseasonRun(false);
    setOffseasonSummary(null);
  }, [
    teamCapSheet,
    currentYear,
    setTeamCapSheet,
    setOffseasonRun,
    setOffseasonSummary,
  ]);

  return {
    // Contract/Player actions
    handleSign,
    handleSignAndTrade,
    handleEditContract,
    handleCapSheetAction,
    handleSaveContract,
    handleExtendContract,
    handleWaiveContract,
    handleOptionDecision,
    handleRenounceRights,
    handleUpdateRoster,
    handleResetCapSheet,

    // Phase 16: Offer Sheet Actions
    handleStoreOfferSheet,
    handleMatchOfferSheet,
    handleDeclineOfferSheet,
    handleFinalizeOfferSheet,

    // Trade actions
    applyTradeToCapSheet,

    // Phase 24: Dead Money
    handleSetDeadCap,

    // Phase 27: Exception Management
    handleSetExceptions,
  };
}
