import { resolveSwapProgram } from './swapProgram';
import type { loadConditionalWorld } from './conditionalWorld';
export function prepareSwapDraft(
  state: Awaited<ReturnType<typeof loadConditionalWorld>>,
  positions: Record<string, number>,
  elections: Record<string, boolean>,
  year: number
) {
  const program = state.swap;
  if (!program || program.year !== year || program.result)
    throw new Error('No unresolved swap pool is due in this draft.');
  const controller = program.slots.find(
    (s) =>
      s.entitlementId ===
      program.steps.find((s) => s.rightId === program.tradedRightId)!
        .controllerId
  )!;
  if (
    state.entitlements[program.tradedRightId].holderTeam !==
    controller.holderTeam
  )
    throw new Error(
      'Transfer the swap right to the return-selection owner before resolving it.'
    );
  const updated = resolveSwapProgram(program, positions, elections);
  const entitlements = structuredClone(state.entitlements);
  const affected = new Set([
    program.grantorTeam,
    ...program.slots.map((s) => s.holderTeam),
  ]);
  const lines = program.steps.map(
    (s) =>
      `${state.entitlements[s.rightId].holderTeam}: ${elections[s.rightId] ? 'exercised' : 'waived'} ${year} swap right in priority order`
  );
  const movements = program.slots.flatMap((s) => {
    const toTeam = updated.result!.allocation[s.entitlementId];
    entitlements[s.entitlementId].holderTeam = toTeam;
    lines.push(
      `${toTeam}: in ${s.originalTeam} ${year} first-round pick at pick ${positions[s.originalTeam]}`
    );
    if (toTeam === s.holderTeam) return [];
    lines.push(
      `${s.holderTeam}: out ${s.originalTeam} ${year} first-round pick`
    );
    return [
      {
        entitlementId: s.entitlementId,
        originalTeam: s.originalTeam,
        year,
        round: 1 as const,
        fromTeam: s.holderTeam,
        toTeam,
        assetKind: 'pick_ownership' as const,
      },
    ];
  });
  return { updated, entitlements, affected, lines, movements };
}
