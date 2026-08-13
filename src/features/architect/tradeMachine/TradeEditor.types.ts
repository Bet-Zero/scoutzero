import type { useTradeMachine } from '@/features/architect/hooks/useTradeMachine';
import type { EditContractModal } from '@/shared/components/EditContractModal';
import type {
  TradeObjective,
  TradeExceptionRef,
  TradeOpenAuthority,
} from '@/features/architect/cockpit/tradeOpenRequest';
import type { TradeSalaryMatchingElection } from '@/schemas/tradeSalaryMatchingPath';
import type { TradeTeamCard } from './TradeTeamCard';
import type TradePreviewModal from './TradePreviewModal';
import type { ValidationDetailsPanel } from './ValidationDetailsPanel';

export type UseTradeMachineResult = ReturnType<typeof useTradeMachine>;
export type HookTradeTeamSlot = UseTradeMachineResult['teams'][number];
export type ValidationDetailsPanelProps = Parameters<
  typeof ValidationDetailsPanel
>[0];
export type TradePreviewModalProps = Parameters<typeof TradePreviewModal>[0];
export type TradeTeamCardProps = Parameters<typeof TradeTeamCard>[0];
export type EditContractModalProps = Parameters<typeof EditContractModal>[0];
export type HookTradePlayer = Parameters<
  UseTradeMachineResult['setPlayerTrade']
>[1];
export type HookTradeActionMeta = Parameters<
  UseTradeMachineResult['setPlayerTrade']
>[4];
export type CardPlayerLike = TradeTeamCardProps['sends'][number];
export type CardTeamLike = NonNullable<TradeTeamCardProps['team']>;
export type CardEntitlementLike = NonNullable<
  TradeTeamCardProps['entitlementsOut']
>[number];
export type PrimaryTeamDataLike = Parameters<typeof useTradeMachine>[3];
export type ModalPlayerLike = NonNullable<EditContractModalProps['player']>;
export type ModalTeamCapSheetLike = NonNullable<
  EditContractModalProps['teamCapSheet']
>;
export type PlayerLike = CardPlayerLike;
export type TeamLike = CardTeamLike;

export type EntitlementLike = CardEntitlementLike & {
  identityKey?: string | null;
  underlyingStatus?: string | null;
  holderTeam?: string | number | null;
  holder_team?: string | number | null;
  originalTeamId?: string | number | null;
  originalTeam?: string | number | null;
  seasonYear?: number | string | null;
  year?: number | string | null;
  round?: number | string | null;
  kind?: string | null;
  secondaryText?: string | null;
  protectionDetails?: string | null;
  protection?: string | null;
  fromTeamId?: string | number | null;
  linkedEntitlementIds?: Array<string | number>;
  residualOfEntitlementId?: string | number | null;
  __vacuumSessionOnly?: boolean;
  __vacuumEdited?: boolean;
};

export type TradeTeamSlotLike = {
  team?: TeamLike | null;
  sends: PlayerLike[];
  entitlementsOut?: EntitlementLike[];
};

export type TradeDataEntryLike = {
  teamId?: string;
  outgoingEntitlements?: EntitlementLike[];
  salaryMatchingElection?: TradeSalaryMatchingElection | null;
};

export type TradeMachineSatModalState = {
  teamIndex: number;
  player: PlayerLike;
  defaultDestinationTeamId: string | null;
} | null;

export type EntitlementEditorState = {
  entitlementId: string | number | null;
  initialDocument: Record<string, unknown>;
} | null;

export type SignAndTradeResult = {
  success: boolean;
  message?: string;
};

/**
 * BZE-190: one-shot hand-off from Free Agency into the Trade Machine. Carries
 * the free agent the user chose to sign-and-trade (a player they still hold the
 * rights to) plus the source team. The editor surfaces this as a pending S&T
 * piece on the source team; the contract + destination are set, and legality is
 * checked, inside the Trade Machine.
 */
export interface TradeSignAndTradeSeed {
  player: Record<string, unknown>;
  sourceTeamCode?: string | null;
}

export interface TradeEditorProps {
  primaryTeam?: string | null;
  capProjections?: Record<string, unknown> | null;
  currentYear?: number | null;
  playersMap?: TradeTeamCardProps['playersMap'];
  onApplyTrade?:
    | ((tradeData: TradeDataEntryLike[]) => Promise<unknown> | unknown)
    | null;
  onAfterTradeApplied?: (() => void) | null;
  primaryTeamData?: PrimaryTeamDataLike;
  onEditContract?: ((player: PlayerLike) => void) | null;
  worldId?: string | null;
  worldAsOfDate?: string | Date | null;
  userId?: string | null;
  /** Notifies parent when local trade draft has outgoing assets (non-committed). */
  onDraftActivityChange?: ((active: boolean) => void) | null;
  /**
   * One-shot request to pre-stage one or more players as outgoing assets when
   * the Trade Machine opens from a player-context entry (the pin board's "Trade"
   * / "Trade all pinned"). Each id found on the primary team's roster is staged;
   * `onStagePlayerHandled` then clears the request. Ids not on the primary roster
   * are a no-op (still cleared) — see v1 scope.
   */
  requestedStagePlayerIds?: string[];
  onStagePlayerHandled?: (() => void) | null;
  /**
   * One-shot sign-and-trade seed from Free Agency (BZE-190). When set, the
   * editor pre-loads the free agent as a pending sign-and-trade piece on the
   * source team; `onSignAndTradeSeedHandled` then clears the request.
   */
  requestedSignAndTradeSeed?: TradeSignAndTradeSeed | null;
  onSignAndTradeSeedHandled?: (() => void) | null;
  /**
   * Context-carrying open (interconnectivity Slice 3): objective / exception /
   * committed-event reference + authority. Drives the dismissible in-overlay
   * banner. Never implies validation or apply.
   */
  tradeContext?: TradeOpenBannerContext | null;
}

export interface TradeOpenBannerContext {
  objective?: TradeObjective;
  exceptionRef?: TradeExceptionRef;
  relatedEventId?: string | null;
  authority: TradeOpenAuthority;
}
