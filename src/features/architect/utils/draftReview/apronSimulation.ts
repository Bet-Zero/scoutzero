import { softwareSeasonRegistry } from '../governedSeason/softwareSeasonContext';
import {
  CANON_GOVERNED_SEASON_REGISTRY,
  resolveGovernedSeasonEnvelope,
} from '../governedSeason';
/** Committed, consecutive software chronology composed with accepted Apron rules. */
import {
  DraftApronSimulationPlanZ,
  DraftApronHistoryZ,
  DraftApronSeasonReceiptZ,
  type DraftApronHistory,
  type DraftApronSimulationPlan,
} from '@/schemas/draftApronSimulation';
import type { DraftApronInput } from '@/schemas/draftApron';
import {
  evaluateDraftApronLifecycle,
  evaluateDraftApronObservation,
} from '../draftApronMechanisms';
import { AUTHORITATIVE_WORLD_TEAM_CODES } from '../leagueTeams';
import { canonicalStringify } from '../contractSource/deterministicDigest';
import { mutationSnapshotDigest } from '../mutationPipeline.snapshotDigest';
import { reviewSimulationDraftWindow } from './horizon';

const same = (a: unknown, b: unknown) =>
  canonicalStringify(a) === canonicalStringify(b);
export const apronSeason = (start: number) =>
  `${start}-${String(start + 1).slice(-2)}`;
export const apronTransitionId = (start: number) =>
  `seasonAdvance__${apronSeason(start)}__${apronSeason(start + 1)}`;
const codes = [...AUTHORITATIVE_WORLD_TEAM_CODES].sort();

