/**
 * FILE: src/features/architect/offseason/OffseasonTab/types.ts
 * PURPOSE: Internal permissive types for the authoritative Offseason preview TS surface.
 * OWNERSHIP: Feature: architect/offseason
 *
 * HISTORY:
 *  - 2026-03-14: Added during TM_VALIDATOR_TS_OFFSEASON_PREVIEW_SURFACE_E93 execution.
 *
 * LINKS:
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_OFFSEASON_PREVIEW_SURFACE_E93_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 */

import type { OffseasonTransitionResult } from '@/features/architect/utils/offseason';

export type OffseasonSummary =
  OffseasonTransitionResult['appliedChangesSummary'];

export type OffseasonContractYearSlice = {
  season?: string | number | null;
  salary?: number | null;
  capHit?: number | null;
  option?: string | null;
  [key: string]: unknown;
};

export type OffseasonContract = {
  salariesByYear?: OffseasonContractYearSlice[] | null;
  [key: string]: unknown;
};

export type OffseasonPlayer = {
  player_id?: string | null;
  id?: string | null;
  playerId?: string | null;
  name?: string | null;
  displayName?: string | null;
  contract?: OffseasonContract | null;
  [key: string]: unknown;
};

export type OffseasonTeamCapSheet = {
  players?: OffseasonPlayer[] | null;
  teamCode?: string | null;
  [key: string]: unknown;
};

export type OffseasonOptionDecision = {
  decision: 'exercise' | 'decline';
  optionType: string | null;
  season: string;
};

export type OffseasonOptionDecisionMap = Record<
  string,
  OffseasonOptionDecision
>;

export type OffseasonOptionRow = {
  decisionKey: string;
  playerId: string | null;
  name: string;
  salary: number;
  type: string;
  season: string;
};

export type OffseasonTabProps = {
  teamCapSheet: OffseasonTeamCapSheet;
  setTeamCapSheet: (nextTeamCapSheet: OffseasonTeamCapSheet) => void;
  currentYear: number;
  setCurrentYear: (nextYear: number) => void;
  capProjections?: Record<string, unknown> | null;
  setLastCapSheet: (previousCapSheet: OffseasonTeamCapSheet) => void;
  offseasonRun?: boolean;
  setOffseasonRun: (nextValue: boolean) => void;
  setOffseasonSummary: (summary: OffseasonSummary) => void;
  setShowOffseasonModal: (nextValue: boolean) => void;
  playersMap?: Record<string, unknown>;
};

export type OptionManagerProps = {
  teamCapSheet: OffseasonTeamCapSheet;
  currentYear: number;
  onDecisionsReady: (decisions: OffseasonOptionDecisionMap) => void;
  playersMap?: Record<string, unknown>;
};
