import type { useTradeMachine } from '@/features/architect/hooks/useTradeMachine';
import type { OutgoingPlayersList } from './OutgoingPlayersList';
import type { EntitlementPicksList } from './EntitlementPicksList';
import type { getTeamSnapshot } from '@/features/architect/hooks/useTradeMachineSnapshot';
import type { TradeExceptionLike } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';

export type UnknownRecord = Record<string, unknown>;
export type UseTradeMachineResult = ReturnType<typeof useTradeMachine>;
export type HookTradeTeamSlot = UseTradeMachineResult['teams'][number];
export type HookTradeTeam = NonNullable<HookTradeTeamSlot['team']>;
export type OutgoingPlayersListProps = Parameters<typeof OutgoingPlayersList>[0];
export type EntitlementPicksListProps = Parameters<typeof EntitlementPicksList>[0];
export type ChildPlayerLike = OutgoingPlayersListProps['sends'][number];
export type ChildTeamOptionLike = NonNullable<
  OutgoingPlayersListProps['otherTeams']
>[number];
export type ChildEntitlementTeamOptionLike = NonNullable<
  EntitlementPicksListProps['otherTeams']
>[number];
export type ValidationResultLike = Parameters<typeof getTeamSnapshot>[1];
export type HookTradePlayer = HookTradeTeamSlot['sends'][number];
export type HookTradeEntitlement = NonNullable<
  HookTradeTeamSlot['entitlementsOut']
>[number];
export type PlayerLike = HookTradePlayer &
  ChildPlayerLike & {
    matchOutgoing?: number | string | null;
    matchIncoming?: number | string | null;
    absorptionMode?: string | null;
    tpeId?: string | number | null;
    bucketType?: string | null;
  };
export type EntitlementLike = HookTradeEntitlement & {
  id?: string | number | null;
  entitlementId?: string | number | null;
  identityKey?: string | null;
  underlyingStatus?: string | null;
  seasonYear?: number | string | null;
  round?: number | string | null;
  kind?: string | null;
  secondaryText?: string | null;
  fromTeamId?: string | number | null;
  toTeamId?: string | number | null;
  linkedEntitlementIds?: Array<string | number>;
  residualOfEntitlementId?: string | number | null;
  __vacuumSessionOnly?: boolean;
  __vacuumEdited?: boolean;
};
export type TeamOptionLike = Omit<
  ChildTeamOptionLike & ChildEntitlementTeamOptionLike,
  'id' | 'teamName' | 'teamCode'
> & {
  id?: string | number | null;
  teamName?: string | null;
  teamCode?: string | null;
};
export type TeamLike = Omit<HookTradeTeam, 'pickRulesById'> & {
  id?: string | null;
  teamId?: string | null;
  teamCode?: string | null;
  teamName?: string | null;
  abbreviation?: string | null;
  players?: HookTradePlayer[] | null;
  twoWayPlayers?: HookTradePlayer[] | null;
  entitlements?: HookTradeEntitlement[] | null;
  pickRulesById?: Record<string, unknown>;
  capHolds?: unknown[] | null;
  teamTotalSalary?: number;
};
export type TeamTradeException = TradeExceptionLike & {
  id?: string | number;
  amount?: number | null;
  remaining?: number | null;
  name?: string | null;
  createdFrom?: string | null;
  isUsed?: boolean;
  expirationDate?: string | null;
  expiresOn?: string | null;
};

export const getPlayerKey = (player: PlayerLike) =>
  player.player_id ?? player.id ?? player.name ?? 'player';

export const getPlayerLabel = (player: PlayerLike) =>
  player.name ?? player.bio?.displayName ?? 'Unnamed player';

export const getEntitlementKey = (entitlement: EntitlementLike) =>
  entitlement.id ??
  entitlement.entitlementId ??
  entitlement.identityKey ??
  `${entitlement.seasonYear ?? 'unknown'}-${entitlement.round ?? 'unknown'}-${
    entitlement.kind ?? 'unknown'
  }`;

export const toPlayerTeamOption = (
  team: TeamOptionLike
): ChildTeamOptionLike => ({
  ...team,
  id: team.id == null ? undefined : String(team.id),
  teamName: team.teamName ?? undefined,
});

export const toEntitlementTeamOption = (
  team: TeamOptionLike
): ChildEntitlementTeamOptionLike => ({
  ...team,
  id: team.id ?? undefined,
  teamName: team.teamName ?? undefined,
  teamCode: team.teamCode ?? undefined,
});

export interface TradeTeamCardProps {
  team?: TeamLike | null;
  sends: PlayerLike[];
  yearKey: string | number;
  otherTeams?: TeamOptionLike[];
  playersMap?: OutgoingPlayersListProps['playersMap'];
  incomingPlayers?: PlayerLike[];
  incomingEntitlements?: EntitlementLike[];
  onSetPlayerTrade?:
    | ((
        player: PlayerLike,
        action: string,
        targetTeamId?: string | null,
        meta?: unknown
      ) => void)
    | null;
  onUndoPlayerTrade?: ((player: PlayerLike) => void) | null;
  onRequestSignAndTrade?:
    | ((player: PlayerLike, defaultDestinationTeamId?: string | null) => void)
    | null;
  onSelectTeam: (teamId: string) => void;
  onRemove?: (() => void) | null;
  onEditContract?: ((player: PlayerLike) => void) | null;
  validationResult?: ValidationResultLike;
  teamIndex?: number | null;
  isValidating?: boolean;
  entitlementsOut?: EntitlementLike[];
  onToggleEntitlement?: ((entitlement: EntitlementLike) => void) | null;
  onSetEntitlementDestination?:
    | ((
        entitlementId: string | undefined | null,
        toTeamId: string | undefined | null
      ) => void)
    | null;
  onEditEntitlement?: ((entitlement: EntitlementLike) => void) | null;
  onViewEntitlementDetails?: ((entitlement: EntitlementLike) => void) | null;
  onCreateEntitlement?: ((teamId?: string | null) => void) | null;
  isVacuumMode?: boolean;
  onRevertEntitlementEdit?: ((entitlement: EntitlementLike) => void) | null;
  onDeleteSessionEntitlement?: ((entitlement: EntitlementLike) => void) | null;
  worldId?: string | null;
  compact?: boolean;
}

export function formatSkipReasonLabel(skipReason: unknown): string | null {
  if (!skipReason || typeof skipReason !== 'string') return null;

  if (skipReason.includes(' ') && !skipReason.includes('_')) {
    return skipReason;
  }

  const ACRONYMS = ['TPE', 'BYC', 'MLE', 'BAE'];
  const words = skipReason.split('_');

  const processed = words.map((word, index) => {
    const upper = word.toUpperCase();
    if (ACRONYMS.includes(upper)) return upper;

    if (index === 0) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word.toLowerCase();
  });

  return processed.join(' ');
}
