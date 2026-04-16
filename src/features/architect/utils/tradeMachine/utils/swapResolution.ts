type SwapType = 'best_of' | 'worst_of';

type PositionsMap = Record<string, number>;

interface SwapWinnerInput {
  teamA?: unknown;
  teamB?: unknown;
  swapType?: unknown;
}

interface SwapResolutionOptions {
  nowIso?: string;
  method?: string;
  draftYear?: number;
}

interface SwapPickLike extends Record<string, unknown> {
  id?: string | number | null;
  year?: number | string | null;
  round?: number | string | null;
  originalTeam?: string | null;
  isSwap?: boolean | null;
  swapType?: 'best_of' | 'worst_of' | string | null;
  swapWithTeamId?: string | null;
  resolved?: boolean | null;
  resolvedOwner?: string | null;
  resolvedPosition?: number | null;
  resolutionMeta?: unknown;
}

interface TeamSwapsResult {
  draftPicks: unknown[];
  resolvedCount: number;
  warnings: string[];
}

export function resolveSwapWinner(
  { teamA, teamB, swapType = 'best_of' }: SwapWinnerInput,
  positionsMap: PositionsMap
): string {
  if (!teamA || !teamB) {
    throw new Error('resolveSwapWinner requires both teamA and teamB');
  }

  if (!positionsMap || typeof positionsMap !== 'object') {
    throw new Error('resolveSwapWinner requires positionsMap');
  }

  const posA = positionsMap[String(teamA)];
  const posB = positionsMap[String(teamB)];

  if (typeof posA !== 'number' || !Number.isFinite(posA)) {
    throw new Error(`Missing position data for team ${teamA}`);
  }

  if (typeof posB !== 'number' || !Number.isFinite(posB)) {
    throw new Error(`Missing position data for team ${teamB}`);
  }

  const normalizedSwapType = (swapType || 'best_of') as SwapType | unknown;

  if (
    normalizedSwapType !== 'best_of' &&
    normalizedSwapType !== 'worst_of'
  ) {
    throw new Error(
      `Invalid swapType: '${normalizedSwapType}'. Must be 'best_of' or 'worst_of'`
    );
  }

  if (normalizedSwapType === 'best_of') {
    return posA <= posB ? String(teamA) : String(teamB);
  }

  return posA >= posB ? String(teamA) : String(teamB);
}

export function resolvePickSwap(
  pick: SwapPickLike | null | undefined,
  positionsMap: PositionsMap,
  options: SwapResolutionOptions = {}
): SwapPickLike | null | undefined {
  if (!pick) {
    return pick;
  }

  if (pick.isSwap !== true) {
    return pick;
  }

  if (!pick.swapWithTeamId) {
    return pick;
  }

  if (pick.resolved === true) {
    return pick;
  }

  const teamA = String(pick.originalTeam || 'UNK');
  const teamB = String(pick.swapWithTeamId);
  const swapType = (pick.swapType || 'best_of') as SwapType | unknown;

  if (!positionsMap || typeof positionsMap !== 'object') {
    throw new Error('resolvePickSwap requires positionsMap');
  }

  const posA = positionsMap[teamA];
  const posB = positionsMap[teamB];

  if (typeof posA !== 'number' || !Number.isFinite(posA)) {
    throw new Error(`Missing position data for team ${teamA}`);
  }

  if (typeof posB !== 'number' || !Number.isFinite(posB)) {
    throw new Error(`Missing position data for team ${teamB}`);
  }

  const winner = resolveSwapWinner({ teamA, teamB, swapType }, positionsMap);
  const winnerPosition = positionsMap[winner];
  const nowIso = options.nowIso || new Date().toISOString();
  const method = options.method || 'lottery';

  return {
    ...pick,
    resolved: true,
    resolvedOwner: winner,
    resolvedPosition: winnerPosition,
    resolutionMeta: {
      resolvedAt: nowIso,
      method,
      positions: { [teamA]: posA, [teamB]: posB },
    },
  };
}

export function resolveTeamSwaps(
  draftPicks: unknown,
  positionsMap: PositionsMap,
  options: SwapResolutionOptions = {}
): TeamSwapsResult {
  if (!Array.isArray(draftPicks)) {
    return {
      draftPicks: [],
      resolvedCount: 0,
      warnings: ['draftPicks must be an array'],
    };
  }

  if (!positionsMap || typeof positionsMap !== 'object') {
    return {
      draftPicks,
      resolvedCount: 0,
      warnings: ['No positionsMap provided - skipping swap resolution'],
    };
  }

  const { draftYear, nowIso, method } = options;
  let resolvedCount = 0;
  const warnings: string[] = [];

  const updatedPicks = draftPicks.map((pick) => {
    const swapPick = pick as SwapPickLike | null | undefined;

    if (!swapPick || swapPick.isSwap !== true) {
      return pick;
    }

    if (swapPick.resolved === true) {
      return pick;
    }

    if (draftYear && swapPick.year !== draftYear) {
      return pick;
    }

    if (!swapPick.swapWithTeamId) {
      warnings.push(
        `Pick ${swapPick.id || 'unknown'} missing swapWithTeamId - cannot resolve`
      );
      return pick;
    }

    try {
      const resolved = resolvePickSwap(swapPick, positionsMap, {
        nowIso,
        method,
      }) as SwapPickLike;
      if (resolved?.resolved === true) {
        resolvedCount++;
      }
      return resolved;
    } catch (err) {
      warnings.push(
        `Pick ${swapPick.id || 'unknown'}: ${err instanceof Error ? err.message : String(err)}`
      );
      return pick;
    }
  });

  return {
    draftPicks: updatedPicks,
    resolvedCount,
    warnings,
  };
}
