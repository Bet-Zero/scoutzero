import {
  DraftApronPlanReferenceZ,
  DraftApronSimulationPlanZ,
  type DraftApronSimulationPlan,
} from '@/schemas/draftApronSimulation';
import { mutationSnapshotDigest } from '../mutationPipeline.snapshotDigest';

export function packApronPlan(plan: DraftApronSimulationPlan) {
  const { steps, ...header } = DraftApronSimulationPlanZ.parse(plan);
  return {
    reference: DraftApronPlanReferenceZ.parse({
      kind: 'governed-apron-plan-reference-v1',
      header,
      stepSeasons: steps.map((s) => s.seasonStartYear),
      planDigest: mutationSnapshotDigest(plan),
    }),
    documents: Object.fromEntries(
      steps.map((s) => [String(s.seasonStartYear), s])
    ),
  };
}

export function unpackApronPlan(
  reference: unknown,
  documents: Record<string, unknown>
) {
  const ref = DraftApronPlanReferenceZ.parse(reference);
  const plan = DraftApronSimulationPlanZ.parse({
    ...ref.header,
    steps: ref.stepSeasons.map((y) => documents[String(y)]),
  });
  if (
    new Set(ref.stepSeasons).size !== ref.stepSeasons.length ||
    mutationSnapshotDigest(plan) !== ref.planDigest
  )
    throw new Error('Saved season inputs differ from their governed plan.');
  return plan;
}
