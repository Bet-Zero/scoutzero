/** Author claims are retained for review, not inferred by the byte qualifier. */
import { z } from 'zod';
import { sha256 } from './compare';
import type { verifyRetainedV2 } from './retained';

const citationZ = z
  .object({
    sourceId: z.string(),
    capture: z.union([z.literal(0), z.literal(1)]),
    byteStart: z.number().int().nonnegative(),
    byteEnd: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    locator: z.string().min(1),
  })
  .strict();
const observationZ = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    claim: z.string().min(1),
    baselineRequirementIds: z.array(z.string()).min(1),
    citations: z.array(citationZ).min(1),
    limitations: z.array(z.string()).min(1),
    status: z.enum(['partial', 'quarantined']),
    fullRequirementSatisfied: z.literal(false),
  })
  .strict();
const assessmentZ = z
  .object({
    version: z.literal('bze307-author-reassessment-v3'),
    observations: z.array(observationZ),
    corroborations: z.array(
      z
        .object({
          existingObservationId: z.string(),
          citations: z.array(citationZ).min(1),
          limitations: z.array(z.string()).min(1),
        })
        .strict()
    ),
    remaining: z.array(
      z
        .object({
          baselineRequirementId: z.string(),
          disposition: z.enum(['unresolved', 'conflicting']),
          remainingFacts: z.array(z.string()).min(1),
        })
        .strict()
    ),
    conflictingRequirementIds: z.array(z.string()),
    dependencyReview: z.string().min(1),
    runtimeAuthority: z.literal(false),
    independentSemanticAccept: z.literal(false),
  })
  .strict();
type Inputs = Awaited<ReturnType<typeof verifyRetainedV2>>;

/** Verify source locators, qualified protected bytes and exact unchanged coverage. */
export function verifyAuthorAssessment(value: unknown, inputs: Inputs) {
  const assessment = assessmentZ.parse(value);
  const ids = new Set(inputs.scopedIds);
  const remainingIds = assessment.remaining
    .map((r) => r.baselineRequirementId)
    .sort();
  if (JSON.stringify(remainingIds) !== JSON.stringify(inputs.scopedIds))
    throw new Error('Lost or duplicated assessment lineage');
  for (const row of assessment.remaining) {
    if (
      inputs.occurrences.find(
        (x) => x.baselineRequirementId === row.baselineRequirementId
      )?.disposition !== row.disposition
    )
      throw new Error('Unsupported changed disposition');
  }
  const conflicts = inputs.occurrences
    .filter((x) => x.disposition === 'conflicting')
    .map((x) => x.baselineRequirementId)
    .sort();
  if (
    JSON.stringify([...assessment.conflictingRequirementIds].sort()) !==
    JSON.stringify(conflicts)
  )
    throw new Error('Existing conflict was waived');
  const existing = z
    .array(z.object({ id: z.string() }).passthrough())
    .parse(JSON.parse(inputs.files.get('observations.json')!.toString('utf8')));
  const existingIds = new Set(existing.map((x) => x.id));
  const allIds = new Set(existingIds);
  function checkCitation(citation: z.infer<typeof citationZ>): void {
    const source = inputs.qualifications.find(
      (q) => q.sourceId === citation.sourceId
    );
    if (!source?.eligibleAfterIndependentRecovery || !source.byteProof)
      throw new Error(
        'Citation requires qualified primary source and complete provenance'
      );
    const bytes = inputs.files.get(
      source.sourceRecord.captures[citation.capture].path
    )!;
    if (
      citation.byteStart >= citation.byteEnd ||
      citation.byteEnd > bytes.length ||
      sha256(bytes.subarray(citation.byteStart, citation.byteEnd)) !==
        citation.sha256
    )
      throw new Error('Citation byte locator or fingerprint mismatch');
    const side = citation.capture === 0 ? 'left' : 'right';
    if (
      !source.byteProof.equalIntervals.some(
        (x) =>
          x[side][0] <= citation.byteStart && x[side][1] >= citation.byteEnd
      )
    )
      throw new Error('Factual evidence cannot use an excluded difference');
  }
  for (const observation of assessment.observations) {
    if (allIds.has(observation.id))
      throw new Error('Duplicate observation identity');
    allIds.add(observation.id);
    if (
      new Set(observation.baselineRequirementIds).size !==
        observation.baselineRequirementIds.length ||
      observation.baselineRequirementIds.some((id) => !ids.has(id))
    )
      throw new Error('Observation lineage escapes scope or duplicates IDs');
    observation.citations.forEach(checkCitation);
    for (const id of observation.baselineRequirementIds) {
      if (
        !observation.citations.some((c) =>
          inputs.qualifications
            .find((q) => q.sourceId === c.sourceId)
            ?.sourceRecord.candidateBaselineRequirementIds.includes(id)
        )
      )
        throw new Error('Observation/source mapping lacks retained lineage');
    }
  }
  const corroborated = new Set<string>();
  for (const corroboration of assessment.corroborations) {
    if (
      !existingIds.has(corroboration.existingObservationId) ||
      corroborated.has(corroboration.existingObservationId)
    )
      throw new Error('Unknown or duplicate corroboration');
    corroborated.add(corroboration.existingObservationId);
    corroboration.citations.forEach(checkCitation);
  }
  return assessment;
}
