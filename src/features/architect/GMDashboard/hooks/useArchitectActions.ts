/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.ts
 * PURPOSE: Centralized action handlers for GMDashboard - manages all user interactions and mutations.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-12: Created - extracted all handlers from GMDashboard.jsx (Phase 3 refactor)
 *  - 2025-12-12: Converted to TypeScript with proper type annotations
 *
 * LINKS:
 *  - Plan: plans/extract_gmdashboard_actions_b9466109.plan.md
 */
import { useCallback } from 'react';
import {
  saveNamedTeamPlan,
  listUserTeamPlans,
} from '@/features/architect/utils/firebaseTeamPlanHelpers';
import { basePlayerRef } from '@/data/firestorePaths';
import { getDoc } from 'firebase/firestore';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import capProjections from '@/features/architect/utils/capProjections';

// ==== Type Definitions ====

/** Salary entry by year in a contract */
interface SalaryByYear {
  season: string;
  salary?: number;
  option?: string;
  optionType?: string;
  capHit?: number;
  guaranteed?: boolean;
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
  [key: string]: unknown;
}

/** Waive options */
interface WaiveOptions {
  stretch?: boolean;
  buyout?: boolean;
  buyoutAmount?: number;
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
  capHolds?: unknown[];
  exceptions?: unknown;
  draftPicks?: unknown[];
  totals?: unknown;
  amount?: number;
  [key: string]: unknown;
}

/** Plan reference from Firestore */
interface PlanRef {
  id: string;
  name?: string;
  [key: string]: unknown;
}

/** Free agent type extending ArchitectPlayer */
interface FreeAgent extends ArchitectPlayer {
  previousSalary: number;
  birdRights: string;
  freeAgentType: 'UFA' | 'RFA' | 'PO' | 'TO';
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
  setPlans: React.Dispatch<React.SetStateAction<PlanRef[]>>;
  setSelectedPlan: React.Dispatch<React.SetStateAction<string>>;
}

/** Modal helpers from useArchitectModals (subset needed by actions) */
interface ArchitectModalsForActions {
  newPlanName: string;
  openContractModal: (context?: EditModalContext) => void;
  closeContractModal: () => void;
  closeSaveModal: () => void;
  setNewPlanName: React.Dispatch<React.SetStateAction<string>>;
}

/** CapSheetState hook return type (subset needed by actions) */
interface CapSheetStateForActions {
  signPlayer: (
    player: ArchitectPlayer,
    contractData: SigningDetails,
    signingType?: string
  ) => void;
  extendContract: (
    player: ArchitectPlayer,
    extensionContract: SigningDetails
  ) => void;
  waivePlayer: (player: ArchitectPlayer, options: WaiveOptions) => void;
  exerciseOption: (player: ArchitectPlayer, accepted: boolean) => void;
  renounceRights: (player: ArchitectPlayer) => void;
}

/** Hook input parameters */
export interface UseArchitectActionsParams {
  teamId: string;
  userId: string | null;
  authLoading?: boolean;
  state: ArchitectStateForActions;
  capSheetState: CapSheetStateForActions;
  playersMap: PlayersMap;
  modals: ArchitectModalsForActions;
}

/** Return type of the useArchitectActions hook */
export interface UseArchitectActionsReturn {
  // Contract/Player actions
  handleSign: (playerObj: ArchitectPlayer, contract: SigningDetails) => void;
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
  handleOptionDecision: (player: ArchitectPlayer, accepted: boolean) => void;
  handleRenounceRights: (player: ArchitectPlayer) => void;
  handleUpdateRoster: (updatedCapSheet: CapSheet) => void;
  handleResetCapSheet: () => void;

  // Trade actions
  applyTradeToCapSheet: (tradeData: TradeDataItem[]) => Promise<void>;

  // Plan actions
  handleSavePlan: () => Promise<void>;
}

