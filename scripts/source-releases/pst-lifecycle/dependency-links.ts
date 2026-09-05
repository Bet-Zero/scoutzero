/** Source-level predecessor links; official controlling authority remains separate. */
import type { LifecycleAssertion, PstTerm } from '@/schemas/pstLifecycle';
import { digest } from './reconstruct';
import { compareCodePoints } from '../verify-pst-source-release';

const flattened = (term: PstTerm): PstTerm[] => [
  term,
  ...term.children.flatMap(flattened),
];
export function dependencyLinks(assertions: LifecycleAssertion[]) {
  return assertions
    .flatMap((assertion) =>
      assertion.variants.flatMap((variant, variantIndex) =>
        flattened(variant.terms)
          .filter((term) => term.kind === 'dependency')
          .map((term) => {
            const originalTeam =
              assertion.assetIds.length === 1
                ? assertion.assetIds[0].split('_')[0]
                : null;
            const teams = Array.isArray(term.parameters.teams)
              ? term.parameters.teams.filter(
                  (team): team is string => typeof team === 'string'
                )
              : [];
            const recipient = teams.filter((team) => team !== originalTeam);
            const candidates =
              originalTeam &&
              recipient.length === 1 &&
              assertion.transactionDate
                ? assertions.filter(
                    (prior) =>
                      prior.kind === 'assignment' &&
                      prior.transactionDate &&
                      prior.transactionDate < assertion.transactionDate! &&
                      prior.toTeam === recipient[0] &&
                      prior.assetIds.some(
                        (asset) =>
                          asset.startsWith(`${originalTeam}_`) &&
                          asset.endsWith('_1st')
                      )
                  )
                : [];
            const eventKeys = new Set(
              candidates.map(
                (prior) =>
                  `${prior.transactionDate}/${prior.fromTeam}/${prior.toTeam}`
              )
            );
            return {
              id: `dependency:${digest({ assertionId: assertion.id, variantIndex, start: term.start, end: term.end }).slice(0, 24)}`,
              assertionId: assertion.id,
              variantIndex,
              minimumYearsAfter: term.parameters.minimumYearsAfter,
              originalTeam,
              priorRecipient: recipient.length === 1 ? recipient[0] : null,
              candidateAssertionIds: candidates
                .map((prior) => prior.id)
                .sort(compareCodePoints),
              candidateAssetIds: [
                ...new Set(candidates.flatMap((prior) => prior.assetIds)),
              ].sort(compareCodePoints),
              status:
                eventKeys.size === 1
                  ? 'unique-dated-prior-claim'
                  : eventKeys.size > 1
                    ? 'multiple-prior-claim-candidates'
                    : 'uncaptured-prior-claim',
              evidence: [
                ...new Set(
                  [
                    ...assertion.observations,
                    ...candidates.flatMap((prior) => prior.observations),
                  ].map((observation) => observation.cellId)
                ),
              ].sort(compareCodePoints),
              authority:
                'source-correspondence-only; no official controlling-history certification',
            };
          })
      )
    )
    .sort((a, b) => compareCodePoints(a.id, b.id));
}
