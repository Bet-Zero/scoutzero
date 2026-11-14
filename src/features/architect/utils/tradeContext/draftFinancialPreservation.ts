import { mutationSnapshotText } from '../mutationPipeline.snapshotDigest';
import { decorateEntitlementForTrade } from '../entitlements/entitlementTerms';
import { toEndYear } from '../seasonFormat';
import { normalizeTradeContextPayload } from './tradeContext.snapshot.payloadNorm';
import type { TradeContextCurrentState, TradeContextPayload } from './types';
import { TeamSalaryBookInputsZ } from '@/schemas/salaryBooks';
import { TradeHardCapLedgerZ } from '@/schemas/tradeApronRestriction';
import { GovernedCashLedgerZ } from '@/schemas/governedCashConsideration';
import { ContractEventLedgerPayloadZ } from '@/schemas/contractEventLedger';
import { EntitlementAssetZ } from '@/schemas/architect';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const only = (value: RecordValue, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));
const empty = (value: unknown) =>
  value === undefined || (Array.isArray(value) && value.length === 0);
const same = (a: unknown, b: unknown) =>
  mutationSnapshotText(a) === mutationSnapshotText(b);

/** Classification of existing future original rights, never a legality result.
 * Inspect ingress before normalization: an unknown/hidden economic term cannot
 * disappear into an assertion that the transaction has no financial effect.
 * Source terms come from the loaded inventory, not the selected year/label.
 */
