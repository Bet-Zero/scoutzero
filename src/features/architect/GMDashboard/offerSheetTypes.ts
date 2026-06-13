/**
 * FILE: src/features/architect/GMDashboard/offerSheetTypes.ts
 * PURPOSE: Permissive local types for the published Free Agency offer-sheet consumer surface.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2026-03-14: Added during TM_VALIDATOR_TS_FREE_AGENCY_OFFER_SHEET_SURFACE_E91 execution.
 *
 * LINKS:
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_FREE_AGENCY_OFFER_SHEET_SURFACE_E91_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 */
import type { FreeAgencyActionOwner } from './hooks/useArchitectActions';
import type {
  FreeAgentSurfaceEntry,
  FreeAgentPoolProps,
} from '@/features/architect/freeAgency/FreeAgentPool/types';

type LooseRecord = Record<string, unknown>;

export type OfferSheetStatus = string;
export type OfferSheetSurfaceRole = 'incoming' | 'outgoing';
export type OfferSheetLifecycleAction =
  | 'match'
  | 'decline'
  | 'finalizeMatched'
  | 'finalizeDeclined';

export interface OfferSheetLike extends LooseRecord {
  id?: string | number | null;
  playerName?: string;
  offeringTeamCode?: string;
  homeTeamCode?: string;
  dedupKey?: string;
  playerId?: string;
  seasonKey?: string;
  contractYears?: number | string | null;
  totalValue?: number | string | null;
  status: OfferSheetStatus;
  createdAt?: string | number | Date | null;
}

export interface OfferSheetLifecycleActionEvent {
  action: OfferSheetLifecycleAction;
  offerSheet: OfferSheetLike;
  surfaceRole: OfferSheetSurfaceRole;
}

export interface OfferSheetListProps {
  offerSheets?: OfferSheetLike[] | null;
  title?: string;
  surfaceRole: OfferSheetSurfaceRole;
  onLifecycleAction?: (event: OfferSheetLifecycleActionEvent) => unknown;
  actionsDisabled?: boolean;
  actionsDisabledReason?: string;
}

export interface FreeAgencySectionProps {
  freeAgents?: unknown[] | null;
  currentYear: number;
  actionOwner: FreeAgencyActionOwner;
  playersMap?: Record<string, unknown>;
  outgoingOfferSheets?: OfferSheetLike[] | null;
  incomingOfferSheets?: OfferSheetLike[] | null;
  onAfterSigningComplete?: (() => void) | null;
  selectedPlayerKeys?: string[];
  onSelectedPlayerKeysChange?: (selectionKeys: string[]) => void;
  requestedOpenSelectionKey?: string | null;
  onRequestedOpenSelectionHandled?: () => void;
  onSelectedEntriesChange?: (entries: FreeAgentSurfaceEntry[]) => void;
  /** Unified player-action sink (Slice 2e): FA Pin-as-Target / Compare / Guide. */
  onPlayerAction?: FreeAgentPoolProps['onPlayerAction'];
  /** Pinned ids so FA rows can present Pin vs Remove-target. */
  pinnedPlayerIds?: string[];
  poolManagement?: FreeAgentPoolProps['poolManagement'];
}
