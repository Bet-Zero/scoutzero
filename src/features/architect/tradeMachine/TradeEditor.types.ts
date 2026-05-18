import type { useTradeMachine } from '@/features/architect/hooks/useTradeMachine';
import type { EditContractModal } from '@/shared/components/EditContractModal';
import type { TradeTeamCard } from './TradeTeamCard';
import type TradePreviewModal from './TradePreviewModal';
import type { ValidationDetailsPanel } from './ValidationDetailsPanel';

export type UseTradeMachineResult = ReturnType<typeof useTradeMachine>;
export type HookTradeTeamSlot = UseTradeMachineResult['teams'][number];
export type ValidationDetailsPanelProps = Parameters<typeof ValidationDetailsPanel>[0];
export type TradePreviewModalProps = Parameters<typeof TradePreviewModal>[0];
export type TradeTeamCardProps = Parameters<typeof TradeTeamCard>[0];
export type EditContractModalProps = Parameters<typeof EditContractModal>[0];
export type HookTradePlayer = Parameters<UseTradeMachineResult['setPlayerTrade']>[1];
export type HookTradeActionMeta = Parameters<UseTradeMachineResult['setPlayerTrade']>[4];
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

export interface TradeEditorProps {
  primaryTeam?: string | null;
  capProjections?: Record<string, unknown> | null;
  currentYear?: number | null;
  playersMap?: TradeTeamCardProps['playersMap'];
  onApplyTrade?:
    | ((tradeData: TradeDataEntryLike[]) => Promise<unknown> | unknown)
    | null;
  primaryTeamData?: PrimaryTeamDataLike;
  onEditContract?: ((player: PlayerLike) => void) | null;
  worldId?: string | null;
  worldAsOfDate?: string | Date | null;
  userId?: string | null;
}
