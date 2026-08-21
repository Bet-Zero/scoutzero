/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectState.types.ts
 * PURPOSE: Type definitions and mergeWorldPlayerOverride for useArchitectState.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Wave 11 Step 2: Extracted from useArchitectState.ts (L62–L477).
 */

import { getLeague } from '@/features/architect/utils/teamLoader';
import { useArchitectPlayerData } from '@/features/architect/hooks/useArchitectPlayerData';
import type { LoadedWorldTeamCapSheet } from '@/features/architect/utils/worldTeamData';
import type {
  BasePlayerContract,
  CapHoldItem,
  DeadCapItem,
  DraftPick,
  Exceptions,
  PlayerRulesProfileInput,
  PlayerRulesProfileTeamCapSheet,
} from '@/features/architect/types';
import type { TeamHistoryCapSheetLike } from '@/features/architect/history/TeamHistoryTab/types';
import type { ArchitectMutationTeamTotals } from '@/features/architect/utils/mutationPipeline';
import type { ContractEventLedgerPayload } from '@/schemas/contractEventLedger';
import type { TeamSalaryBookInputs } from '@/schemas/salaryBooks';
import type { OfferSheetLike } from '../offerSheetTypes';
import { capProjections } from '@/features/architect/utils/capProjections';
import type { OffseasonAppliedChangesSummary } from '@/features/architect/utils/offseason/resolveOffseasonTransition';

// ==== Type Definitions ====

export type CapProjectionRow = (typeof capProjections)[string];
export type CapProjectionMap = Record<string, CapProjectionRow | undefined>;
export type LoadedWorldTeamData = LoadedWorldTeamCapSheet;
export type LeagueTeamSnapshot = Awaited<ReturnType<typeof getLeague>>[number];
export type RulesProfileContract = NonNullable<PlayerRulesProfileInput['contract']>;
export type RulesProfileSalaryRow = NonNullable<
  NonNullable<RulesProfileContract['salariesByYear']>[number]
>;
export type ArchitectTeamHistoryStateSlice = Pick<
  TeamHistoryCapSheetLike,
  | 'waivedContracts'
  | 'exceptionHistory'
  | 'mleHistory'
  | 'pickLog'
  | 'currentPicks'
  | 'historyTimeline'
>;
export type DashboardBaseTeamCapSheet = Omit<
  LoadedWorldTeamData,
  | 'players'
  | 'roster'
  | 'deadCap'
  | 'capHolds'
  | 'draftPicks'
  | 'exceptions'
  | 'totals'
> &
  Omit<
    PlayerRulesProfileTeamCapSheet,
    | 'players'
    | 'capHolds'
    | 'offerSheets'
    | 'incomingOfferSheets'
    | 'deadCap'
    | 'exceptions'
  > &
  ArchitectTeamHistoryStateSlice;

/** Salary entry by year in a contract */
export type SalaryByYear = RulesProfileSalaryRow & {
  season?: string | number | null;
  salary?: number | null;
  option?: string | null;
  optionType?: string | null;
  capHit?: number | null;
  guaranteed?: boolean | null;
};

export type ArchitectContractBase = Partial<
  Pick<
    BasePlayerContract,
    | 'contractType'
    | 'isExtension'
    | 'isRookieScale'
    | 'signedUsing'
    | 'signingTeam'
    | 'signingDate'
    | 'yearsRemaining'
    | 'totalValue'
    | 'birdRights'
    | 'freeAgency'
    | 'salariesByYear'
  >
>;

/** Player contract structure */
export type ArchitectContract = Omit<
  ArchitectContractBase,
  'salariesByYear' | 'birdRights' | 'freeAgency'
> & {
  salariesByYear?: SalaryByYear[] | null;
  birdRights?: BasePlayerContract['birdRights'] | null;
  freeAgency?: RulesProfileContract['freeAgency'] | null;
};

