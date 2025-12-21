/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectActions.ts
 * PURPOSE: Centralized action handlers for GMDashboard - manages all user interactions and mutations.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-12: Created - extracted all handlers from GMDashboard.jsx (Phase 3 refactor)
 *  - 2025-12-12: Converted to TypeScript with proper type annotations
 *  - 2025-12-14: Option B refactor - removed capSheetState dependency, all mutations now update teamCapSheet directly
 *
 * LINKS:
 *  - Plan: plans/extract_gmdashboard_actions_b9466109.plan.md
 */
import { useCallback } from 'react';
import {
  saveNamedTeamPlan,
  listUserTeamPlans,
} from '@/features/architect/utils/firebaseTeamPlanHelpers';
import { loadArchitectBasePlayer } from '@/features/architect/utils/loadArchitectBasePlayer';
import { getPlayerPositionLabel } from '@/shared/utils/roles';
import { calculateCapHold } from '@/features/architect/utils/contractUtils';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
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
  optionUsed?: string;
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

/** Hook input parameters */
export interface UseArchitectActionsParams {
  teamId: string;
  userId: string | null;
  authLoading?: boolean;
  state: ArchitectStateForActions;
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
  handleOptionDecision: (
    player: ArchitectPlayer,
    accepted: boolean,
    overrideMetadata?: OverrideMetadata | null
  ) => void;
  handleRenounceRights: (player: ArchitectPlayer, overrideMetadata?: OverrideMetadata | null) => void;
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
              const loaded = await loadArchitectBasePlayer(
                p.id || p.player_id || '',
                p.name
              );
              if (loaded) {
                playerData = loaded;
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

        // Record override audit log if override was used
        const overrideAuditLog = contract.overrideUsed
          ? recordOverrideAudit(
              prev,
              contract.signAndTrade ? 'signAndTrade' : 'signNew',
              contract.overrideReasons || [],
              playerObj.id || playerObj.player_id,
              playerObj.name || playerObj.displayName
            )
          : prev?.overrideAuditLog;

        return {
          ...prev,
          activeContracts: [...active, newContract],
          players: [...players, newPlayer],
          ...(overrideAuditLog ? { overrideAuditLog } : {}),
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
  // Now directly updates teamCapSheet instead of using capSheetState
  const confirmAndRenounceRights = useCallback(
    (playerOrHold: ArchitectPlayer | CapHold, overrideMetadata?: OverrideMetadata | null): void => {
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
                  birdRights: { ...updated.contract.birdRights, status: 'None' },
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
      }
    },
    [setTeamCapSheet]
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
                signingTeam: teamId,
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
    [currentYear, teamId, setTeamCapSheet, closeContractModal]
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
    },
    [setTeamCapSheet, closeContractModal]
  );

  // handleWaiveContract - directly updates teamCapSheet
  const handleWaiveContract = useCallback(
    (player: ArchitectPlayer, options: WaiveOptions): void => {
      const { stretch, buyout, buyoutAmount, overrideUsed, overrideReasons } = options;
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
    },
    [currentYear, setTeamCapSheet, closeContractModal]
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

            // Mark option as used
            const updatedSalaries = [...salaries];
            updatedSalaries[optionIndex] = {
              ...updatedSalaries[optionIndex],
              optionUsed: accepted ? 'accepted' : 'declined',
            };

            if (!accepted) {
              // Declining: remove this year and all future years
              const filteredSalaries = salaries.filter(
                (_, idx) => idx < optionIndex
              );

              // Calculate cap hold for declined option using filtered salaries
              const capHoldResult = calculateCapHold({
                ...p,
                contract: {
                  ...(p.contract || {}),
                  salariesByYear: filteredSalaries,
                },
              });
              if (capHoldResult && capHoldResult.amount) {
                newCapHold = {
                  playerId: p.id || p.player_id || p.name || '',
                  playerName: p.displayName || p.name || '',
                  amount: capHoldResult.amount,
                  type: 'FA Cap Hold',
                  season: toSeasonCode(targetYear),
                  isSigned: false,
                  reason: 'Declined Option',
                  active: true,
                };
              }

              return {
                ...p,
                contract: {
                  ...(p.contract || {}),
                  salariesByYear: filteredSalaries,
                  freeAgency: {
                    year: targetYear - 1,
                    type: 'UFA' as const,
                  },
                },
                freeAgentYear: targetYear,
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
    },
    [currentYear, setTeamCapSheet, closeContractModal]
  );

  const handleRenounceRights = useCallback(
    (player: ArchitectPlayer, overrideMetadata?: OverrideMetadata | null): void => {
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