export function canPreserveDraftTradeFinances(
  payload: TradeContextPayload,
  currentState: TradeContextCurrentState,
  seasonId: string
): boolean {
  if (
    !record(payload) ||
    !only(payload, ['teams', 'capProjections', 'tradeCtx', 'asOfDate'])
  )
    return false;
  const year = toEndYear(seasonId);
  const context = payload.tradeCtx;
  if (
    !year ||
    !record(context) ||
    !only(context, [
      'worldId',
      'source',
      'asOfDate',
      'tradeDate',
      'yearKey',
      'seasonId',
      'offseason',
      'enforceSignAndTradePreflight',
    ])
  )
    return false;
  const date = payload.asOfDate ?? context.asOfDate;
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(date) ||
    !Number.isFinite(Date.parse(date))
  )
    return false;
  if (
    (context.asOfDate != null && context.asOfDate !== date) ||
    (context.tradeDate != null && context.tradeDate !== date) ||
    (context.yearKey != null && toEndYear(context.yearKey) !== year) ||
    (context.seasonId != null && context.seasonId !== seasonId)
  )
    return false;
  if (
    !Array.isArray(payload.teams) ||
    payload.teams.length < 2 ||
    payload.teams.length !== currentState.teams.length
  )
    return false;
  const codes = currentState.teams.map((entry) => entry.teamCode);
  if (
    codes.some(
      (code) => typeof code !== 'string' || !/^[A-Z]{3}$/.test(code)
    ) ||
    new Set(codes).size !== codes.length
  )
    return false;
  const selected = new Set<string>();
  for (const [index, team] of payload.teams.entries()) {
    if (
      !record(team) ||
      !only(team, [
        'teamCode',
        'teamId',
        'sends',
        'receives',
        'picksOut',
        'entitlementsOut',
        'outgoingEntitlements',
        'cashSent',
        'cashReceived',
        'cashToTeamId',
        'salaryMatchingElection',
      ])
    )
      return false;
    const code = codes[index];
    if (
      team.teamCode !== code ||
      (team.teamId != null && team.teamId !== code) ||
      !empty(team.sends) ||
      !empty(team.receives) ||
      !empty(team.picksOut) ||
      (team.cashSent != null && team.cashSent !== 0) ||
      (team.cashReceived != null && team.cashReceived !== 0) ||
      team.cashToTeamId != null ||
      team.salaryMatchingElection != null
    )
      return false;
    if (!Array.isArray(team.entitlementsOut)) return false;
    if (
      team.outgoingEntitlements != null &&
      !same(team.outgoingEntitlements, team.entitlementsOut)
    )
      return false;
    const before = currentState.teams[index].team;
    const inventory = Array.isArray(before.entitlements)
      ? before.entitlements
      : [];
    const membership = Array.isArray(before.entitlementIds)
      ? before.entitlementIds
      : [];
    for (const asset of team.entitlementsOut) {
      if (!record(asset)) return false;
      const id = asset.entitlementId ?? asset.id;
      if (
        typeof id !== 'string' ||
        selected.has(id) ||
        !membership.includes(id)
      )
        return false;
      const matches = inventory.filter(
        (entry) => record(entry) && (entry.entitlementId ?? entry.id) === id
      );
      if (matches.length !== 1) return false;
      const source = matches[0] as RecordValue;
      if (!EntitlementAssetZ.strict().safeParse(source).success) return false;
      const draftYear = source.seasonYear ?? source.year;
      const original =
        typeof source.underlyingPickId === 'string'
          ? /^([A-Z]{3})_(\d{4})_1st$/.exec(source.underlyingPickId)
          : null;
      // CBA2-C02.1 attaches unsigned-first money upon selection. In November,
      // the coming calendar year's original first is necessarily unselected.
      // Same-calendar-year selections keep the existing conservative gate;
      // the full draft review separately enforces the dated trading window.
      if (
        source.kind !== 'pick_ownership' ||
        !original ||
        Number(original[2]) !== draftYear ||
        (source.originalTeam != null && source.originalTeam !== original[1]) ||
        (source.originalTeamId != null &&
          source.originalTeamId !== original[1]) ||
        source.holderTeam !== code ||
        (source.underlyingStatus != null &&
          source.underlyingStatus !== 'clean') ||
        !empty(source.protectionLadder) ||
        !empty(source.poolUnderlyingPickIds) ||
        !empty(source.linkedEntitlementIds) ||
        !empty(source.coveredByEntitlementIds) ||
        source.swapControllerPickId != null ||
        source.swapTargetDefinition != null ||
        source.swapType != null ||
        source.residualOfEntitlementId != null ||
        !empty(source.receivesRank) ||
        source.receivesComparator != null ||
        !Number.isInteger(draftYear) ||
        Number(draftYear) < year ||
        (Number(draftYear) === year && Number(date.slice(0, 4)) >= year) ||
        source.round !== 1
      )
        return false;
      const decorated = decorateEntitlementForTrade(source)!;
      const expected = {
        ...decorated,
        id,
        entitlementId: id,
        year: draftYear,
        seasonYear: draftYear,
        fromTeamId: code,
      } as RecordValue;
      for (const [key, value] of Object.entries(asset)) {
        if (key === 'toTeamId') continue;
        // The shared payload normalizer carries only terms.round. Raw UI
        // selections carry the complete decoration; both must agree with the
        // loaded right, and neither can add a new term.
        if (key === 'terms' && record(value) && record(expected.terms)) {
          const sourceTerms = expected.terms;
          if (
            !Object.entries(value).every(
              ([term, entry]) =>
                term in sourceTerms && same(entry, sourceTerms[term])
            )
          )
            return false;
          continue;
        }
        if (!(key in expected) || !same(value, expected[key])) return false;
      }
      const target =
        asset.toTeamId ?? (codes.length === 2 ? codes[1 - index] : null);
      if (!target || target === code || !codes.includes(String(target)))
        return false;
      selected.add(id);
    }
  }
  return selected.size > 0;
}

// Compare every non-draft field, including fields added in future schemas.
// Continued absence is preserved, never interpreted as a zero or compliance.
export function draftFinancialState(team: RecordValue): RecordValue {
  const { entitlementIds: _ids, source: _source, ...financial } = team;
  if (record(_source)) {
    const { type: _type, lastModifiedAt: _modified, ...provenance } = _source;
    if (Object.keys(provenance).length) financial.source = provenance;
  } else if (_source != null) {
    financial.source = _source;
  }
  return financial;
}

