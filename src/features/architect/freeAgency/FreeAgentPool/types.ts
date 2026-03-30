/**
 * FILE: src/features/architect/freeAgency/FreeAgentPool/types.ts
 * PURPOSE: Permissive local types for the authoritative Free Agent Pool surface.
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
import type { FreeAgencyActionOwner } from '@/features/architect/GMDashboard/hooks/useArchitectActions';

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

export interface FreeAgentActionResult extends LooseRecord {
  success?: boolean;
  message?: string;
}

export interface FreeAgentPoolProps {
  freeAgents?: FreeAgentListItem[] | null;
  currentYear: number;
  actionOwner: FreeAgencyActionOwner;
  playersMap?: Record<string, FreeAgentLookupPlayer>;
  playersById?: Record<string, FreeAgentLookupPlayer>;
}

export interface FreeAgentRowProps {
  player?: ResolvedFreeAgentPlayer;
  askInfo?: FreeAgentListItem;
  onSelect?: () => void;
  isSelected?: boolean;
  openMenu?: string | null | undefined;
  setOpenMenu:
    | Dispatch<SetStateAction<string | null | undefined>>
    | ((value: string | null | undefined) => void);
  onSign?: (player: FreeAgentListItem) => void;
}

export interface FreeAgentCardProps {
  player: FreeAgentListItem;
  onSign: (player: FreeAgentListItem) => void;
  onRemove: (player: FreeAgentListItem) => void;
}
