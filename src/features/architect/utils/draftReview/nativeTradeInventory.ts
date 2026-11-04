/** Full retained-inventory validation for a resolved native selection exchange.
 * Only unchanged, disjoint nonownership representation conflicts may survive.
 * Ownership, protections, relevant claims and every newly introduced conflict
 * remain blocking. Source documents and prior claim receipts are never edited.
 */
import type { DraftClaimProgram } from '@/schemas/draftSwapProgram';
import type {
  NativeDraftLifecycle,
  NativeSelectionTransfer,
} from '@/schemas/draftNativeTrading';
import { nativeSelectionHolders } from './nativeTrading';
import { AUTHORITATIVE_WORLD_TEAM_CODES } from '../leagueTeams';
import {
  validateEntitlementExclusivity,
  type EntitlementDocLike,
} from '../entitlements/entitlementExclusivityValidator';
import { evaluateLeagueClaimUniquenessForMap } from '../entitlements/leagueClaimUniquenessGate';
import { mutationSnapshotText } from '../mutationPipeline.snapshotDigest';
import { canonicalStringify } from '../contractSource/deterministicDigest';

type Entitlement = EntitlementDocLike & { id: string; holderTeam: string };
type Team = { entitlementIds?: unknown };
const same = (a: unknown, b: unknown) =>
  canonicalStringify(a) === canonicalStringify(b);
const sorted = (ids: string[]) => [...ids].sort();
const underliers = (e: Entitlement) =>
  [
    e.underlyingPickId,
    e.swapControllerPickId,
    ...(e.poolUnderlyingPickIds ?? []),
  ].filter((x): x is string => typeof x === 'string');

