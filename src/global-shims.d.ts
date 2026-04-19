/**
 * Targeted ambient declarations for legacy JS/JSX modules imported by TS files.
 *
 * These declarations are intentionally narrow. They exist only to bridge
 * unresolved JS modules while preserving the real named-export contract.
 */

declare module '@/shared/components/BirdRightsIcon' {
  const BirdRightsIcon: any;
  export default BirdRightsIcon;
}

declare module '@/shared/components/TeamLogo' {
  const TeamLogo: any;
  export default TeamLogo;
}

declare module '@/shared/components/TeamSelectDropdown' {
  const TeamSelectDropdown: any;
  export default TeamSelectDropdown;
}

declare module '@/shared/components/ui/Dialog' {
  export const Dialog: any;
  export const DialogContent: any;
  export const DialogHeader: any;
  export const DialogTitle: any;
  export const DialogFooter: any;
  export const DialogClose: any;
}

declare module '@/shared/components/ui/filters' {
  export const MultiSelectFilter: any;
}

declare module '@/features/roster/RosterSection' {
  const RosterSection: any;
  export default RosterSection;
}

declare module '@/features/architect/utils/capTotals' {
  export const computeTeamCapTotals: any;
  export const warnOnTotalsDivergence: any;
  export const resetWarnedKeys: any;
  export const canUseRoomException: any;
}

declare module '@/features/architect/utils/exceptions' {
  export const resetTeamNonTpeExceptionsForNewSeason: any;
  export const validateNonTpeExceptionsForYear: any;
  export const NON_TPE_EXCEPTION_TYPES: any;
}

declare module '@/features/architect/utils/persistenceContracts' {
  export const TEAM_OVERLAY_TOP_LEVEL_ALLOWLIST: any;
  export const TRADE_EXCEPTION_ITEM_ALLOWLIST: any;
  export const EXCEPTION_HISTORY_ITEM_ALLOWLIST: any;
  export const DEAD_CAP_ITEM_ALLOWLIST: any;
  export const DEAD_CAP_AMOUNT_BY_YEAR_ITEM_ALLOWLIST: any;
  export const CAP_HOLD_ITEM_ALLOWLIST: any;
  export const PLAYER_OVERRIDE_TOP_LEVEL_ALLOWLIST: any;
  export const EVENT_TOP_LEVEL_ALLOWLIST: any;
  export const EVENT_METADATA_TOP_LEVEL_ALLOWLIST: any;
  export const TEAM_DEEP_RULES: any;
  export const PERSISTENCE_CONTRACTS: any;
  export const findDisallowedKeyPaths: any;
  export const validatePersistableShape: any;
  export const formatViolationMessage: any;
  export const shouldEnforcePersistenceContracts: any;
  export const assertPersistableOrThrow: any;
  export const checkPersistableContract: any;
  export const normalizeTeamTpeSchema: any;
  export const getTeamTpeList: any;
  export const getTpeIdentityKey: any;
}

declare module '@/features/architect/utils/tradeContext' {
  export const buildTradeApplyPreparation: any;
  export const buildPostTradeTeamsSnapshot: any;
  export const getTradePreviewAuthority: any;
  export const normalizeTradeTeamCodeLike: any;
  export const resolveOutgoingTradeDestinationTeamCode: any;
  export const validatePostTradeSnapshotForContext: any;
  export const validateTradeExecutionAuthority: any;
  export const assertPostTradeSnapshot: any;
  export const assertValidatedTradeContext: any;
  export const assertTradeComputeInputs: any;
  export type FullLegalityPreviewResult = any;
}

declare module '@/features/architect/utils/tradeContext/legacy' {
  export const getFullLegalityPreview: any;
  export const legacy_validateTradeForContext: any;
  export const validateTradeForContext: any;
}

declare module '@/features/architect/utils/tradeMachine' {
  export const validateTrade: any;
}
