import { TeamSlugToCode } from '@/constants/teamList';

export type TradeCashRoutingTeam = {
  teamId?: unknown;
  teamCode?: unknown;
  team?: {
    teamCode?: unknown;
    teamId?: unknown;
    id?: unknown;
  } | null;
  cashSent?: unknown;
  cashReceived?: unknown;
  cashToTeamId?: unknown;
  cashCondition?: unknown;
  conditionalCash?: unknown;
  cashPayableOn?: unknown;
  signingBonusReimbursement?: unknown;
  compensationReimbursement?: unknown;
};

export type RoutedTradeCashTeam<T extends TradeCashRoutingTeam> = T & {
  cashSent: number;
  cashReceived: number;
  cashToTeamId: string | null;
};

export type TradeCashRoutingResult<T extends TradeCashRoutingTeam> =
  | { ok: true; teams: RoutedTradeCashTeam<T>[] }
  | { ok: false; errors: string[] };

export function cashDollarsToCents(value: unknown): number | null {
  if (value === undefined || value === null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const scaled = value * 100;
  const cents = Math.round(scaled);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  return Number.isSafeInteger(cents) && Math.abs(scaled - cents) <= tolerance
    ? cents
    : null;
}

export function canonicalizeTradeCashTeamId(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  const slug = normalized.toLowerCase() as keyof typeof TeamSlugToCode;
  const knownSlugCode = TeamSlugToCode[slug];
  if (knownSlugCode) return knownSlugCode;
  return normalized.toUpperCase();
}

export function resolveTradeCashTeamIdentity(
  team: TradeCashRoutingTeam,
  index = 0
): { teamId: string; aliases: string[] } {
  const aliases = [
    team.teamCode,
    team.team?.teamCode,
    team.teamId,
    team.team?.teamId,
    team.team?.id,
  ]
    .map(canonicalizeTradeCashTeamId)
    .filter((value): value is string => value !== null);
  const teamId = aliases[0] ?? `TEAM-${index}`;
  return { teamId, aliases: [...new Set([teamId, ...aliases])] };
}

function unsupportedLifecycleClaim(team: TradeCashRoutingTeam): string | null {
  const unsupportedFields = [
    'cashCondition',
    'conditionalCash',
    'cashPayableOn',
    'signingBonusReimbursement',
    'compensationReimbursement',
  ];
  return (
    unsupportedFields.find(
      (field) =>
        team[field as keyof TradeCashRoutingTeam] !== undefined &&
        team[field as keyof TradeCashRoutingTeam] !== null
    ) ?? null
  );
}

export function resolveTradeCashRouting<T extends TradeCashRoutingTeam>(
  teams: readonly T[]
): TradeCashRoutingResult<T> {
  const errors: string[] = [];
  const identities = teams.map(resolveTradeCashTeamIdentity);
  const teamIds = identities.map((identity) => identity.teamId);
  if (new Set(teamIds).size !== teamIds.length) {
    errors.push('Cash routing requires unique canonical Team identities.');
  }
  const teamIdByAlias = new Map<string, string>();
  identities.forEach((identity) => {
    identity.aliases.forEach((alias) => {
      const existing = teamIdByAlias.get(alias);
      if (existing && existing !== identity.teamId) {
        errors.push(`Cash routing alias ${alias} belongs to multiple trade participants.`);
      } else {
        teamIdByAlias.set(alias, identity.teamId);
      }
    });
  });

  const receivedByTeam = new Map(teamIds.map((teamId) => [teamId, 0]));
  const normalized: RoutedTradeCashTeam<T>[] = teams.map((team) => ({
    ...team,
    cashSent: 0,
    cashReceived: 0,
    cashToTeamId: null,
  }));

  teams.forEach((team, index) => {
    const payerTeamId = teamIds[index];
    const cashSentCents = cashDollarsToCents(team.cashSent);
    if (cashSentCents === null) {
      errors.push(`${payerTeamId} cash sent must be nonnegative whole cents.`);
      return;
    }
    const lifecycleClaim = unsupportedLifecycleClaim(team);
    if (cashSentCents > 0 && lifecycleClaim) {
      errors.push(
        `${payerTeamId} cash needs governed lifecycle input for ${lifecycleClaim}.`
      );
      return;
    }
    if (cashSentCents === 0) {
      normalized[index].cashSent = 0;
      normalized[index].cashToTeamId = null;
      return;
    }

    const explicitDestination = canonicalizeTradeCashTeamId(team.cashToTeamId);
    const destinationTeamId = explicitDestination
      ? teamIdByAlias.get(explicitDestination) || ''
      : teams.length === 2
        ? teamIds.find((candidate) => candidate !== payerTeamId) || ''
        : '';
    if (!destinationTeamId) {
      errors.push(
        explicitDestination
          ? `${payerTeamId} cash destination ${explicitDestination} is not a trade participant.`
          : `${payerTeamId} cash requires an explicit destination in a multi-Team trade.`
      );
      return;
    }
    if (destinationTeamId === payerTeamId) {
      errors.push(`${payerTeamId} cannot send trade cash to itself.`);
      return;
    }
    receivedByTeam.set(
      destinationTeamId,
      (receivedByTeam.get(destinationTeamId) || 0) + cashSentCents
    );
    normalized[index].cashSent = cashSentCents / 100;
    normalized[index].cashToTeamId = destinationTeamId;
  });

  teams.forEach((team, index) => {
    const teamId = teamIds[index];
    const derivedReceivedCents = receivedByTeam.get(teamId) || 0;
    if (team.cashReceived !== undefined && team.cashReceived !== null) {
      const statedReceivedCents = cashDollarsToCents(team.cashReceived);
      if (statedReceivedCents === null) {
        errors.push(`${teamId} cash received must be nonnegative whole cents.`);
      } else if (statedReceivedCents !== derivedReceivedCents) {
        errors.push(
          `${teamId} stated cash received does not match directed cash sent.`
        );
      }
    }
    normalized[index].cashReceived = derivedReceivedCents / 100;
  });

  return errors.length > 0
    ? { ok: false, errors: [...new Set(errors)] }
    : { ok: true, teams: normalized };
}
