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
  const cents = value * 100;
  return Number.isSafeInteger(cents) ? cents : null;
}

function teamIdentity(team: TradeCashRoutingTeam, index: number): string {
  return (
    String(
      team.teamId ||
        team.teamCode ||
        team.team?.teamCode ||
        team.team?.teamId ||
        team.team?.id ||
        ''
    )
      .trim()
      .toUpperCase() || `TEAM-${index}`
  );
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
  const teamIds = teams.map(teamIdentity);
  if (new Set(teamIds).size !== teamIds.length) {
    errors.push('Cash routing requires unique canonical Team identities.');
  }

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

    const explicitDestination = String(team.cashToTeamId || '')
      .trim()
      .toUpperCase();
    const destinationTeamId =
      explicitDestination ||
      (teams.length === 2
        ? teamIds.find((candidate) => candidate !== payerTeamId) || ''
        : '');
    if (!destinationTeamId) {
      errors.push(
        `${payerTeamId} cash requires an explicit destination in a multi-Team trade.`
      );
      return;
    }
    if (destinationTeamId === payerTeamId) {
      errors.push(`${payerTeamId} cannot send trade cash to itself.`);
      return;
    }
    if (!receivedByTeam.has(destinationTeamId)) {
      errors.push(
        `${payerTeamId} cash destination ${destinationTeamId} is not a trade participant.`
      );
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
