/**
 * FILE: src/features/architect/cockpit/index.ts
 * PURPOSE: Public surface for the Architect cockpit shell (Phase 1).
 * OWNERSHIP: Feature: architect/cockpit
 */
export { CockpitShell } from './CockpitShell';
export { RoomFrame } from './RoomFrame';
export { NavRail, type NavRailItem } from './NavRail';
export { TopBar } from './TopBar';
export { Workbench, type RoomDescriptor } from './Workbench';
export { TradeOverlay } from './TradeOverlay';
export { ActivityRail, type ActivityRailHandle } from './ActivityRail';
export { CapPostureMeter } from './CapPostureMeter';
export { ModePill } from './ModePill';
export { WorldMenu } from './WorldMenu';
export { TeamStatusStrip, type HardCapCockpitStatus } from './TeamStatusStrip';
export { TeamStatusTile } from './TeamStatusTile';
export { useTeamPalette } from './useTeamPalette';
export { cockpitTokens } from './cockpitTokens';
export { CockpitStatePanel, type CockpitStateVariant } from './CockpitStatePanel';
export {
  getAuthorityLabel,
  AUTHORITY_TONE_BADGE_CLASSES,
  type AuthorityTone,
  type AuthorityLabelResult,
  type AuthorityLabelInput,
} from './authorityLabel';
export {
  PlayerActionMenu,
  type PlayerActionMenuProps,
  type PlayerActionMenuExtraItem,
} from './PlayerActionMenu';
export {
  buildPlayerActionContext,
  type PlayerAction,
  type PlayerActionContext,
  type PlayerActionSourceRoom,
  type PlayerActionContextPlayerLike,
  type BuildPlayerActionContextInput,
} from './playerActionContext';
