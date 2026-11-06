import { requireNoncashTradeRoutes } from './transactionRouting';
import {
  NativeDraftLifecycleZ,
  NativeSelectionTransfersZ,
  NativeOriginalSelectionsZ,
  type NativeOriginalSelection,
} from '@/schemas/draftNativeTrading';
import type { DraftClaimProgram } from '@/schemas/draftSwapProgram';
import { reviewSimulationDraftWindow } from './horizon';
import { canonicalStringify } from '../contractSource/deterministicDigest';

/** Family scope only. The world loader separately authenticates active terms. */
export function isNativeSelectionTradeAdmitted(program: DraftClaimProgram) {
  return (
    (program.kind === 'native-ranked-pool-v1' && program.year === 2029) ||
    (program.kind === 'native-overlapping-pool-v1' && program.year === 2028)
  );
}
export function requireNativeSelectionTradeAdmission(
  program: DraftClaimProgram
) {
  if (!isNativeSelectionTradeAdmitted(program))
    throw new Error(
      'Subsequent trading is not yet admitted for this native family.'
    );
}

export function nativeLifecycle(input: unknown, year: number) {
  const lifecycle = NativeDraftLifecycleZ.parse(input);
  const { tradingWindow: window, claimsEffectiveDate: effective } = lifecycle;
  if (
    window.firstYear !== year ||
    window.asOf.slice(0, 10) !== effective ||
    !effective.startsWith(`${year}-06-`) ||
    effective >= window.firstFutureDraftStartsAt.slice(0, 10) ||
    reviewSimulationDraftWindow(window, window.asOf, [year]).status !==
      'permits' ||
    new Set(lifecycle.retainedFirstIds).size !==
      lifecycle.retainedFirstIds.length ||
    new Set(
      lifecycle.softwareRetainedFirsts.map((w) => `${w.team}:${w.draftYear}`)
    ).size !== lifecycle.softwareRetainedFirsts.length ||
    (lifecycle.originalSelections ?? []).some(
      (s) =>
        !lifecycle.retainedFirstIds.includes(s.entitlementId) ||
        s.year < window.firstYear ||
        s.year > window.lastYear
    )
  )
    throw new Error(
      'Complete pre-draft claim-effective dates and distinct retained witnesses are required.'
    );
  return lifecycle;
}

/** Replay ownership only; never change the initial claim result or its positions. */
export function nativeSelectionHolders(
  program: DraftClaimProgram,
  history: unknown = [],
  originalSelections?: NativeOriginalSelection[]
) {
  if (program.kind === 'ordered-swap-pool-v1' || !program.result)
    throw new Error(
      'Resolve the complete native claim before trading its selections.'
    );
  const transfers = NativeSelectionTransfersZ.parse(history);
  const originals = nativeOriginalSelections(program, originalSelections);
  const holders = {
    ...program.result.allocation,
    ...Object.fromEntries(
      originals.map((s) => [s.entitlementId, s.holderTeam])
    ),
  };
  const seen = new Set<string>();
  let lastDate = '';
  for (const transfer of transfers) {
    if (seen.has(transfer.operationId) || transfer.asOfDate < lastDate)
      throw new Error('Native selection history is duplicated or backdated.');
    seen.add(transfer.operationId);
    lastDate = transfer.asOfDate;
    const ids = new Set<string>();
    const players = transfer.playerMovements ?? [];
    if (
      players.length &&
      (program.kind !== 'native-overlapping-pool-v1' || program.year !== 2028)
    )
      throw new Error('Mixed native trades require the admitted 2028 family.');
    if (
      new Set(players.map((p) => p.playerId)).size !== players.length ||
      new Set(players.map((p) => p.contractId)).size !== players.length ||
      players.some((p) => p.fromTeam === p.toTeam)
    )
      throw new Error(
        'Mixed native trades require distinct ordinary Contracts and explicit destinations.'
      );
    const consideration = [...transfer.movements, ...players];
    const parties = new Set(
      consideration.flatMap((m) => [m.fromTeam, m.toTeam])
    );
    requireNoncashTradeRoutes([...parties], consideration);
    for (const move of transfer.movements) {
      const slot = [
        ...program.slots.map((s) => ({ ...s, year: program.year })),
        ...originals,
      ].find((s) => s.entitlementId === move.entitlementId);
      if (
        !slot ||
        move.originalTeam !== slot.originalTeam ||
        move.year !== slot.year ||
        ids.has(move.entitlementId) ||
        move.fromTeam === move.toTeam ||
        holders[move.entitlementId] !== move.fromTeam
      )
        throw new Error(
          'Native selection transfer conflicts with its original identity or current owner.'
        );
      ids.add(move.entitlementId);
      holders[move.entitlementId] = move.toTeam;
    }
  }
  return holders;
}

