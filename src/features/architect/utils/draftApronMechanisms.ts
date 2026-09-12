/** Isolated components only. A released restriction is never a trading verdict. */
import {
  DraftApronInputZ,
  DraftApronObservationZ,
  type DraftApronInput,
  type DraftApronObservation,
} from '@/schemas/draftApron';
import { DraftEvidenceInstantZ } from '@/schemas/draftPickEvidence';

export const DRAFT_APRON_CANON = {
  candidate: '6cf8aaf358c158a88e630e8a7336f7e9c3febc17',
  sha256: '23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76',
} as const;

type Component<T> =
  | { status: 'known'; value: T; sourceResultIds: string[]; leaf: string }
  | { status: 'blocked'; reason: string; leaf: string }
  | { status: 'future-pending'; alternatives: string[]; leaf: string }
  | { status: 'non-applicable'; reason: string; leaf: string };
const blocked = (leaf: string, reason: string): Component<never> => ({
  status: 'blocked',
  reason,
  leaf,
});
const known = <T>(
  leaf: string,
  value: T,
  sourceResultIds: string[]
): Component<T> => ({ status: 'known', value, sourceResultIds, leaf });
const qualified = (sources: DraftApronObservation['sources']) =>
  sources.length > 0 &&
  sources.every(
    (s) =>
      s.qualification === 'qualified' &&
      s.review.status === 'accepted' &&
      s.review.limitations.length === 0
  );

/** L08.1 / A12.4: exact last-game-start measurement, independent Apron ledger. */
export function evaluateDraftApronObservation(
  input: unknown,
  asOf: string
): Component<boolean> {
  const leaf = 'CBA2-A12.4';
  const parsed = DraftApronObservationZ.safeParse(input);
  if (!parsed.success || !DraftEvidenceInstantZ.safeParse(asOf).success)
    return blocked(leaf, 'missing-or-invalid-observation');
  const row = parsed.data;
  if (row.state === 'future-pending') {
    if (
      row.value ||
      !row.pendingUntil ||
      Date.parse(row.pendingUntil) <= Date.parse(asOf) ||
      Number(row.pendingUntil.slice(0, 4)) !== row.seasonStartYear + 1 ||
      !qualified(row.sources)
    ) {
      return blocked(leaf, 'future-event-not-established');
    }
    return {
      status: 'future-pending',
      alternatives: ['above', 'at-or-below'],
      leaf,
    };
  }
  if (
    row.state !== 'supported' ||
    !row.value ||
    !row.sourceResultId ||
    !qualified(row.sources)
  ) {
    return blocked(leaf, `observation-${row.state}-or-unqualified`);
  }
  const v = row.value;
  if (Number(v.measuredAt.slice(0, 4)) !== row.seasonStartYear + 1)
    return blocked(leaf, 'wrong-measurement-season');
  if (Date.parse(v.measuredAt) !== Date.parse(v.lastRegularSeasonGameStart))
    return blocked(leaf, 'wrong-measurement-event');
  if (Date.parse(v.measuredAt) > Date.parse(asOf))
    return blocked(leaf, 'observation-not-yet-effective');
  return known(leaf, v.apronTeamSalaryCents > v.secondApronCents, [
    row.sourceResultId,
  ]);
}

function parse(input: unknown) {
  const result = DraftApronInputZ.safeParse(input);
  if (!result.success) return null;
  const d = result.data;
  if (
    d.originalPick.originalTeam !== d.team ||
    d.originalPick.draftYear !== d.triggerSeasonStartYear + 8 ||
    new Set(d.observations.map((o) => o.seasonStartYear)).size !==
      d.observations.length ||
    d.observations.some(
      (o) =>
        o.team !== d.team ||
        o.seasonStartYear < d.triggerSeasonStartYear ||
        o.seasonStartYear > d.triggerSeasonStartYear + 4
    ) ||
    new Set(d.regularSeasonEnds.map((s) => s.seasonStartYear)).size !==
      d.regularSeasonEnds.length
  )
    return null;
  return d;
}

function freeze(d: DraftApronInput): Component<boolean> {
  const leaf = 'CBA2-A12.4';
  if (d.triggerSeasonStartYear < 2024)
    return { status: 'non-applicable', reason: 'rule-begins-2024-25', leaf };
  return evaluateDraftApronObservation(
    d.observations.find((o) => o.seasonStartYear === d.triggerSeasonStartYear),
    d.asOf
  );
}

export function evaluateDraftApronFreeze(input: unknown): Component<boolean> {
  const d = parse(input);
  return d ? freeze(d) : blocked('CBA2-A12.4', 'invalid-or-conflicting-input');
}

