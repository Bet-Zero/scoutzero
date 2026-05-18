import type {
  HookTradeActionMeta,
  HookTradePlayer,
  PlayerLike,
  ModalPlayerLike,
  TeamLike,
  ModalTeamCapSheetLike,
} from './TradeEditor.types';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const normalizeTradeActionMeta = (
  actionMeta: unknown
): HookTradeActionMeta | null => {
  return isRecord(actionMeta) ? actionMeta : null;
};

export const toHookTradePlayer = (
  player: PlayerLike | ModalPlayerLike
): HookTradePlayer => ({
  ...player,
});

export const normalizeModalId = (
  value: string | number | null | undefined
): string | null | undefined => {
  if (value == null || value === '') {
    return value == null ? null : undefined;
  }
  return String(value);
};

export const toEditContractModalPlayer = (player: PlayerLike): ModalPlayerLike => ({
  ...player,
  id: normalizeModalId(player.id),
  player_id: normalizeModalId(player.player_id),
  playerId: normalizeModalId(player.playerId),
  yearsOfService:
    typeof player.yearsOfService === 'number'
      ? player.yearsOfService
      : typeof player.yearsOfService === 'string'
        ? Number(player.yearsOfService) || undefined
        : undefined,
  bio: player.bio
    ? {
        ...player.bio,
        playerId: normalizeModalId(player.bio.playerId),
      }
    : undefined,
});

const normalizeRecordArray = (items: unknown) => {
  return Array.isArray(items)
    ? items.filter(isRecord).map((item) => ({ ...item }))
    : [];
};

export const toEditContractModalTeamCapSheet = (
  team: TeamLike | null | undefined
): ModalTeamCapSheetLike | undefined => {
  if (!team) {
    return undefined;
  }

  return {
    ...team,
    players: Array.isArray(team.players)
      ? team.players.map(toEditContractModalPlayer)
      : null,
    capHolds: normalizeRecordArray(team.capHolds),
    deadCap: normalizeRecordArray(team.deadCap),
  };
};
