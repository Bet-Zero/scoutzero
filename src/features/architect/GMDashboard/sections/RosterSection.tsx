/**
 * FILE: src/features/architect/GMDashboard/sections/RosterSection.tsx
 * PURPOSE: Render the GM dashboard roster section via RosterVisual.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Stage 2C: forwards the dashboard-owned `onOpenPlayerContractModal`
 * callback (routed through `useArchitectActions.handleEditContract`)
 * and the receipt-derived `highlightPlayerId` into RosterVisual. No
 * mutation authority is added at this layer — the modal owns commits.
 *
 * HISTORY:
 *  - 2025-12-12: Header added for documentation compliance (single-step task)
 *
 * LINKS:
 *  - Plan: n/a (single-step task)
 *  - Latest Chunk: n/a
 */
import {
  RosterVisual,
  type RosterVisualCapSheetInput,
  type RosterVisualDetailsMap,
} from '@/features/architect/shared/RosterVisual';
import type {
  PlayerAction,
  PlayerActionContext,
} from '@/features/architect/cockpit';

type RosterPlayerLike = Record<string, unknown>;

type RosterSectionProps = {
  teamCapSheet: RosterVisualCapSheetInput | null | undefined;
  playersMap?: RosterVisualDetailsMap;
  teamId?: string | null;
  currentYear?: number | null;
  /**
   * Stage 2C: dashboard-owned contract-modal opener. When provided,
   * clicking a roster card opens the existing EditContractModal
   * through `useArchitectActions.handleEditContract`. No mutation
   * authority is created at this layer.
   */
  onOpenPlayerContractModal?: ((player: RosterPlayerLike) => void) | null;
  /**
   * Stage 2C: receipt-derived focused player id. Roster cards matching
   * this id render a non-mutating "just changed" outline.
   */
  highlightPlayerId?: string | null;
  /** Multi-focus highlight (pinned players). Unioned with highlightPlayerId. */
  highlightPlayerIds?: string[];
  /** Unified player-action intents routed by GMDashboard (adds the card menu). */
  onPlayerAction?:
    | ((action: PlayerAction, context: PlayerActionContext) => void)
    | null;
  /** Pinned ids so each card menu can show Pin vs Unpin. */
  pinnedPlayerIds?: string[];
};

const RosterSection = ({
  teamCapSheet,
  playersMap,
  teamId,
  currentYear = null,
  onOpenPlayerContractModal,
  highlightPlayerId = null,
  highlightPlayerIds = [],
  onPlayerAction = null,
  pinnedPlayerIds = [],
}: RosterSectionProps) => (
  <RosterVisual
    teamCapSheet={teamCapSheet}
    playersMap={playersMap}
    teamId={teamId}
    currentYear={currentYear}
    onSelectPlayer={
      onOpenPlayerContractModal
        ? (player) => onOpenPlayerContractModal(player as RosterPlayerLike)
        : null
    }
    highlightPlayerId={highlightPlayerId}
    highlightPlayerIds={highlightPlayerIds}
    onPlayerAction={onPlayerAction}
    pinnedPlayerIds={pinnedPlayerIds}
  />
);

export { RosterSection };