/** A12.5: uses the governed next-day boundary, not a team game's ending instant. */
function releaseBoundary(d: DraftApronInput, season: number): string | null {
  const end = d.regularSeasonEnds.find((s) => s.seasonStartYear === season);
  if (!end || !qualified(end.sources)) return null;
  const nextDate = new Date(Date.parse(`${end.date}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  if (
    !end.dayAfterStartsAt.startsWith(`${nextDate}T00:00:00`) ||
    !/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      end.dayAfterStartsAt
    )
  )
    return null;
  const observation = d.observations.find((o) => o.seasonStartYear === season);
  if (
    !observation?.value ||
    Date.parse(observation.value.measuredAt) >= Date.parse(end.dayAfterStartsAt)
  )
    return null;
  return end.dayAfterStartsAt;
}

/** L08.7 / A12.5 / A12.7: no ordering or final-slot calculation. */
export function evaluateDraftApronLifecycle(input: unknown) {
  const unavailable = (reason: string) => ({
    frozen: blocked('CBA2-A12.4', reason),
    unfrozen: blocked('CBA2-A12.5', reason),
    penalized: blocked('CBA2-L08.7', reason),
    noPenalty: blocked('CBA2-A12.7', reason),
  });
  const d = parse(input);
  const placement = blocked(
    'CBA2-L08.8',
    'placement-not-implemented-requires-governed-order'
  );
  const owned = blocked(
    'CBA2-L09.4',
    'ownership-is-an-independent-required-input'
  );
  if (!d)
    return {
      ...unavailable('invalid-or-conflicting-input'),
      freezeTriggered: blocked('CBA2-A12.4', 'invalid-or-conflicting-input'),
      owned,
      placement,
    };
  const trigger = freeze(d);
  const result = {
    ...unavailable('follow-up-history-required'),
    freezeTriggered: trigger,
    owned,
    placement,
  };
  if (trigger.status === 'non-applicable')
    return {
      ...result,
      frozen: trigger,
      unfrozen: trigger,
      penalized: trigger,
      noPenalty: trigger,
    };
  if (trigger.status !== 'known') return result;
  if (!trigger.value) return { ...result, frozen: trigger };
  const history = Array.from({ length: 4 }, (_, i) => {
    const year = d.triggerSeasonStartYear + i + 1;
    return {
      year,
      result: evaluateDraftApronObservation(
        d.observations.find((o) => o.seasonStartYear === year),
        d.asOf
      ),
    };
  });
  if (history.some((h) => h.result.status === 'blocked')) return result;
  if (
    history.some(
      (h, i) =>
        h.result.status === 'future-pending' &&
        history.slice(i + 1).some((later) => later.result.status === 'known')
    )
  )
    return result;
  const knownHistory = history.filter((h) => h.result.status === 'known');
  const above = knownHistory.filter(
    (h) => h.result.status === 'known' && h.result.value
  );
  const below = knownHistory.filter(
    (h) => h.result.status === 'known' && !h.result.value
  );
  const refs = [trigger, ...knownHistory.map((h) => h.result)].flatMap((r) =>
    r.status === 'known' ? r.sourceResultIds : []
  );
  if (above.length >= 2) {
    return {
      ...result,
      frozen: known('CBA2-A12.4', true, refs),
      unfrozen: known('CBA2-A12.5', false, refs),
      penalized: known('CBA2-L08.7', true, refs),
      noPenalty: known('CBA2-A12.7', false, refs),
    };
  }
  if (below.length >= 3) {
    const boundary = releaseBoundary(d, below[2].year);
    if (!boundary)
      return {
        ...result,
        unfrozen: blocked('CBA2-A12.5', 'missing-or-conflicting-season-end'),
      };
    const released = Date.parse(d.asOf) >= Date.parse(boundary);
    return {
      ...result,
      frozen: known('CBA2-A12.4', !released, refs),
      unfrozen: known('CBA2-A12.5', released, refs),
      penalized: released
        ? known('CBA2-L08.7', false, refs)
        : blocked('CBA2-L08.7', 'release-not-yet-effective'),
      noPenalty: known('CBA2-A12.7', released, refs),
      releaseEffectiveAt: boundary,
    };
  }
  return {
    ...result,
    frozen: known('CBA2-A12.4', true, refs),
    unfrozen: {
      status: 'future-pending' as const,
      alternatives: ['release-after-third-at-or-below', 'remain-frozen'],
      leaf: 'CBA2-A12.5',
    },
    penalized: {
      status: 'future-pending' as const,
      alternatives: ['penalty-after-two-above', 'no-penalty-after-release'],
      leaf: 'CBA2-L08.7',
    },
  };
}
