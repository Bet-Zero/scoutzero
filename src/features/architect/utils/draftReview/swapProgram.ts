/** Ordered exchange of selections within fully specified governed pools. */
import {
  DraftSwapProgramZ,
  type DraftSwapProgram,
} from '@/schemas/draftSwapProgram';
import { canonicalStringify } from '../contractSource/deterministicDigest';
import { resolveSwapForEntitlement } from '../entitlements/dare/swapResolutionAdapter';
import type { SimulationCatalogue } from './simulationInventory';

export function resolveSwapProgram(
  input: DraftSwapProgram,
  positions: Record<string, number>,
  elections: Record<string, boolean>
) {
  const p = DraftSwapProgramZ.parse(input);
  if (p.result) throw new Error('This swap pool was already resolved.');
  const originalTeam = (id: string) => {
    const team = p.slots.find((s) => s.entitlementId === id)?.originalTeam;
    if (!team) throw new Error('Original selection identity is unavailable.');
    return team;
  };
  const teams = p.slots.map((s) => s.originalTeam);
  if (
    canonicalStringify(Object.keys(positions).sort()) !==
      canonicalStringify([...teams].sort()) ||
    Object.values(positions).some(
      (n) => !Number.isInteger(n) || n < 1 || n > 30
    ) ||
    new Set(Object.values(positions)).size !== teams.length
  )
    throw new Error(
      'Every pool participant needs a distinct final draft position; ties and missing positions are unsupported.'
    );
  if (
    canonicalStringify(Object.keys(elections).sort()) !==
      canonicalStringify(p.steps.map((s) => s.rightId).sort()) ||
    Object.values(elections).some((e) => typeof e !== 'boolean')
  )
    throw new Error(
      'An explicit exercise or waiver is required for every ordered claim.'
    );
  const occupants = Object.fromEntries(
    p.slots.map((s) => [s.entitlementId, s.entitlementId])
  );
  for (const step of p.steps) {
    if (!elections[step.rightId]) continue;
    // All participants, integer positions and tie semantics were qualified above.
    // The adapter chooses a selection; its legacy newOwner is never an owner.
    const candidateTeams = step.poolIds.map((id) =>
      originalTeam(occupants[id])
    );
    const controller = originalTeam(occupants[step.controllerId]);
    const resolved = resolveSwapForEntitlement(
      {
        id: step.rightId,
        kind: 'swap_right',
        seasonYear: p.year,
        round: 1,
        holderTeam: controller,
        swapType: step.comparator,
        swapControllerPickId: `${controller}_${p.year}_1st`,
        poolUnderlyingPickIds: candidateTeams.map((t) => `${t}_${p.year}_1st`),
      },
      positions,
      {
        draftYear: p.year,
        method: 'governed-ordered-pool',
        nowIso: `${p.year}-06-30T00:00:00Z`,
      }
    );
    if (resolved.outcome !== 'swap_resolved' || !resolved.swapWinner)
      throw new Error('The complete pool could not be resolved.');
    const selected = step.poolIds.find(
      (id) => originalTeam(occupants[id]) === resolved.swapWinner
    );
    if (!selected)
      throw new Error('Resolved selection is outside the complete pool.');
    [occupants[step.controllerId], occupants[selected]] = [
      occupants[selected],
      occupants[step.controllerId],
    ];
  }
  const allocation = Object.fromEntries(
    p.slots.map((s) => [occupants[s.entitlementId], s.holderTeam])
  );
  return DraftSwapProgramZ.parse({
    ...p,
    result: { positions, elections, allocation },
  });
}