/** This adds no claims to the native pool and never alters its allocation. */
export function nativeOriginalSelections(
  program: DraftClaimProgram,
  input?: NativeOriginalSelection[]
) {
  const originals =
    input === undefined ? [] : NativeOriginalSelectionsZ.parse(input);
  const ids = originals.map((s) => s.entitlementId);
  const picks = originals.map((s) => `${s.originalTeam}_${s.year}_1st`);
  if (
    new Set(ids).size !== ids.length ||
    new Set(picks).size !== picks.length ||
    originals.some((s) =>
      program.slots.some(
        (p) =>
          p.entitlementId === s.entitlementId ||
          (p.originalTeam === s.originalTeam && program.year === s.year)
      )
    )
  )
    throw new Error(
      'Independent original selections must be distinct from every native pool claim.'
    );
  return originals;
}

export function nativeTradeDate(
  program: DraftClaimProgram,
  input: unknown,
  history: unknown,
  asOfDate: unknown
) {
  const lifecycle = nativeLifecycle(input, program.year);
  const transfers = NativeSelectionTransfersZ.parse(history);
  if (
    typeof asOfDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate) ||
    asOfDate < lifecycle.claimsEffectiveDate ||
    asOfDate >= lifecycle.tradingWindow.firstFutureDraftStartsAt.slice(0, 10) ||
    transfers.some(
      (t) => t.asOfDate < lifecycle.claimsEffectiveDate || t.asOfDate > asOfDate
    )
  )
    throw new Error(
      'Trade only after claim resolution and before the draft begins; consumed or backdated selections are unavailable.'
    );
  return { ...lifecycle.tradingWindow, asOf: `${asOfDate}T12:00:00Z` };
}

export function nativeFamilyTeams(program: DraftClaimProgram) {
  return [
    ...new Set([
      ...program.slots.flatMap((s) => [s.originalTeam, s.holderTeam]),
      ...Object.values(program.result?.allocation ?? {}),
    ]),
  ];
}

export function requireSameNativeValue(
  a: unknown,
  b: unknown,
  message: string
) {
  if (canonicalStringify(a) !== canonicalStringify(b)) throw new Error(message);
}

/** Only explicitly supplied, unobligated retained witnesses can support Stepien.
 * Native pool originals use their fully resolved allocation. Unknown holdings stay unknown.
 */
export function nativeRetainedWitnesses(
  program: DraftClaimProgram,
  lifecycle: ReturnType<typeof nativeLifecycle>,
  catalogue: import('./simulationInventory').SimulationCatalogue,
  entitlements: Record<string, Record<string, unknown>>
) {
  const independent = nativeOriginalSelections(
    program,
    lifecycle.originalSelections
  );
  const ids = new Set([
    ...lifecycle.retainedFirstIds,
    ...program.slots.map((s) => s.entitlementId),
  ]);
  const originals = catalogue.data.records.filter((r) =>
    ids.has(r.entitlementId)
  );
  const through = Math.max(
    ...catalogue.data.records.map((r) => r.originalPick?.draftYear ?? 0)
  );
  if (
    originals.length !== ids.size ||
    independent.some(
      (s) => !lifecycle.retainedFirstIds.includes(s.entitlementId)
    ) ||
    originals.some((r) => !r.originalPick || r.role !== 'original') ||
    lifecycle.softwareRetainedFirsts.some(
      (w) =>
        w.draftYear <= through || w.draftYear > lifecycle.tradingWindow.lastYear
    )
  )
    throw new Error(
      'Stepien witnesses must keep retained originals separate from beyond-catalogue software holdings.'
    );
  for (const row of originals) {
    if (program.slots.some((s) => s.entitlementId === row.entitlementId))
      continue;
    const e = entitlements[row.entitlementId];
    const pick = row.originalPick!;
    const admitted = independent.find(
      (s) => s.entitlementId === row.entitlementId
    );
    if (
      admitted &&
      (admitted.originalTeam !== pick.originalTeam ||
        admitted.year !== pick.draftYear)
    )
      throw new Error(
        'Independent selection differs from its retained original identity.'
      );
    if (
      !e ||
      e.kind !== 'pick_ownership' ||
      e.underlyingStatus === 'encumbered' ||
      (Array.isArray(e.protectionLadder) && e.protectionLadder.length) ||
      catalogue.data.unresolved.some((d) =>
        d.entitlementIds.includes(row.entitlementId)
      ) ||
      Object.values(entitlements).some(
        (other) =>
          other.kind !== 'pick_ownership' &&
          (other.swapControllerPickId === pick.id ||
            (Array.isArray(other.poolUnderlyingPickIds) &&
              other.poolUnderlyingPickIds.includes(pick.id)))
      )
    )
      throw new Error(
        'A retained Stepien witness has unresolved or competing claims.'
      );
  }
  return originals;
}