export function readApronSimulation(metadata: Record<string, unknown>) {
  if (metadata.draftSimulationBranches !== 'apron-lifecycle')
    throw new Error('This world has no governed apron lifecycle.');
  const plan = DraftApronSimulationPlanZ.parse(metadata.draftApronPlan);
  const history = DraftApronHistoryZ.parse(metadata.draftApronHistory);
  const start = Number(plan.startingSeason.slice(0, 4));
  const software = plan.kind === 'governed-apron-lifecycle-v2';
  if (
    plan.startingSeason !== apronSeason(start) ||
    (!software &&
      (start !== 2025 ||
        plan.steps.length !== 1 ||
        plan.seasons ||
        plan.softwareRetainedFirsts)) ||
    (software &&
      (!plan.seasons ||
        plan.seasons.length !== plan.steps.length + 1 ||
        plan.seasons.some((c, i) => c.salaryCapYear !== start + 1 + i)))
  )
    throw new Error(
      'Complete consecutive software financial seasons are required.'
    );
  const witnesses = plan.softwareRetainedFirsts ?? [];
  if (
    new Set(witnesses.map((w) => `${w.team}:${w.draftYear}`)).size !==
      witnesses.length ||
    witnesses.some(
      (w) =>
        !codes.some((code) => code === w.team) ||
        w.draftYear <= start + 8 ||
        w.draftYear > start + 7 + plan.steps.length
    )
  )
    throw new Error(
      'Software retained witnesses require unique teams and bounded future years.'
    );
  const registry = software
    ? softwareSeasonRegistry(plan.seasons!)
    : CANON_GOVERNED_SEASON_REGISTRY;
  if (
    history.length > plan.steps.length ||
    metadata.currentSeason !== apronSeason(start + history.length) ||
    metadata.asOfDate !==
      (history.length
        ? `${start + history.length}-07-01`
        : plan.steps[0].regularSeasonEnd.date)
  )
    throw new Error('The saved season and consecutive apron history disagree.');
  for (const [index, step] of plan.steps.entries()) {
    const year = start + index;
    const effectiveAt = `${year + 1}-07-01T00:00:00-04:00`;
    if (
      step.seasonStartYear !== year ||
      step.regularSeasonEnd.seasonStartYear !== year ||
      !same(step.observations.map((o) => o.team).sort(), codes) ||
      !same(Object.keys(step.targetBooks).sort(), codes) ||
      step.tradingWindow.asOf !== effectiveAt ||
      step.tradingWindow.firstYear !== year + 2 ||
      reviewSimulationDraftWindow(step.tradingWindow, effectiveAt, [year + 2])
        .status !== 'permits'
    )
      throw new Error(
        'Complete consecutive test seasons and dated draft windows are required.'
      );
    const sourceSeason = registry.calendars.find(
      (c) => c.salaryCapYear === year + 1
    );
    const envelope = resolveGovernedSeasonEnvelope({
      salaryCapYear: year + 1,
      asOfDate: `${step.regularSeasonEnd.date}T19:00:00-04:00`,
      team: { teamId: 'league' },
      registry,
      requiredAuthority: software ? 'software-test' : 'official',
    });
    if (envelope.status !== 'complete' || !sourceSeason)
      throw new Error(
        'The observed season requires complete governed financial inputs.'
      );
    const close = step.regularSeasonEnd;
    const nextDate = new Date(Date.parse(`${close.date}T12:00:00Z`) + 86400000)
      .toISOString()
      .slice(0, 10);
    if (
      !close.date.startsWith(`${year + 1}-`) ||
      close.dayAfterStartsAt !== `${nextDate}T00:00:00-04:00` ||
      Date.parse(close.dayAfterStartsAt) >= Date.parse(effectiveAt) ||
      close.date !== sourceSeason.regularSeasonClosing.value
    )
      throw new Error('The consecutive regular-season calendars disagree.');
    for (const observation of step.observations) {
      const books = step.targetBooks[observation.team];
      const measurement = books.seasonCloseApronMeasurement;
      if (
        observation.seasonStartYear !== year ||
        books.salaryCapYear !== year + 2 ||
        (software &&
          !same(books.softwareSeasonContext, plan.seasons![index + 1])) ||
        !measurement ||
        measurement.teamCode !== observation.team ||
        measurement.seasonKey !== apronSeason(year) ||
        measurement.salaryCapYear !== year + 1 ||
        measurement.regularSeasonClosing !== step.regularSeasonEnd.date ||
        !observation.value ||
        !observation.value.lastRegularSeasonGameStart.startsWith(
          `${year + 1}-`
        ) ||
        observation.value.lastRegularSeasonGameStart.slice(0, 10) >
          close.date ||
        Math.round(measurement.apronTeamSalary * 100) !==
          observation.value.apronTeamSalaryCents ||
        measurement.measuredAt !== observation.value.measuredAt ||
        Date.parse(measurement.source.authenticatedAt) >
          Date.parse(effectiveAt) ||
        evaluateDraftApronObservation(observation, effectiveAt).status !==
          'known'
      )
        throw new Error(
          'Complete matching last-game financial observations are required.'
        );
      const threshold = envelope.systemLevels['second-apron'].amount!;
      if (observation.value.secondApronCents !== Math.round(threshold * 100))
        throw new Error(
          'The observation and governed annual Second Apron disagree.'
        );
    }
    if (
      index < history.length &&
      !same(history[index], observationForStep(step))
    )
      throw new Error(
        'Saved apron history differs from its consumed season inputs.'
      );
  }
  for (let year = start + 1; year <= start + 4; year++) {
    const future = plan.futureObservations.filter(
      (o) => o.seasonStartYear === year
    );
    if (
      !same(future.map((o) => o.team).sort(), codes) ||
      future.some(
        (o) =>
          o.state !== 'future-pending' ||
          o.sourceResultId !== null ||
          o.value !== null ||
          evaluateDraftApronObservation(o, plan.steps[0].tradingWindow.asOf)
            .status !== 'future-pending'
      )
    )
      throw new Error(
        'All four subsequent seasons must remain explicitly future pending.'
      );
  }
  return {
    plan,
    registry,
    history,
    planDigest: mutationSnapshotDigest(plan),
    next: plan.steps[history.length] ?? null,
  };
}

export function observationForStep(
  step: ReturnType<typeof DraftApronSimulationPlanZ.parse>['steps'][number]
) {
  return {
    seasonStartYear: step.seasonStartYear,
    regularSeasonEnd: step.regularSeasonEnd,
    observations: step.observations,
    transitionId: apronTransitionId(step.seasonStartYear),
  };
}

