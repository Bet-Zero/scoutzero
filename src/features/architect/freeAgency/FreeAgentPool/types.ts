/**
 * FILE: src/features/architect/freeAgency/FreeAgentPool/types.ts
 * PURPOSE: Permissive local types for the published Free Agent Pool consumer surface.
 * OWNERSHIP: Feature: architect/freeAgency
 *
 * HISTORY:
 *  - 2026-03-14: Added during TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86 execution.
 *
 * LINKS:
 *  - Return Package: return_packages/trade_machine/TM_VALIDATOR_TS_FREE_AGENT_POOL_SURFACE_E86_RETURN_PACKAGE.md
 *  - Master Doc: docs/architect/TRADE_MACHINE_MASTER.md
 */
import type { Dispatch, SetStateAction } from 'react';
import type { FreeAgentPoolActionOwner } from '@/features/architect/GMDashboard/hooks/useArchitectActions';

type LooseRecord = Record<string, unknown>;

export interface FreeAgentPlayerBio extends LooseRecord {
  playerId?: string | null;
  displayName?: string;
  age?: number | string | null;
  position?: string | null;
  height?: number | string | null;
  weight?: number | string | null;
  display?: {
    freeAgentType?: string | null;
    teamId?: string | null;
    team?: string | null;
    [key: string]: unknown;
  };
}

export interface FreeAgentListItem extends LooseRecord {
  id?: string | null;
  player_id?: string | null;
  name?: string;
  displayName?: string;
  formattedPosition?: string | null;
  teamCode?: string | null;
  headshotUrl?: string | null;
  height?: number | string | null;
  weight?: number | string | null;
  age?: number | string | null;
  previousSalary?: number | string | null;
  askingSalary?: number | string | null;
  birdRights?: string | null;
  freeAgentType?: string | null;
  fa_type?: string | null;
  yearsOfService?: number | null;
  yearsPro?: number | null;
  bio?: FreeAgentPlayerBio;
}

export interface FreeAgentLookupPlayer extends FreeAgentListItem {
  bio?: FreeAgentPlayerBio;
}

export interface ResolvedFreeAgentPlayer extends FreeAgentLookupPlayer {}

export interface FreeAgentSurfaceEntry {
  freeAgent: FreeAgentListItem;
  surfacePlayer: ResolvedFreeAgentPlayer;
  playerId: string | null;
  selectionKey: string;
}

export type FreeAgentModalLaunchTarget = FreeAgentSurfaceEntry;

export interface FreeAgentActionResult extends LooseRecord {
  success?: boolean;
  message?: string;
}

export interface FreeAgentPoolProps {
  freeAgents?: FreeAgentListItem[] | null;
  currentYear: number;
  actionOwner: FreeAgentPoolActionOwner;
  playersMap?: Record<string, FreeAgentLookupPlayer>;
  selectedPlayerKeys?: string[];
  onSelectedPlayerKeysChange?: (selectionKeys: string[]) => void;
  requestedOpenSelectionKey?: string | null;
  onRequestedOpenSelectionHandled?: () => void;
  onSelectedEntriesChange?: (entries: FreeAgentSurfaceEntry[]) => void;
}

export interface FreeAgentRowProps {
  entry: FreeAgentSurfaceEntry;
  onSelect?: (entry: FreeAgentSurfaceEntry) => void;
  isSelected?: boolean;
  openMenuSelectionKey?: string | null | undefined;
  setOpenMenuSelectionKey:
    | Dispatch<SetStateAction<string | null | undefined>>
    | ((value: string | null | undefined) => void);
  onOpenContractModal?: (entry: FreeAgentSurfaceEntry) => void;
}

export interface FreeAgentCardProps {
  entry: FreeAgentSurfaceEntry;
  onOpenContractModal: (entry: FreeAgentSurfaceEntry) => void;
  onRemove: (selectionKey: string) => void;
}