/** Player data from useArchitectPlayerData */
export type ArchitectDashboardPlayer = PlayerRulesProfileInput & {
  id?: string | number | null;
  player_id?: string | number | null;
  name?: string | null;
  displayName?: string | null;
  age?: number | null;
  yearsOfService?: number | null;
  yearsPro?: number | null;
  teamCode?: string | null;
  teamName?: string | null;
  contract?: ArchitectContract | null;
  futureContract?: ArchitectContract | null;
};

export type ArchitectPlayer = ArchitectDashboardPlayer;

export type WorldRosterPlayerLike = ArchitectDashboardPlayer &
  NonNullable<LeagueTeamSnapshot['players']>[number] & {
  bio?:
    | (NonNullable<ArchitectDashboardPlayer['bio']> & {
        playerId?: string | number | null;
      })
    | null;
};

export type WorldLeagueTeamLike = Pick<LeagueTeamSnapshot, 'roster'> & {
  players?: WorldRosterPlayerLike[];
};

export type WorldMetadataLike = {
  worldName?: string | null;
  asOfDate?: string | null;
  currentSeason?: string | null;
  rightsLedgerVersion?: number | null;
};

export const mergeWorldPlayerOverride = (
  basePlayer: ArchitectPlayer | null,
  overridePlayer: ArchitectPlayer
): ArchitectPlayer => ({
  ...(basePlayer || {}),
  ...overridePlayer,
  contract: overridePlayer.contract
    ? { ...(basePlayer?.contract || {}), ...overridePlayer.contract }
    : basePlayer?.contract,
  bio: overridePlayer.bio
    ? { ...(basePlayer?.bio || {}), ...overridePlayer.bio }
    : basePlayer?.bio,
});

/** Free agent with additional derived fields */
export interface FreeAgent extends ArchitectPlayer {
  previousSalary: number;
  birdRights: string;
  freeAgentType: 'UFA' | 'RFA' | 'PO' | 'TO';
}

export type OffseasonSummaryTradeException = Omit<
  OffseasonAppliedChangesSummary['expiredTPEs'][number],
  'source'
> & {
  source?: string | null;
  teamCode?: string | null;
};

export type OffseasonSummaryWaivedDeadCap = {
  name?: string | null;
  amount?: number;
  year?: string | number | null;
};

export type ExercisedOptionSummary =
  OffseasonAppliedChangesSummary['exercisedOptions'][number];

export type StepienUpdateSummary = {
  pickId?: string | null;
  year?: number | null;
  status?: string | null;
  reason?: string | null;
};

export type DashboardOffseasonSummary = {
  declinedOptions?: string[];
  expiredContracts?: string[];
  expiredTPEs?: OffseasonSummaryTradeException[];
  waivedDeadCap?: OffseasonSummaryWaivedDeadCap[];
  resetMLE?: boolean;
  exercisedOptions?: ExercisedOptionSummary[];
  stepienUpdates?: StepienUpdateSummary[];
};

export type CapHoldLike = Omit<CapHoldItem, 'playerId'> & {
  playerId?: string | number | null;
  active?: boolean | null;
  reason?: string | null;
};

export type DeadCapLike = Partial<DeadCapItem> & {
  id?: string | null;
  playerId?: string | number | null;
  label?: string | null;
  amountByYear?: DeadCapItem['amountByYear'] | null;
  stretched?: boolean | null;
};

export type ArchitectExceptionEntryLike = {
  type?: string | null;
  enabled?: boolean;
  available?: boolean;
  totalAmount?: number | null;
  usedAmount?: number | null;
  remainingAmount?: number | null;
  createdFrom?: string | null;
  createdOn?: string | null;
  expiresOn?: string | null;
  notes?: string | null;
  seasonKey?: string | null;
};

export type ArchitectExceptionsLike = {
  mle?: ArchitectExceptionEntryLike | null;
  room?: ArchitectExceptionEntryLike | null;
  bae?: ArchitectExceptionEntryLike | null;
  dpe?: ArchitectExceptionEntryLike | null;
  tpe?: NonNullable<Exceptions>['tpe'];
  tpmle?: ArchitectExceptionEntryLike | null;
};

