/**
 * Targeted ambient declarations for legacy JS/JSX modules imported by TS files.
 *
 * These declarations are intentionally narrow. They exist only to bridge
 * unresolved JS modules while preserving the real named-export contract.
 */

declare module '@/shared/utils/formatting' {
  export const formatSalary: any;
  export const formatCurrency: any;
  export const formatCurrencyFull: any;
  export const formatNumber: any;
  export const formatName: any;
  export const formatPercent: any;
  export const getTeamColors: any;
  export const formatMillions: any;
  export const formatHeight: any;
}

declare module '@/shared/utils/formatting/basicFormatting.js' {
  export const formatSalary: any;
  export const formatCurrency: any;
  export const formatMillions: any;
}

declare module '@/shared/utils/formatting/teamColors' {
  export const getTeamColor: any;
  export const getTeamColors: any;
  export const getTeamGradient: any;
}

declare module '@/shared/utils/formatting/teamLogos' {
  export const getTeamLogo: any;
  export const getTeamLogoFilename: any;
}

declare module '@/shared/utils/roles' {
  export const hasRole: any;
  export const isAdmin: any;
  export const POSITION_MAP: any;
  export const getPlayerPositionLabel: any;
}

declare module '@/shared/utils/filtering' {
  export const normalizeTeamCode: any;
  export const normalizeFreeAgentType: any;
  export const getPlayerFreeAgentType: any;
  export const teamOptions: any;
  export const playerHasOptionType: any;
  export const isPlayerTwoWay: any;
  export const getDefaultAddPlayerFilters: any;
  export const getDefaultPlayerFilters: any;
  export const getFilterDisplayValue: any;
  export const getFilterStyles: any;
  export const statOptions: any;
  export const getDefaultMaxValue: any;
  export const getActiveStatFilters: any;
  export const generateHeightOptions: any;
  export const generateWeightOptions: any;
  export const generateAgeOptions: any;
  export const filterPlayers: any;
  export const sortPlayers: any;
}

declare module '@/shared/utils/contracts' {
  export const getYearsRemaining: any;
}

declare module '@/shared/utils/videoExamples' {
  export const createEmptyVideoExamples: any;
  export const isYouTubeUrl: any;
  export const extractYouTubeId: any;
  export const getYouTubeEmbedUrl: any;
  export const getYouTubeThumbnailUrl: any;
  export const buildVideoExample: any;
  export const normalizeVideoExampleList: any;
  export const normalizeVideoExamples: any;
  export const DEFAULT_VIDEO_EXAMPLES: any;
}

declare module '@/shared/utils/routing/playerRouteUtils' {
  export const getPlayerProfileUrl: any;
}

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

declare module '@/shared/hooks/useAuth' {
  export const useAuth: any;
}

declare module '@/shared/hooks/useImageDownload' {
  const useImageDownload: any;
  export default useImageDownload;
}

declare module '@/shared/hooks/usePlayerDetail' {
  const usePlayerDetail: any;
  export default usePlayerDetail;
}

declare module '@/constants/teamList' {
  export const NBA_TEAMS: any;
  export const TEAM_LIST: any;
  export const TeamMap: any;
  export const TeamCodeMap: any;
  export const TeamListFull: any;
  export const TeamSlugToCode: any;
}

declare module '@/config/validationFlags.js' {
  export const validationFlags: any;
  export const shouldWarnOnly: any;
}

declare module '@/data/firestorePaths' {
  export const baseTeamRef: any;
  export const baseTeamsCol: any;
  export const basePlayerRef: any;
  export const basePlayersCol: any;
  export const baseEntitlementRef: any;
  export const baseEntitlementsCol: any;
}

declare module '@/firebaseConfig' {
  export const db: any;
  export const auth: any;
  export const functions: any;
  export const FIREBASE_TARGET_MODE: any;
  export const isLikelyEmulatorConnectionError: any;
}

declare module '@/features/profile/utils/profileHelpers' {
  export const getPlayersForTeam: any;
  export const getModalTitle: any;
  export const getBlurbValue: any;
  export const getVideoExamplesForKey: any;
  export const setVideoExamplesForKey: any;
  export const addVideoExampleForKey: any;
  export const removeVideoExampleForKey: any;
  export const setBlurbForKey: any;
  export const updateVideoExampleLabelForKey: any;
}

declare module '@/features/roster/utils' {
  export const isTwoWayContract: any;
  export const enrichPlayerData: any;
  export const findSalaryForYear: any;
  export const hasActiveAddPlayerFilters: any;
  export const filterRosterDrawerPlayers: any;
  export const getPlayersForSelectedTeam: any;
  export const normalizeHeadshotId: any;
  export const createEmptyRoster: any;
  export const normalizeRosterShape: any;
  export const normalizePlayer: any;
  export const createMissingRosterPlayer: any;
  export const isRosterFull: any;
  export const buildInitialRoster: any;
}

declare module '@/features/roster/utils/enrichPlayerData' {
  export const enrichPlayerData: any;
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
  export const buildPostTradeTeamsSnapshot: any;
  export const validatePostTradeSnapshotForContext: any;
  export const legacy_validateTradeForContext: any;
  export const validateTradeForContext: any;
  export const assertPostTradeSnapshot: any;
  export const assertValidatedTradeContext: any;
  export const assertTradeComputeInputs: any;
}

declare module '@/features/architect/utils/tradeMachine' {
  export const validateTrade: any;
  export const hasStepienViolation: any;
}
