/** Shared shape checks; source admission and NBA legality remain separate. */
export function simulationParticipantLimit(metadata: Record<string, unknown>) {
  const branch = metadata.draftSimulationBranches;
  const program = metadata.draftSwapProgram as
    | { kind?: string; year?: number }
    | undefined;
  return branch === 'unconditional' ||
    branch === 'protection-programs' ||
    (branch === 'swap-program' &&
      ((program?.kind === 'ordered-swap-pool-v1' && program.year === 2026) ||
        (program?.kind === 'native-overlapping-pool-v1' &&
          program.year === 2028) ||
        (program?.kind === 'native-ranked-pool-v1' && program.year === 2029)))
    ? 3
    : 2;
}

export function requireTradeParticipants(
  teams: readonly string[],
  scope = teams
) {
  if (
    teams.length < 2 ||
    teams.length > 3 ||
    new Set(teams).size !== teams.length ||
    teams.some((team) => !/^[A-Z]{3}$/.test(team) || !scope.includes(team))
  )
    throw new Error(
      'Select two or three distinct participating teams within the governed scope.'
    );
}

export function requireNoncashTradeRoutes(
  teams: readonly string[],
  movements: readonly { fromTeam: string; toTeam: string }[]
) {
  requireTradeParticipants(teams);
  if (
    movements.some(
      (m) =>
        m.fromTeam === m.toTeam ||
        !teams.includes(m.fromTeam) ||
        !teams.includes(m.toTeam)
    ) ||
    teams.some(
      (team) =>
        !movements.some((m) => m.fromTeam === team) ||
        !movements.some((m) => m.toTeam === team)
    )
  )
    throw new Error(
      'Every participating team must give and receive explicit noncash selection or Contract consideration.'
    );
}