export function swapProgram(
  input: unknown,
  catalogue: SimulationCatalogue,
  entitlements: Record<string, Record<string, unknown>>
) {
  const p = DraftSwapProgramZ.parse(input);
  const originals = catalogue.data.records.filter((r) => r.originalPick);
  for (const slot of p.slots) {
    const original = originals.find(
      (r) => r.entitlementId === slot.entitlementId
    )?.originalPick;
    if (
      !original ||
      original.draftYear !== p.year ||
      original.originalTeam !== slot.originalTeam
    )
      throw new Error(
        'Swap slots require retained original identities from the same draft.'
      );
  }
  const poolPickIds = new Set(
    p.slots.map(
      (s) =>
        originals.find((r) => r.entitlementId === s.entitlementId)!
          .originalPick!.id
    )
  );
  const relevant = Object.entries(entitlements)
    .filter(([id, e]) => {
      if (
        e.seasonYear !== p.year ||
        e.round !== 1 ||
        e.kind === 'pick_ownership'
      )
        return false;
      return (
        p.steps.some((s) => s.rightId === id) ||
        (typeof e.swapControllerPickId === 'string' &&
          poolPickIds.has(e.swapControllerPickId)) ||
        (Array.isArray(e.poolUnderlyingPickIds) &&
          e.poolUnderlyingPickIds.some((id) => poolPickIds.has(id)))
      );
    })
    .map(([id]) => id);
  if (
    canonicalStringify([...relevant].sort()) !==
    canonicalStringify(
      [...p.steps.map((s) => s.rightId), ...p.inactiveClaimIds].sort()
    )
  )
    throw new Error(
      'Every competing retained pool claim needs an explicit governed disposition.'
    );
  const reachable = Object.fromEntries(
    p.slots.map((s) => [
      s.entitlementId,
      new Set([
        originals.find((r) => r.entitlementId === s.entitlementId)!
          .originalPick!.id,
      ]),
    ])
  );
  for (const step of p.steps) {
    const right = entitlements[step.rightId];
    const controller = p.slots.find(
      (s) => s.entitlementId === step.controllerId
    )!;
    if (
      !right ||
      !['swap_right', 'conveyance_right'].includes(String(right.kind)) ||
      right.seasonYear !== p.year ||
      right.round !== 1
    )
      throw new Error(
        'An ordered claim must retain its source right identity.'
      );
    const controllerPick = originals.find(
      (r) => r.entitlementId === step.controllerId
    )!.originalPick!.id;
    if (
      right.swapControllerPickId &&
      right.swapControllerPickId !== controllerPick
    )
      throw new Error('The source controller and governed selection disagree.');
    const candidates = new Set(
      step.poolIds.flatMap((id) => [...reachable[id]])
    );
    if (
      Array.isArray(right.poolUnderlyingPickIds) &&
      canonicalStringify([...right.poolUnderlyingPickIds].sort()) !==
        canonicalStringify([...candidates].sort())
    )
      throw new Error(
        'The complete source-named pool must remain reachable after all prior claims.'
      );
    if (
      step.rightId !== p.tradedRightId &&
      right.holderTeam !== controller.holderTeam
    )
      throw new Error('A prior or later claim is not owned by its controller.');
    // Every exercise or waiver can exchange the controller with a candidate.
    // Later claims consume those slots, including selections left by prior claims.
    const controllerCandidates = reachable[step.controllerId];
    for (const id of step.poolIds)
      reachable[id] =
        id === step.controllerId
          ? candidates
          : new Set([...reachable[id], ...controllerCandidates]);
  }
  if (
    catalogue.data.unresolved.some(
      (d) =>
        d.entitlementIds.some(
          (id) =>
            p.steps.some((s) => s.rightId === id) ||
            p.slots.some((s) => s.entitlementId === id)
        ) &&
        d.actions.some((a) =>
          ['transfer', 'stepien', 'allocate', 'apron'].includes(a)
        )
    )
  )
    throw new Error('This pool has an unresolved governing dependency.');
  if (entitlements[p.tradedRightId]?.kind !== 'swap_right')
    throw new Error('The transferred asset must be a retained swap right.');
  const controller = p.slots.find(
    (s) =>
      s.entitlementId ===
      p.steps.find((s) => s.rightId === p.tradedRightId)!.controllerId
  )!;
  const holder = entitlements[p.tradedRightId].holderTeam;
  if (
    p.grantorTeam === controller.holderTeam ||
    (holder !== p.grantorTeam && holder !== controller.holderTeam) ||
    (p.result && holder !== controller.holderTeam)
  )
    throw new Error(
      'Swap right ownership conflicts with its grantor and return-selection owner.'
    );
  if (p.result) {
    const expected = resolveSwapProgram(
      { ...p, result: null },
      p.result.positions,
      p.result.elections
    ).result;
    if (canonicalStringify(expected) !== canonicalStringify(p.result))
      throw new Error('Recorded swap result contradicts its complete inputs.');
  }
  for (const s of p.slots)
    if (
      entitlements[s.entitlementId]?.holderTeam !==
      (p.result?.allocation[s.entitlementId] ?? s.holderTeam)
    )
      throw new Error(
        'Underlying selection ownership conflicts with the governed pool.'
      );
  return p;
}
