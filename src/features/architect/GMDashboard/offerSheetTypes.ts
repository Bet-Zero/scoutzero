/**
 * FILE: src/features/architect/GMDashboard/offerSheetTypes.ts
 * PURPOSE: Permissive local types for the authoritative Free Agency offer-sheet surface.
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

type LooseRecord = Record<string, unknown>;

export type OfferSheetStatus = string;

export interface OfferSheetLike extends LooseRecord {
  id?: string | number | null;
  playerName?: string;
  offeringTeamCode?: string;
  homeTeamCode?: string;
  contractYears?: number | string | null;
  totalValue?: number | string | null;
  status: OfferSheetStatus;
  createdAt?: string | number | Date | null;
}

export interface OfferSheetListProps {
  offerSheets?: OfferSheetLike[] | null;
  title?: string;
  isIncoming?: boolean;
  onMatch?: (
    offeringTeamCode: OfferSheetLike['offeringTeamCode'],
    id: OfferSheetLike['id']
  ) => unknown;
  onDecline?: (
    offeringTeamCode: OfferSheetLike['offeringTeamCode'],
    id: OfferSheetLike['id']
  ) => unknown;
  onFinalize?: (offerSheet: OfferSheetLike) => unknown;
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
  worldId?: string | null;
}
