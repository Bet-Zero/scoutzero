/**
 * FILE: src/features/architect/GMDashboard/components/SeasonAdvanceModal.types.ts
 * PURPOSE: Type definitions for SeasonAdvanceModal — extracted from SeasonAdvanceModal.tsx (Wave 4 Step 0.5).
 * OWNERSHIP: Feature: architect/GMDashboard
 */
import type {
  SeasonAdvanceCommittedState as ExecutorSeasonAdvanceCommittedState,
  SeasonAdvanceRequest,
  SeasonAdvanceResult as ExecutorSeasonAdvanceResult,
  SeasonAdvanceSummary as ExecutorSeasonAdvanceSummary,
} from '@/features/architect/utils/seasonManager';
import type { OffseasonOptionDecision } from '@/features/architect/utils/offseason/resolveOffseasonTransition';
import type { TeamTpeLike } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';
import type { DashboardOffseasonSummary } from '@/features/architect/GMDashboard/hooks/useArchitectState';

// Re-export SeasonAdvanceRequest so helpers and main file can import from one place
export type { SeasonAdvanceRequest };

export const WIZARD_STEPS = {
  SUMMARY: 'summary',
  OPTIONS: 'options',
  CONFIRMATION: 'confirmation',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
} as const;

export type WizardStepValue = (typeof WIZARD_STEPS)[keyof typeof WIZARD_STEPS];
export type PreAdvanceWizardStepValue =
  | typeof WIZARD_STEPS.SUMMARY
  | typeof WIZARD_STEPS.OPTIONS
  | typeof WIZARD_STEPS.CONFIRMATION;
export type PreAdvanceWizardStep = {
  value: PreAdvanceWizardStepValue;
  label: string;
};
export type SeasonAdvanceExecutorResult = ExecutorSeasonAdvanceResult;
export type SeasonAdvanceSummary = ExecutorSeasonAdvanceSummary;
export type WorldAdvanceAftermath = {
  nextWorldSeason: string;
  nextViewingYear: number;
  committedTeamCapSheet: SeasonAdvanceModalTeamCapSheet | null;
  offseasonSummary: DashboardOffseasonSummary;
};

export type SeasonAdvanceSuccessResult = {
  success: true;
  toSeason: string;
  updatedTeams: string[];
  summary?: SeasonAdvanceSummary;
  worldAdvanceAftermath: WorldAdvanceAftermath;
};
export type SeasonAdvanceFailureResult = {
  success: false;
  error: string;
};
export type SeasonAdvanceResult =
  | SeasonAdvanceSuccessResult
  | SeasonAdvanceFailureResult;
export type SeasonAdvanceModalTeamCapSheet = TeamCapSheetLike & TeamTpeLike;

export type SalaryByYearLike = {
  season?: string | null;
  option?: string | null;
  salary?: number | null;
  capHit?: number | null;
  guaranteed?: boolean;
};

export type ContractLike = {
  salariesByYear?: SalaryByYearLike[] | null;
};

export type PlayerLike = {
  player_id?: string | null;
  playerId?: string | null;
  id?: string | null;
  name?: string | null;
  displayName?: string | null;
  contract?: ContractLike | null;
};

export type CapHoldLike = {
  playerId?: string | null;
  playerName?: string | null;
  amount?: number | null;
  type?: string | null;
  expiresOn?: string | null;
};

export type TeamCapSheetLike = {
  players?: PlayerLike[] | null;
  capHolds?: CapHoldLike[] | null;
};

export type PlayerOptionPreviewLike = {
  playerId: string;
  playerName?: string | null;
  optionType?: string | null;
  salary: number;
  season: string;
};

export type ExpiringContractPreviewLike = {
  playerId: string;
  playerName?: string | null;
  lastSalary: number;
};

export type ExpiringCapHoldPreviewLike = {
  playerId?: string | null;
  playerName?: string | null;
  amount: number;
  type?: string | null;
};

export type ExpiringTpePreviewLike = {
  amount: number;
  date: string;
  source?: string | null;
};

export type StagedOptionDecision = Omit<OffseasonOptionDecision, 'decision'> & {
  decision?: OffseasonOptionDecision['decision'] | null;
  playerName?: string | null;
};

export type StagedOptionDecisionMap = Record<string, StagedOptionDecision>;
export type OrderedStagedOptionDecision = StagedOptionDecision & {
  playerId: string;
};
export type BuildWorldAdvanceAftermathParams = {
  committedState: ExecutorSeasonAdvanceCommittedState;
  summary?: SeasonAdvanceSummary;
};
export type BuildSeasonAdvanceSuccessResultParams = {
  advanceResult: Extract<SeasonAdvanceExecutorResult, { success: true }>;
};

export type SeasonAdvanceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  teamCapSheet?: SeasonAdvanceModalTeamCapSheet | null;
  authoritativeWorldSeason: string;
  worldId?: string | null;
  teamCode?: string | null;
  onWorldAdvanceComplete?:
    | ((result: SeasonAdvanceResult) => void | Promise<void>)
    | null;
};

export type SeasonAdvanceModalComponent = ((
  props: SeasonAdvanceModalProps
) => JSX.Element | null) & {
  propTypes?: Record<string, unknown>;
};