/** Cap sheet structure */
export type ArchitectDashboardCapSheet = DashboardBaseTeamCapSheet & {
  id?: string | null;
  teamCode?: string | null;
  teamName?: string;
  season?: string | null;
  abbreviation?: string | null;
  players?: ArchitectDashboardPlayer[];
  roster?: Array<string | number> | null;
  deadCap?: DeadCapLike[] | null;
  capHolds?: CapHoldLike[] | null;
  exceptions?: ArchitectExceptionsLike | null;
  draftPicks?: DraftPick[] | null;
  totals?: ArchitectMutationTeamTotals | null;
  offerSheets?: OfferSheetLike[] | null;
  incomingOfferSheets?: OfferSheetLike[] | null;
  /** BZE-275: append-only option/ETO overlays rooted in pinned baselines. */
  contractEventLedgers?: ContractEventLedgerPayload[] | null;
  salaryBookInputs?: TeamSalaryBookInputs | null;
  activeContracts?: LoadedWorldTeamData['activeContracts'] | null;
  hardCapLevel?: LoadedWorldTeamData['hardCapLevel'] | null;
  hardCapReason?: LoadedWorldTeamData['hardCapReason'] | null;
  hardCapTriggeredBy?: LoadedWorldTeamData['hardCapTriggeredBy'] | null;
  hardCapped?: LoadedWorldTeamData['hardCapped'] | null;
  amount?: number;
};

export type CapSheet = ArchitectDashboardCapSheet;

export type CoordinatedWorldRosterBundle = {
  rosterIndex: Set<string> | null;
  playerOverrides: Record<string, ArchitectPlayer>;
};

export type CoordinatedWorldLoadBundle =
  | {
      kind: 'sandbox';
      teamSnapshot: CapSheet | null;
    }
  | {
      kind: 'world';
      refreshRosterBundle: boolean;
      teamSnapshot: CapSheet | null;
      metadata: WorldMetadataLike | null;
      roster: CoordinatedWorldRosterBundle | null;
    };

/** Hook input parameters */
export interface UseArchitectStateParams {
  teamId: string;
  userId: string | null;
  authLoading: boolean;
}

/** Active tab in the dashboard */
export type ActiveTab =
  | 'roster'
  | 'cap'
  | 'capfull'
  | 'trade'
  | 'fa'
  | 'offseason'
  | 'history'
  | 'compare'
  | 'guide';

/** Map of players by various keys for fast lookup */
export type PlayersMap = Record<string, ArchitectPlayer>;

export interface ArchitectActiveWorldOwner {
  worldId: string | null;
  identityToken: number;
  setActiveWorld: (worldId: string | null) => void;
}

export interface ArchitectWorldTimeOwner {
  worldId: string | null;
  asOfDate: string | null;
  isUpdatingAsOfDate: boolean;
  updateAsOfDate: (nextAsOfDate: string) => Promise<string>;
  advanceByOneDay: () => Promise<string>;
}

export type ReloadActiveWorldTeamDataSource = 'changedTeams' | 'reload';

/**
 * Lost-freshness contract for state-owned world reloads.
 * - `active-world-changed`: the request completed after the active world identity changed.
 * - `superseded-by-newer-request`: a newer state-owned world load took ownership before completion.
 */
export type ReloadActiveWorldTeamDataStaleDropReason =
  | 'active-world-changed'
  | 'superseded-by-newer-request';

export interface ReloadActiveWorldMetadataPatch {
  asOfDate?: string | null;
  currentSeason?: string | null;
}

export interface ReloadActiveWorldTeam {
  committedTeam: CapSheet;
  committedTeamSource: ReloadActiveWorldTeamDataSource;
}

/**
 * State-owned committed-world resync request.
 * The action layer decides direct `changedTeams` reuse vs reload fallback and
 * forwards the best committed team snapshot it has. This state seam owns
 * metadata patch staging, coordinated read-stack re-entry, and stale-drop.
 */
export interface ReloadActiveWorldTeamDataOptions {
  committedTeamSnapshot?: CapSheet | null;
  committedTeamSource?: ReloadActiveWorldTeamDataSource;
  committedWorldMetadata?: ReloadActiveWorldMetadataPatch | null;
  refreshRosterBundle?: boolean;
}