export function validateNativeTradeInventory(input: {
  program: DraftClaimProgram;
  lifecycle: NativeDraftLifecycle;
  history: NativeSelectionTransfer[];
  next: NativeSelectionTransfer;
  entitlements: Record<string, Record<string, unknown>>;
  teams: Record<string, Team>;
  computed?: {
    entitlementUpdates?: readonly {
      entitlementId?: string;
      holderTeam?: string;
    }[];
    teamUpdates?: readonly { teamCode?: string | null; team?: Team | null }[];
  };
}) {
  const { program, lifecycle, history, next, teams, computed } = input;
  if (program.kind === 'ordered-swap-pool-v1' || !program.result)
    throw new Error('Resolved native lineage is required.');
  if (
    !same(
      sorted(Object.keys(teams)),
      sorted([...AUTHORITATIVE_WORLD_TEAM_CODES])
    )
  )
    throw new Error(
      'Native trade validation requires all thirty team inventories.'
    );
  const before: Record<string, Entitlement> = {};
  for (const [id, e] of Object.entries(input.entitlements)) {
    if (typeof e.id !== 'string' || typeof e.holderTeam !== 'string')
      throw new Error('Retained identity or holder is unavailable.');
    before[id] = { ...e, id: e.id, holderTeam: e.holderTeam };
  }
  const membership = new Set<string>();
  for (const [team, data] of Object.entries(teams)) {
    if (!Array.isArray(data.entitlementIds))
      throw new Error('Complete retained inventory is required.');
    for (const id of data.entitlementIds) {
      if (
        typeof id !== 'string' ||
        membership.has(id) ||
        before[id]?.id !== id ||
        before[id]?.holderTeam !== team
      )
        throw new Error('Retained ownership or inventory is inconsistent.');
      membership.add(id);
    }
  }
  if (membership.size !== Object.keys(before).length)
    throw new Error('A retained identity is absent from team inventory.');
  const current = nativeSelectionHolders(program, history);
  for (const slot of program.slots)
    if (before[slot.entitlementId]?.holderTeam !== current[slot.entitlementId])
      throw new Error('Stale native ownership.');
  const holders = nativeSelectionHolders(program, [...history, next]);
  const post = Object.fromEntries(
    Object.entries(before).map(([id, e]) => [
      id,
      { ...e, holderTeam: holders[id] ?? e.holderTeam },
    ])
  );
  const participants = sorted([
    ...new Set(
      [...next.movements, ...(next.playerMovements ?? [])].flatMap((m) => [
        m.fromTeam,
        m.toTeam,
      ])
    ),
  ]);
  if (computed) {
    if (
      !same(
        sorted(
          (computed.entitlementUpdates ?? []).map(
            (e) => `${e.entitlementId}:${e.holderTeam}`
          )
        ),
        sorted(next.movements.map((m) => `${m.entitlementId}:${m.toTeam}`))
      )
    )
      throw new Error(
        'Computed native movements differ from the reviewed transaction.'
      );
    if (
      !same(
        sorted((computed.teamUpdates ?? []).map((t) => String(t.teamCode))),
        participants
      )
    )
      throw new Error(
        'Computed native trade must update exactly its participating teams.'
      );
    for (const update of computed.teamUpdates ?? []) {
      const expected = sorted(
        Object.values(post)
          .filter((e) => e.holderTeam === update.teamCode)
          .map((e) => e.id)
      );
      if (
        !Array.isArray(update.team?.entitlementIds) ||
        !same(sorted(update.team.entitlementIds), expected)
      )
        throw new Error(
          'Computed native trade changed an untouched inventory identity.'
        );
    }
  }
  const relevantIds = new Set([
    ...program.slots.map((s) => s.entitlementId),
    ...lifecycle.retainedFirstIds,
  ]);
  const relevantUnderliers = new Set<string>();
  for (const id of relevantIds) {
    if (
      !before[id] ||
      before[id].kind !== 'pick_ownership' ||
      !before[id].underlyingPickId
    )
      throw new Error('Native ownership or Stepien input is unavailable.');
    underliers(before[id]).forEach((u) => relevantUnderliers.add(u));
  }
  const resolvedRepresentations = new Set(
    program.kind === 'native-ranked-pool-v1'
      ? program.nativePool.archivalIds
      : program.claims.flatMap((c) => c.representationIds)
  );
  for (const id of resolvedRepresentations)
    if (
      !before[id] ||
      before[id].kind === 'pick_ownership' ||
      relevantIds.has(id)
    )
      throw new Error(
        'Resolved representations cannot replace original ownership.'
      );
  const violations = (state: Record<string, Entitlement>) => {
    const map = Object.fromEntries(
      Object.keys(teams).map((team) => [
        team,
        Object.values(state).filter(
          (e) => e.holderTeam === team && !resolvedRepresentations.has(e.id)
        ),
      ])
    );
    const signatures: string[] = [];
    const check = (kind: string, ids: string[], identity: unknown) => {
      if (
        !ids.length ||
        /OWNERSHIP|PROTECTION/.test(kind) ||
        ids.some(
          (id) =>
            !before[id] ||
            before[id].kind === 'pick_ownership' ||
            relevantIds.has(id) ||
            underliers(before[id]).some((u) => relevantUnderliers.has(u)) ||
            mutationSnapshotText(before[id]) !== mutationSnapshotText(post[id])
        )
      )
        throw new Error(
          'A native selection, retained witness, ownership or protection claim conflicts.'
        );
      signatures.push(canonicalStringify(identity));
    };
    for (const [team, entitlements] of Object.entries(map)) {
      const result = validateEntitlementExclusivity({ entitlements });
      if (!result.valid && !result.violations.length)
        throw new Error('Complete exclusivity results are unavailable.');
      for (const v of result.violations)
        check(v.type, v.entitlementIds, {
          team,
          type: v.type,
          ids: sorted(v.entitlementIds),
          underliers: sorted(v.underlyingPickIds ?? []),
          details: v.details ?? null,
          claimsA: v.claimsA ?? null,
          claimsB: v.claimsB ?? null,
        });
    }
    const league = evaluateLeagueClaimUniquenessForMap({
      context: 'WORLD_TRADE_APPLY',
      entitlementsByTeam: map,
    });
    if (!league.ok) {
      if (
        league.errorType === 'VALIDATION_UNAVAILABLE' ||
        !league.conflicts?.length
      )
        throw new Error('Complete league claim validation is unavailable.');
      for (const c of league.conflicts)
        check(
          c.claimType,
          c.entitlements.map((e) => e.entitlementId),
          {
            type: c.claimType,
            key: c.claimKey,
            teams: sorted(c.teams),
            entries: sorted(
              c.entitlements.map((e) => `${e.teamCode}:${e.entitlementId}`)
            ),
          }
        );
    }
    return signatures.sort();
  };
  if (!same(violations(before), violations(post)))
    throw new Error(
      'The native trade introduces or changes a retained claim conflict.'
    );
  return { valid: true as const };
}