// ==== Season helpers ====
const toSeasonKey = (endYear: number): string =>
  `${endYear - 1}-${String(endYear).slice(-2)}`;

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
  capSheetState,
  playersMap,
  modals,
}: UseArchitectActionsParams): UseArchitectActionsReturn {
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
    setPlans,
    setSelectedPlan,
  } = state;

  // Destructure modals for easier access
  const {
    newPlanName,
    openContractModal,
    closeContractModal,
    closeSaveModal,
    setNewPlanName,
  } = modals;

  // === Trade Actions ===

  const applyTradeToCapSheet = useCallback(
    async (tradeData: TradeDataItem[]): Promise<void> => {
      if (!tradeData || !Array.isArray(tradeData)) return;

      const updated: CapSheet = {
        ...teamCapSheet,
        activeContracts: teamCapSheet?.activeContracts || [],
        players: teamCapSheet?.players || [],
      };

      const targetTrade = tradeData.find((t) => t.teamId === teamId);
      if (!targetTrade) return;

      const incoming = targetTrade.incoming || [];
      const outgoing = targetTrade.outgoing || [];

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

      // Remove outgoing players from main roster
      updated.players = (updated.players || []).filter((player) => {
        const traded = outgoing.some((out) => isSamePlayer(player, out));
        if (traded && process.env.NODE_ENV !== 'production') {
          console.log(`🗑️ Removing ${player.name} from roster (traded away)`);
        }
        return !traded;
      });

      // Filter out players you just traded away from active contracts
      updated.activeContracts = (updated.activeContracts || []).filter(
        (contract) => {
          const traded = outgoing.some((out) => isSamePlayer(contract, out));
          if (traded && process.env.NODE_ENV !== 'production') {
            console.log(`🗑️ Removing ${contract.name} (traded away)`);
          }
          return !traded;
        }
      );

      // Add the incoming traded players
      const newContracts: ActiveContract[] = incoming.map((p) => {
        // Use contract directly if it has salariesByYear array, otherwise use player's contract
        const architectContract = ensureContractStructure(p.contract || null, {
          contractType: p.contractType || 'Trade',
          isExtension: !!p.isExtension,
          isRookieScale: !!p.isRookieScale,
          signingTeam: teamId,
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
            // Load from architect_basePlayers collection
            try {
              const playerSnap = await getDoc(
                basePlayerRef(p.id || p.player_id || '')
              );
              if (playerSnap.exists()) {
                const loaded = playerSnap.data() as Record<string, unknown>;
                playerData = {
                  id: (loaded.playerId as string) || p.id || p.player_id,
                  player_id: (loaded.playerId as string) || p.id || p.player_id,
                  name: (loaded.displayName as string) || p.name,
                  displayName: (loaded.displayName as string) || p.name,
                  position: (loaded.bio as LocalBio)?.position || '',
                  age: (loaded.bio as LocalBio)?.age || null,
                  contract: (loaded.contract as LocalContract) || null,
                  bio: (loaded.bio as LocalBio) || {},
                  ...loaded,
                };
              }
            } catch (err) {
              console.warn(
                `Failed to load player ${p.id || p.player_id}:`,
                err
              );
              // Continue with trade data only
            }
          }

          // Use contract from trade data or player data, ensuring it has proper structure
          const architectContract = ensureContractStructure(
            p.contract || playerData?.contract || null,
            {
              contractType: p.contractType || 'Trade',
              isExtension: !!p.isExtension,
              isRookieScale: !!p.isRookieScale,
              signingTeam: teamId,
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

      if (process.env.NODE_ENV !== 'production') {
        console.log(
          '✅ Applied trade — activeContracts now:',
          updated.activeContracts
        );
      }

      setTeamCapSheet(updated);
    },
    [teamCapSheet, teamId, playersMap, setTeamCapSheet]
  );

  // === Contract/Player Actions ===

  const handleSign = useCallback(
    (playerObj: ArchitectPlayer, contract: SigningDetails): void => {
      // Contract should already have salariesByYear array format
      const architectContract = ensureContractStructure(
        contract as LocalContract,
        {
          contractType: contract.contractType || 'Signed FA',
          isExtension: !!contract.isExtension,
          isRookieScale: !!contract.isRookieScale,
          signingTeam: teamId,
        }
      );

      const newContract: ActiveContract = {
        name: playerObj.name,
        player_id: playerObj.id || playerObj.player_id,
        years: architectContract?.salariesByYear?.length || 1,
        options: contract.options || {},
        type: contract.signAndTrade ? 'Sign & Trade' : 'Signed FA',
        signAndTrade: contract.signAndTrade || false,
        guaranteed: contract.guaranteed,
        isMinimum: contract.isMinimum,
        yearsOfService: contract.yearsOfService,
        contract: architectContract || undefined,
      };

      setTeamCapSheet((prev) => {
        const active = prev?.activeContracts || [];
        const players = prev?.players || [];

        const base =
          playersMap[playerObj.name || ''] ||
          playersMap[playerObj.player_id || ''] ||
          playersMap[playerObj.id || ''] ||
          {};

        const position =
          base.position ||
          base.formattedPosition ||
          getPlayerPositionLabel(
            base.bio?.position || playerObj.position || ''
          );

        const newPlayer: ArchitectPlayer = {
          ...(base || {}),
          name: base.name || playerObj.name,
          player_id: playerObj.id || playerObj.player_id || base.player_id,
          displayName:
            base.bio?.displayName ||
            playerObj.bio?.displayName ||
            playerObj.name,
          position,
          contract:
            ensureContractStructure(contract as LocalContract, {
              contractType: contract.contractType || 'Signed FA',
              isExtension: !!contract.isExtension,
              isRookieScale: !!contract.isRookieScale,
              signingTeam: teamId,
            }) || base.contract,
        };

        return {
          ...prev,
          activeContracts: [...active, newContract],
          players: [...players, newPlayer],
        };
      });

      setFreeAgents((prev) =>
        prev.filter(
          (p) =>
            p.name !== playerObj.name &&
            p.id !== playerObj.id &&
            p.player_id !== playerObj.player_id
        )
      );
    },
    [teamId, playersMap, setTeamCapSheet, setFreeAgents]
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
  const confirmAndRenounceRights = useCallback(
    (player: ArchitectPlayer): void => {
      if (
        window.confirm(
          `Are you sure you want to renounce rights to ${player.displayName || player.name}? This will clear their cap hold.`
        )
      ) {
        capSheetState.renounceRights(player);
      }
    },
    [capSheetState]
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

  const handleSaveContract = useCallback(
    (player: ArchitectPlayer, contractData: SigningDetails): void => {
      capSheetState.signPlayer(player, contractData, 'signNew');
      closeContractModal();
    },
    [capSheetState, closeContractModal]
  );

  const handleExtendContract = useCallback(
    (player: ArchitectPlayer, extensionContract: SigningDetails): void => {
      capSheetState.extendContract(player, extensionContract);
      closeContractModal();
    },
    [capSheetState, closeContractModal]
  );

  const handleWaiveContract = useCallback(
    (player: ArchitectPlayer, { stretch, buyout }: WaiveOptions): void => {
      const confirmMsg = stretch
        ? 'Waive and stretch this player?'
        : 'Waive this player?';
      if (!window.confirm(confirmMsg)) return;

      capSheetState.waivePlayer(player, { stretch, buyout });
      closeContractModal();
    },
    [capSheetState, closeContractModal]
  );

  const handleOptionDecision = useCallback(
    (player: ArchitectPlayer, accepted: boolean): void => {
      capSheetState.exerciseOption(player, accepted);
      closeContractModal();
    },
    [capSheetState, closeContractModal]
  );

  const handleRenounceRights = useCallback(
    (player: ArchitectPlayer): void => {
      confirmAndRenounceRights(player);
    },
    [confirmAndRenounceRights]
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

  // === Save Plan Action ===

  const handleSavePlan = useCallback(async (): Promise<void> => {
    // Guard: saving requires userId
    if (!userId) {
      console.warn('Cannot save plan: userId is missing');
      return;
    }

    if (!newPlanName.trim()) return;

    startSave();
    try {
      await saveNamedTeamPlan(userId, teamId, newPlanName.trim(), teamCapSheet);
      const updated = (await listUserTeamPlans(userId, teamId)) as PlanRef[];
      setPlans(updated);
      setSelectedPlan(newPlanName.trim());
      setNewPlanName('');
      closeSaveModal();
      finishSave();
    } catch (err) {
      console.error('Failed to save plan', err);
      finishSave('Failed to save plan');
    }
  }, [
    userId,
    teamId,
    newPlanName,
    teamCapSheet,
    startSave,
    finishSave,
    setPlans,
    setSelectedPlan,
    setNewPlanName,
    closeSaveModal,
  ]);

  return {
    // Contract/Player actions
    handleSign,
    handleEditContract,
    handleCapSheetAction,
    handleSaveContract,
    handleExtendContract,
    handleWaiveContract,
    handleOptionDecision,
    handleRenounceRights,
    handleUpdateRoster,
    handleResetCapSheet,

    // Trade actions
    applyTradeToCapSheet,

    // Plan actions
    handleSavePlan,
  };
}