export interface ReloadActiveWorldTeamDataAppliedResult {
  outcome: 'applied';
  committedWorldTeam: ReloadActiveWorldTeam;
}

export interface ReloadActiveWorldTeamDataStaleDropResult {
  outcome: 'stale-drop';
  reason: ReloadActiveWorldTeamDataStaleDropReason;
}

export type ReloadActiveWorldTeamDataResult =
  | ReloadActiveWorldTeamDataAppliedResult
  | ReloadActiveWorldTeamDataStaleDropResult;

export type ActiveWorldLoadRequest = {
  requestWorldId: string | null;
  requestId: number;
};

export type ActiveWorldDateMutationRequest = {
  requestWorldId: string;
  requestId: number;
};

export type ActiveWorldLoadFreshness =
  | { status: 'fresh' }
  | {
      status: 'stale';
      reason: ReloadActiveWorldTeamDataStaleDropReason;
    };

export type ArchitectWorldModeBoundary =
  | {
      kind: 'sandbox';
      worldId: null;
      onReloadWorldData: null;
    }
  | {
      kind: 'world';
      worldId: string;
      onReloadWorldData: (
        options?: ReloadActiveWorldTeamDataOptions
      ) => Promise<ReloadActiveWorldTeamDataResult | null>;
    };

/** Return type of the hook */
export interface UseArchitectStateReturn {
  // Values (all state + derived)
  baselineCapSheet: CapSheet | null;
  teamCapSheet: CapSheet | null;
  currentYear: number;
  selectedRulesYear: number;
  activeTab: ActiveTab;
  selectedPlayer: ArchitectPlayer | null;
  freeAgents: FreeAgent[];
  isLoading: boolean;
  isSaving: boolean;
  error: string;
  lastSavedAt: string | null;
  lastSaveError: string | null;
  lastCapSheet: CapSheet | null;
  offseasonRun: boolean;
  offseasonSummary: DashboardOffseasonSummary | null;
  playersMap: PlayersMap;
  capTableYears: number[];
  players: ArchitectPlayer[];
  worldId: string | null;
  activeWorldLabel: string | null;
  worldAsOfDate: string | null;
  worldCurrentSeason: string | null;
  rightsLedgerWorldVersion: number | null;
  worldMetadataLoading: boolean;
  activeWorldOwner: ArchitectActiveWorldOwner;
  worldTimeOwner: ArchitectWorldTimeOwner;
  worldModeBoundary: ArchitectWorldModeBoundary;

  // Setters (all needed by GMDashboard)
  setBaselineCapSheet: React.Dispatch<React.SetStateAction<CapSheet | null>>;
  setTeamCapSheet: React.Dispatch<React.SetStateAction<CapSheet | null>>;
  setCurrentYear: React.Dispatch<React.SetStateAction<number>>;
  setSelectedRulesYear: React.Dispatch<React.SetStateAction<number>>;
  setActiveTab: React.Dispatch<React.SetStateAction<ActiveTab>>;
  setSelectedPlayer: React.Dispatch<
    React.SetStateAction<ArchitectPlayer | null>
  >;
  setFreeAgents: React.Dispatch<React.SetStateAction<FreeAgent[]>>;
  setLastCapSheet: React.Dispatch<React.SetStateAction<CapSheet | null>>;
  setOffseasonRun: React.Dispatch<React.SetStateAction<boolean>>;
  setOffseasonSummary: React.Dispatch<
    React.SetStateAction<DashboardOffseasonSummary | null>
  >;

  // Higher-level state actions (use these instead of raw setters)
  startLoad: () => void;
  finishLoad: (errorMsg?: string) => void;
  startSave: () => void;
  finishSave: (errorMsg?: string) => void;
  setErrorSafe: (msg: string) => void;
  clearError: () => void;
  refreshWorldRosterIndex: () => Promise<Set<string>>;
  reloadActiveWorldTeamData: (
    options?: ReloadActiveWorldTeamDataOptions
  ) => Promise<ReloadActiveWorldTeamDataResult | null>;
}