export function preserveDraftFinancialState<T extends RecordValue>(
  before: T,
  proposed: T
): T {
  const result: RecordValue = { ...before };
  for (const key of ['entitlementIds', 'source'] as const) {
    if (Object.hasOwn(proposed, key)) result[key] = proposed[key];
  }
  return result as T;
}

/** Schema compatibility is necessary, never sufficient source qualification.
 * Unknown inputs may remain unknown; malformed supplied ledgers cannot become
 * harmless merely because their bytes were preserved.
 */
export function assertDraftFinancialInputsWellFormed(
  state: TradeContextCurrentState,
  season: string
) {
  for (const { team } of state.teams) {
    if (team.salaryBookInputs != null) {
      const books = TeamSalaryBookInputsZ.parse(team.salaryBookInputs);
      if (books.salaryCapYear !== toEndYear(season))
        throw new Error(
          'Draft financial books have a different Salary Cap Year.'
        );
    }
    if (team.hardCapLedger != null)
      TradeHardCapLedgerZ.parse(team.hardCapLedger);
    if (team.cashLedger != null) GovernedCashLedgerZ.parse(team.cashLedger);
    if (team.contractEventLedgers != null) {
      if (!Array.isArray(team.contractEventLedgers))
        throw new Error('Draft financial Contract history is malformed.');
      team.contractEventLedgers.forEach((ledger) =>
        ContractEventLedgerPayloadZ.parse(ledger)
      );
    }
  }
}

// Only the live shared snapshot builder can retain this result. It cannot be
// serialized, supplied as a payload flag, copied to a branch, or replayed after
// state/proposal changes. Atomic persistence still performs its existing reads.
const prepared = new WeakMap<
  object,
  { before: string; proposal: string; season: string; asOf: string }
>();

function datedPreservationPayload(
  payload: TradeContextPayload,
  fallbackDate?: string
): TradeContextPayload {
  const asOfDate =
    payload.asOfDate ?? payload.tradeCtx?.asOfDate ?? fallbackDate;
  return {
    ...payload,
    asOfDate,
    tradeCtx: {
      ...payload.tradeCtx,
      asOfDate: payload.tradeCtx?.asOfDate ?? asOfDate,
    },
  };
}
export function retainDraftFinancialPreservation(
  snapshot: object,
  payload: TradeContextPayload,
  state: TradeContextCurrentState,
  season: string
) {
  if (canPreserveDraftTradeFinances(payload, state, season))
    prepared.set(snapshot, {
      before: mutationSnapshotText(state),
      proposal: mutationSnapshotText(
        normalizeTradeContextPayload(datedPreservationPayload(payload))
      ),
      season,
      asOf: String(payload.asOfDate ?? payload.tradeCtx?.asOfDate),
    });
}

export function hasDraftFinancialPreservation(
  snapshot: object,
  payload: TradeContextPayload,
  state: TradeContextCurrentState,
  season: string
): boolean {
  const retained = prepared.get(snapshot);
  if (!retained) return false;
  // Preparation accepts the governed world date separately. Use that same
  // retained date when compute receives the original payload; a supplied date
  // still has to agree. Raw fields remain visible to the classifier.
  const datedPayload = datedPreservationPayload(payload, retained.asOf);
  if (
    !canPreserveDraftTradeFinances(datedPayload, state, season) ||
    retained.before !== mutationSnapshotText(state) ||
    retained.proposal !==
      mutationSnapshotText(normalizeTradeContextPayload(datedPayload)) ||
    retained.season !== season
  ) {
    throw new Error(
      'Draft financial preservation is stale. Rebuild the trade from current state.'
    );
  }
  return true;
}

export function assertDraftFinancialStateUnchanged(
  before: RecordValue,
  after: RecordValue
) {
  if (!same(draftFinancialState(before), draftFinancialState(after))) {
    throw new Error(
      'A draft-only trade changed financial state. Apply is blocked.'
    );
  }
}
