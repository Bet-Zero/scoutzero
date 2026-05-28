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
export { ActivityRail, type ActivityRailHandle } from './ActivityRail';
export { CapPostureMeter } from './CapPostureMeter';
export { ModePill } from './ModePill';
export { WorldMenu } from './WorldMenu';
export { TeamStatusStrip, type HardCapCockpitStatus } from './TeamStatusStrip';
export { TeamStatusTile } from './TeamStatusTile';
export { useTeamPalette } from './useTeamPalette';
export { cockpitTokens } from './cockpitTokens';