export function apronInputFromHistory(
  team: string,
  draftYear: number,
  history: DraftApronHistory,
  asOf: string,
  plan: DraftApronSimulationPlan
): DraftApronInput {
  const trigger = draftYear - 8;
  const observations = history
    .filter(
      (h) => h.seasonStartYear >= trigger && h.seasonStartYear <= trigger + 4
    )
    .flatMap((h) => h.observations.filter((o) => o.team === team));
  // A future pending row is calendar information, not an observation or result.
  for (let year = trigger; year <= trigger + 4; year++) {
    if (observations.some((o) => o.seasonStartYear === year)) continue;
    const future = plan.futureObservations.find(
      (o) => o.seasonStartYear === year && o.team === team
    );
    const pendingUntil = future?.pendingUntil;
    if (!pendingUntil) continue;
    if (Date.parse(pendingUntil) > Date.parse(asOf))
      observations.push({
        ...future!,
      });
  }
  return {
    team,
    triggerSeasonStartYear: trigger,
    originalPick: {
      id: `${team}_${draftYear}_1st`,
      originalTeam: team,
      draftYear,
      round: 1,
    },
    asOf,
    observations,
    regularSeasonEnds: history
      .filter(
        (h) => h.seasonStartYear >= trigger && h.seasonStartYear <= trigger + 4
      )
      .map((h) => h.regularSeasonEnd),
  };
}

export function apronRestrictionText(input: DraftApronInput) {
  const result = evaluateDraftApronLifecycle(input);
  if (result.penalized.status === 'known' && result.penalized.value)
    return 'Frozen · penalty eligible; final draft placement pending';
  if (result.unfrozen.status === 'known' && result.unfrozen.value)
    return 'Released · no draft-pick penalty';
  if (result.frozen.status === 'known')
    return result.frozen.value
      ? 'Frozen · later-season review pending'
      : 'No freeze triggered';
  return 'Restriction history incomplete · trading unavailable';
}

/** Reject inconsistent receipt projections before History or Compare displays permission. */
export function readApronSeasonReceipt(value: unknown) {
  const parsed = DraftApronSeasonReceiptZ.safeParse(value);
  if (!parsed.success) return null;
  const r = parsed.data;
  if (
    r.after.length !== r.before.length + 1 ||
    !same(r.after.slice(0, -1), r.before) ||
    !same(r.restrictions.map((x) => x.team).sort(), codes)
  )
    return null;
  for (const [index, entry] of r.after.entries()) {
    if (
      entry.seasonStartYear !== r.after[0].seasonStartYear + index ||
      entry.transitionId !==
        apronTransitionId(r.after[0].seasonStartYear + index) ||
      entry.regularSeasonEnd.seasonStartYear !== entry.seasonStartYear ||
      !same(entry.observations.map((o) => o.team).sort(), codes)
    )
      return null;
  }
  const start = r.after[0].seasonStartYear;
  const asOf = `${start + r.after.length}-07-01T00:00:00-04:00`;
  for (const input of r.restrictions) {
    const observed = r.after.flatMap((h) =>
      h.observations.filter((o) => o.team === input.team)
    );
    if (
      input.triggerSeasonStartYear !== start ||
      input.asOf !== asOf ||
      !same(input.originalPick, {
        id: `${input.team}_${start + 8}_1st`,
        originalTeam: input.team,
        draftYear: start + 8,
        round: 1,
      }) ||
      !same(
        input.regularSeasonEnds,
        r.after.map((h) => h.regularSeasonEnd)
      ) ||
      !same(input.observations.slice(0, observed.length), observed) ||
      observed.some(
        (o) =>
          o.seasonStartYear < start ||
          o.seasonStartYear >= start + r.after.length ||
          evaluateDraftApronObservation(o, asOf).status !== 'known'
      ) ||
      input.observations
        .slice(observed.length)
        .some(
          (o) =>
            o.team !== input.team ||
            o.seasonStartYear < start + r.after.length ||
            o.state !== 'future-pending' ||
            o.value !== null ||
            !o.pendingUntil ||
            Date.parse(o.pendingUntil) <= Date.parse(asOf)
        )
    )
      return null;
  }
  return r;
}
