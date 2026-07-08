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
import type { ActionExposureClassification } from '@/features/architect/GMDashboard/hooks/useArchitectActions.types';
import type {
  PlayerAction,
  PlayerActionContext,
} from '@/features/architect/cockpit/playerActionContext';

type LooseRecord = Record<string, unknown>;

export interface FreeAgentPlayerBio extends LooseRecord {
  playerId?: string | null;
  displayName?: string | null;
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
  name?: string | null;
  displayName?: string | null;
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
  bio?: FreeAgentPlayerBio | null;
}

export interface FreeAgentLookupPlayer extends FreeAgentListItem {
  bio?: FreeAgentPlayerBio | null;
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

export interface FreeAgentPoolManagementControls {
  scopeLabel: string;
  persistenceLabel: string;
  disabledReason?: string | null;
  savedAtLabel?: string | null;
  onSave?: (selectionKeys: string[]) => void | Promise<void>;
  onLoad?: () => string[] | null | Promise<string[] | null>;
  onReset?: () => void | Promise<void>;
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
  /** Unified player-action sink (Slice 2e): Pin-as-Target / Compare / Guide. */
  onPlayerAction?: (action: PlayerAction, context: PlayerActionContext) => void;
  /** Pinned ids so a FA row can present Pin vs Remove-target. */
  pinnedPlayerIds?: string[];
  poolManagement?: FreeAgentPoolManagementControls | null;
}

export interface FreeAgentRowProps {
  entry: FreeAgentSurfaceEntry;
  onSelect?: (entry: FreeAgentSurfaceEntry) => void;
  isSelected?: boolean;
  standardSigningActionLabel?: string;
  standardSigningExposureClassification?: ActionExposureClassification;
  openMenuSelectionKey?: string | null | undefined;
  setOpenMenuSelectionKey:
    | Dispatch<SetStateAction<string | null | undefined>>
    | ((value: string | null | undefined) => void);
  onOpenContractModal?: (entry: FreeAgentSurfaceEntry) => void;
  /** Unified player-action sink (Slice 2e): Pin-as-Target / Compare / Guide. */
  onPlayerAction?: (action: PlayerAction, context: PlayerActionContext) => void;
  /** Pinned ids so the row can present Pin vs Remove-target. */
  pinnedPlayerIds?: string[];
}

export interface FreeAgentCardProps {
  entry: FreeAgentSurfaceEntry;
  onOpenContractModal: (entry: FreeAgentSurfaceEntry) => void;
  onRemove: (selectionKey: string) => void;
  isPreviewSigning?: boolean;
  /**
   * Machine-readable exposure honesty for the deck Sign action. Mirrors the row's
   * `standardSigningExposureClassification` so the deck reports the same
   * supported/preview truth (V1 supported in a saved world, preview-only in sandbox)
   * instead of a hardcoded value.
   */
  exposureClassification?: ActionExposureClassification;
}
