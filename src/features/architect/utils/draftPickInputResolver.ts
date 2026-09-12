/** Operation-specific selection. No source retrieval, promotion or world adoption. */
import { z } from 'zod';
import { DraftEvidenceIdZ } from '@/schemas/draftPickEvidence';
import {
  DraftOperationRequestZ,
  type DraftOperationContext,
  type DraftOriginalOwnershipFact,
} from '@/schemas/draftPickOperation';
import { canonicalStringify } from '@/features/architect/utils/contractSource/deterministicDigest';

export type DraftRuleDecision = {
  status: 'component-permits' | 'component-prohibits' | 'needs-input';
  leaf: string;
  reasons: string[];
  evidenceIds: string[];
  tradingVerdict: 'not-evaluated';
};
export const draftRuleDecision = (
  leaf: string,
  status: DraftRuleDecision['status'],
  reasons: string[],
  evidenceIds: string[] = []
): DraftRuleDecision => ({
  status,
  leaf,
  reasons,
  evidenceIds,
  tradingVerdict: 'not-evaluated',
});

export function parseDraftOperationRequest(input: unknown) {
  const parsed = DraftOperationRequestZ.safeParse(input);
  if (!parsed.success) return null;
  if (
    new Set(parsed.data.outgoing.map((p) => p.id)).size !==
    parsed.data.outgoing.length
  )
    return null;
  return parsed.data;
}

type FactEvidence = Pick<
  DraftOriginalOwnershipFact,
  'context' | 'status' | 'effectiveAt' | 'validUntil' | 'sources'
> & { scope: string };

export function draftFactProblem(
  fact: FactEvidence,
  context: DraftOperationContext
): string | null {
  if (canonicalStringify(fact.context) !== canonicalStringify(context))
    return 'stale-or-wrong-operation-context';
  if (fact.status !== 'supported in stated scope')
    return `evidence-${fact.status}`;
  const at = Date.parse(context.asOf);
  if (
    !fact.effectiveAt ||
    Date.parse(fact.effectiveAt) > at ||
    (fact.validUntil !== null && Date.parse(fact.validUntil) <= at)
  )
    return 'missing-or-inapplicable-effective-date';
  if (
    !fact.sources.length ||
    fact.sources.some(
      (s) =>
        s.qualification !== 'qualified' ||
        s.review.status !== 'accepted' ||
        s.review.limitations.length !== 0 ||
        s.scope !== fact.scope
    )
  )
    return 'source-or-review-scope-not-established';
  return null;
}

/** Ignore unrelated fact kinds/IDs; selected malformed or duplicate facts block. */
export function selectDraftOperationFact<T>(
  inputs: unknown[],
  schema: z.ZodType<T>,
  selector: { scope: string; pickId?: string }
): { fact: T; reason?: never } | { reason: string; fact?: never } {
  const envelope = z.object({ scope: z.string() });
  const pickEnvelope = z.object({ pick: z.object({ id: DraftEvidenceIdZ }) });
  const matching: unknown[] = [];
  for (const input of inputs) {
    const scoped = envelope.safeParse(input);
    if (!scoped.success || scoped.data.scope !== selector.scope) continue;
    if (selector.pickId !== undefined) {
      const identified = pickEnvelope.safeParse(input);
      // An ambiguous same-scope record cannot safely be called unrelated.
      if (!identified.success)
        return { reason: 'invalid-or-unsupported-operation-fact' };
      if (identified.data.pick.id !== selector.pickId) continue;
    }
    matching.push(input);
  }
  if (matching.length !== 1)
    return {
      reason: matching.length
        ? 'conflicting-fact-records'
        : 'missing-operation-fact',
    };
  const parsed = schema.safeParse(matching[0]);
  return parsed.success
    ? { fact: parsed.data }
    : { reason: 'invalid-or-unsupported-operation-fact' };
}
