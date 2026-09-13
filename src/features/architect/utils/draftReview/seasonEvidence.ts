/** L08.3 stores the accepted A12.4 result; it owns no freeze algorithm. */
import {
  SyntheticDraftSeasonSourceZ,
  DraftReviewFreezeEventZ,
} from '@/schemas/draftReviewSeason';
import { evaluateDraftApronFreeze } from '@/features/architect/utils/draftApronMechanisms';
import { canonicalStringify } from '@/features/architect/utils/contractSource/deterministicDigest';

export function buildSyntheticFreezeEvents(args: {
  source: unknown;
  measurements: Record<string, unknown>;
  worldId: string;
  releaseId: string;
  releaseSha256: string;
  effectiveAt: string;
}) {
  const source = SyntheticDraftSeasonSourceZ.parse(args.source);
  const inputs = source.freezeInputs;
  const teams = Object.keys(source.measurements).sort();
  if (
    teams.length !== 30 ||
    new Set(inputs.map((i) => i.team)).size !== 30 ||
    canonicalStringify(inputs.map((i) => i.team).sort()) !==
      canonicalStringify(teams) ||
    canonicalStringify(args.measurements) !==
      canonicalStringify(source.measurements) ||
    Date.parse(args.effectiveAt) !== Date.parse(source.effectiveAt)
  )
    throw new Error(
      'Incomplete, conflicting or stale synthetic freeze evidence.'
    );
  return inputs.map((input) => {
    const m = source.measurements[input.team];
    const observation = input.observations[0];
    if (
      input.triggerSeasonStartYear !== 2025 ||
      input.originalPick.draftYear !== 2033 ||
      input.originalPick.originalTeam !== input.team ||
      input.originalPick.id !== `${input.team}_2033_1st` ||
      input.observations.length !== 1 ||
      !observation?.value ||
      m.teamCode !== input.team ||
      m.salaryCapYear !== 2026 ||
      m.seasonKey !== source.fromSeason ||
      m.regularSeasonClosing !== source.closeDate ||
      observation.value.apronTeamSalaryCents !== m.apronTeamSalary * 100 ||
      observation.value.measuredAt !== m.measuredAt ||
      Date.parse(m.source.authenticatedAt) > Date.parse(args.effectiveAt) ||
      Date.parse(input.asOf) !== Date.parse(args.effectiveAt)
    )
      throw new Error(
        'Freeze result does not match the retained season-close measurement or original pick.'
      );
    const result = evaluateDraftApronFreeze(input);
    if (
      result.status !== 'known' ||
      result.sourceResultIds.length !== 1 ||
      result.sourceResultIds[0] !== observation.sourceResultId
    )
      throw new Error(
        'The accepted freeze owner has no complete historical result.'
      );
    return DraftReviewFreezeEventZ.parse({
      scope: 'synthetic-review-only',
      leaf: 'CBA2-L08.3',
      verdictOwner: 'CBA2-A12.4',
      worldId: args.worldId,
      releaseId: args.releaseId,
      releaseSha256: args.releaseSha256,
      sourceResultId: result.sourceResultIds[0],
      triggerSalaryCapYear: source.fromSeason,
      observationTimestamp: m.measuredAt,
      originalPick: input.originalPick,
      freezeTriggered: result.value,
      currentRestriction: 'not-evaluated',
      tradingVerdict: 'not-evaluated',
    });
  });
}
