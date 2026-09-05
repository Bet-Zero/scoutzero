/** Exact comparison-universe accounting, separate from positive-path authority. */
import { z } from 'zod';
import type { PstObservedPage } from '@/schemas/pstLifecycle';
import { compareCodePoints } from '../verify-pst-source-release';
import {
  type AssetHistory,
  type LifecycleAssertion,
  type TransactionObservation,
  digest,
} from './reconstruct';
import { mentionedTeams, statedYears, type PstTerm } from './terms';
import { branchAssetReferences } from './branch-links';
import { dependencyLinks } from './dependency-links';

const KindZ = z.enum(['pick_ownership', 'swap_right', 'conveyance_right']);
export const ComparisonAssetZ = z
  .object({
    id: z
      .string()
      .regex(/^ent:[A-Z]{3}:20\d{2}:1:(own|swap|conv):[a-f0-9]{8}$/),
    kind: KindZ,
    seasonYear: z.number().int().min(2026).max(2033),
    round: z.literal(1),
    underlyingPickId: z.string().optional(),
    poolUnderlyingPickIds: z.array(z.string()).optional(),
    swapControllerPickId: z.string().optional(),
  })
  .strict();
export type ComparisonAsset = z.infer<typeof ComparisonAssetZ>;
export const PRIMARY_CLASSES = [
  'source-complete lifecycle',
  'recoverable/model loss fixed by the new parser',
  'source-partial/uncertain',
  'conflicting',
  'missing',
] as const;
export type PrimaryClass = (typeof PRIMARY_CLASSES)[number];
export type Gap = {
  code: string;
  fact: string;
  why: string;
  evidence: string[];
  neededEvidence: string;
  branch: string;
  affectsSourceCompleteness: boolean;
};
export type RegisterRow = {
  entitlementId: string;
  kind: ComparisonAsset['kind'];
  year: number;
  underlyingAssetIds: string[];
  sourceMapping:
    | 'original-pick'
    | 'candidate-right-correspondence'
    | 'unmapped';
  primaryClass: PrimaryClass;
  evidence: string[];
  assertionIds: string[];
  recoveredFields: string[];
  gaps: Gap[];
  positivePathAuthority: 'unavailable';
  reportedOutcomes: AssetHistory['outcomes'];
  comparisonHolderTeam: string;
  latestDatedRecipients: {
    team: string;
    transactionDate: string;
    assertionId: string;
    conditional: boolean;
  }[];
};
const sortedUnique = (values: string[]) =>
  [...new Set(values)].sort(compareCodePoints);
const flattenTerms = (term: PstTerm): PstTerm[] => [
  term,
  ...term.children.flatMap(flattenTerms),
];

/** Reject drift instead of fitting a supplied corpus into the expected denominator. */
export function validateComparison(input: unknown): ComparisonAsset[] {
  const assets = z.array(ComparisonAssetZ).length(278).parse(input);
  if (new Set(assets.map((asset) => asset.id)).size !== 278)
    throw new Error('Duplicate comparison entitlement');
  const expectedKinds = {
    pick_ownership: 240,
    swap_right: 27,
    conveyance_right: 11,
  };
  for (const kind of Object.keys(expectedKinds) as ComparisonAsset['kind'][])
    if (
      assets.filter((asset) => asset.kind === kind).length !==
      expectedKinds[kind]
    )
      throw new Error('Comparison kind drift');
  const yearTotals = [37, 32, 39, 44, 35, 31, 30, 30];
  for (let year = 2026; year <= 2033; year++) {
    const yearly = assets.filter((asset) => asset.seasonYear === year);
    if (yearly.length !== yearTotals[year - 2026])
      throw new Error('Comparison year drift');
    const own = yearly.filter((asset) => asset.kind === 'pick_ownership');
    if (
      own.length !== 30 ||
      new Set(own.map((asset) => asset.underlyingPickId)).size !== 30
    )
      throw new Error('Ownership universe drift');
  }
  for (const asset of assets) {
    const pickPattern = new RegExp(`^[A-Z]{3}_${asset.seasonYear}_1st$`);
    if (
      asset.kind === 'pick_ownership' &&
      (!asset.underlyingPickId || !pickPattern.test(asset.underlyingPickId))
    )
      throw new Error('Ownership pick identity/year mismatch');
    if (
      asset.kind === 'swap_right' &&
      (!asset.swapControllerPickId ||
        !pickPattern.test(asset.swapControllerPickId))
    )
      throw new Error('Swap comparison identity/year mismatch');
    if (
      asset.kind === 'conveyance_right' &&
      (!asset.poolUnderlyingPickIds?.length ||
        asset.poolUnderlyingPickIds.some((id) => !pickPattern.test(id)))
    )
      throw new Error('Pool comparison identity/year mismatch');
    if (Number(asset.id.split(':')[2]) !== asset.seasonYear)
      throw new Error('Comparison ID/year mismatch');
    if (
      asset.id.split(':')[4] !==
      { pick_ownership: 'own', swap_right: 'swap', conveyance_right: 'conv' }[
        asset.kind
      ]
    )
      throw new Error('Comparison ID/kind mismatch');
  }
  return [...assets].sort((a, b) => compareCodePoints(a.id, b.id));
}

/** Fixed precedence: source absence, same-branch conflict, partial, recovered, complete. */
export function primaryClass({
  mapped,
  conflict,
  partial,
  recovered,
}: {
  mapped: boolean;
  conflict: boolean;
  partial: boolean;
  recovered: boolean;
}): PrimaryClass {
  return !mapped
    ? PRIMARY_CLASSES[4]
    : conflict
      ? PRIMARY_CLASSES[3]
      : partial
        ? PRIMARY_CLASSES[2]
        : recovered
          ? PRIMARY_CLASSES[1]
          : PRIMARY_CLASSES[0];
}

export function accountPst(
  assets: ComparisonAsset[],
  pages: PstObservedPage[],
  reconstruction: {
    assertions: LifecycleAssertion[];
    histories: AssetHistory[];
    transactions: TransactionObservation[];
  }
) {
  validateComparison(assets);
  const rowLookup = new Map(
    pages.flatMap((page) => page.rows.map((row) => [row.id, row] as const))
  );
  const historyLookup = new Map(
    reconstruction.histories.map((history) => [history.assetId, history])
  );
  const assertionLookup = new Map(
    reconstruction.assertions.map((assertion) => [assertion.id, assertion])
  );
  const branchReferences = branchAssetReferences(reconstruction.assertions);
  const predecessors = dependencyLinks(reconstruction.assertions);
  const register: RegisterRow[] = [];
  for (const asset of assets) {
    let underlyingAssetIds = sortedUnique(
      [
        asset.underlyingPickId,
        asset.swapControllerPickId,
        ...(asset.poolUnderlyingPickIds ?? []),
      ].filter((id): id is string => Boolean(id))
    );
    const histories = underlyingAssetIds
      .map((id) => historyLookup.get(id))
      .filter((history): history is AssetHistory => Boolean(history));
    let assertionIds = sortedUnique(
      histories.flatMap((history) => history.assertionIds)
    );
    let evidence = sortedUnique(histories.flatMap((history) => history.rowIds));
    const gaps: Gap[] = [];
    const gap = (
      code: string,
      fact: string,
      why: string,
      neededEvidence: string,
      branch = 'all',
      refs = evidence,
      affectsSourceCompleteness = true
    ) =>
      gaps.push({
        code,
        fact,
        why,
        neededEvidence,
        branch,
        evidence: sortedUnique(refs),
        affectsSourceCompleteness,
      });
    let mapped = histories.length > 0;
    if (asset.kind !== 'pick_ownership') {
      // Existing derivative IDs encode the comparison model's construction,
      // not PST-native identity. Find source candidates without certifying that
      // its synthetic split is equivalent to the source right.
      const hintController = asset.id.split(':')[1];
      const rightEvidence = reconstruction.transactions.flatMap((transaction) =>
        transaction.clauses
          .filter(
            (clause) =>
              clause.terms &&
              /swap|favorable/i.test(clause.text) &&
              statedYears(clause.terms.text).includes(asset.seasonYear) &&
              mentionedTeams(clause.text).includes(hintController)
          )
          .map((clause) => ({ transaction, clause }))
      );
      evidence = sortedUnique(
        rightEvidence.map(({ transaction }) => transaction.cellId)
      );
      underlyingAssetIds = sortedUnique(
        rightEvidence.flatMap(({ clause }) =>
          mentionedTeams(clause.terms!.text).map(
            (team) => `${team}_${asset.seasonYear}_1st`
          )
        )
      );
      mapped = rightEvidence.length > 0;
      assertionIds = sortedUnique(
        reconstruction.assertions
          .filter((assertion) =>
            assertion.observations.some((observation) =>
              evidence.includes(observation.cellId)
            )
          )
          .map((assertion) => assertion.id)
      );
      if (mapped)
        gap(
          'DERIVATIVE_ID_EQUIVALENCE_UNPROVEN',
          'Exact correspondence between the old derivative ID and the source-native right/retained interest',
          'The old model generated derivative identities and sometimes synthetic splits; participant/year correspondence does not prove branch equivalence or current ownership.',
          'Controlling right definition and assignment/amendment chain, reconciled to the cited source clauses.',
          `legacy-right:${asset.id}`
        );
    }
    const assertions = assertionIds.map((id) => assertionLookup.get(id)!);
    const dated = assertions.filter(
      (assertion) => assertion.transactionDate && assertion.kind !== 'snapshot'
    );
    const terms = assertions.flatMap((assertion) =>
      assertion.variants.flatMap((variant) => flattenTerms(variant.terms))
    );
    const relatedBranches = branchReferences.filter(
      (reference) =>
        assertionIds.includes(reference.assertionId) ||
        (reference.assetId !== null &&
          underlyingAssetIds.includes(reference.assetId))
    );
    const incompleteReplacements = relatedBranches.filter(
      (reference) =>
        reference.role === 'replacement' && reference.unresolved.length
    );
    for (const reference of incompleteReplacements)
      gap(
        'REPLACEMENT_IDENTITY_INCOMPLETE',
        `Replacement identity: ${reference.unresolved.join('; ')}`,
        'The fallback exists in the source but its exact year/round/original team is not fully stated. No original team or year is borrowed from the transaction or comparison model.',
        'The controlling fallback clause naming the exact replacement asset.',
        reference.id,
        reference.evidence
      );
    const alternativeHistory = relatedBranches.filter(
      (reference) =>
        reference.assetId &&
        underlyingAssetIds.includes(reference.assetId) &&
        !assertionIds.includes(reference.assertionId)
    );
    for (const reference of alternativeHistory)
      gap(
        'RELATED_OBLIGATION_BRANCH',
        'Reconciliation of this pick with a stated predecessor/rollover/replacement branch',
        'Another captured obligation names this asset as an alternative or replacement. The link is retained without inventing a transfer or assuming that the branch is active/extinguished.',
        'The governing transition or outcome linking this exact branch to the current asset state.',
        reference.id,
        reference.evidence
      );
    const recoveredFields = sortedUnique([
      ...(evidence.length
        ? ['page/table/row/cell provenance', 'structural/status observations']
        : []),
      ...(dated.length
        ? [
            'dated assignment/right assertions',
            'cross-page observation retention',
          ]
        : []),
      ...terms
        .filter(
          (term) => !['context', 'group', 'pick', 'outcome'].includes(term.kind)
        )
        .map((term) => `scoped ${term.kind} terms`),
      ...(histories.some((history) => history.outcomes.length)
        ? ['reported 2026 draft outcome']
        : []),
    ]);
    if (asset.kind === 'pick_ownership' && mapped) {
      if (!dated.length)
        gap(
          'SNAPSHOT_WITHOUT_GOVERNING_HISTORY',
          'Governing ownership/obligation history behind the displayed original-team row',
          'This release supplies a displayed pick/holder row and possibly a draft result, but no dated lifecycle chain for this asset. An empty narrative does not certify no previous transfers or obligations.',
          'Dated controlling history or an affirmative complete state record for this exact original pick.'
        );
      const unknownSenders = dated.filter(
        (assertion) => assertion.kind === 'assignment' && !assertion.fromTeam
      );
      if (unknownSenders.length)
        gap(
          'ASSIGNMENT_SENDER_UNSTATED',
          'Assignment origin and chain continuity',
          'The targeted consideration lacks an explicit sender; a multi-team trade or table order alone cannot establish it.',
          'Controlling assignment terms identifying the sender and the affected pick/right.',
          'assignment-chain',
          unknownSenders.flatMap((assertion) =>
            assertion.observations.map((observation) => observation.cellId)
          )
        );
      if (
        dated.some((assertion) => assertion.kind === 'assignment') &&
        !terms.some((term) => term.kind === 'protection')
      )
        gap(
          'PROTECTION_STATUS_UNSTATED',
          'Complete governing protection/unprotected terms',
          'A described first-round transfer is not an affirmative statement that every governing protection/rollover term is absent.',
          'The controlling pick clause specifying unprotected status or the complete protection/rollover schedule.'
        );
      const uncertainRows = evidence.filter((ref) =>
        rowLookup
          .get(ref)
          ?.cells.some((cell) =>
            cell.signals.some((signal) => signal.classes.includes('unsure'))
          )
      );
      if (uncertainRows.length)
        gap(
          'EXPLICIT_SOURCE_UNCERTAINTY',
          'Resolution of the source uncertainty marker',
          'PST explicitly marks an assertion incomplete or uncertain.',
          'The underlying controlling transaction or corrected governed source statement.',
          'uncertain-source-assertion',
          uncertainRows
        );
    }
    const selectionAssertions = assertions.filter((assertion) =>
      assertion.variants.some((variant) =>
        flattenTerms(variant.terms).some((term) => term.kind === 'selection')
      )
    );
    if (selectionAssertions.length)
      gap(
        'SELECTION_TIE_TERMS_ABSENT',
        'Controlling favorable-pool ordering and tie treatment',
        'PST gives favorable selection/pool language but does not state a complete tie treatment for this branch.',
        'The governing pool/priority agreement and applicable official order/tiebreak determination.',
        'favorable-selection',
        selectionAssertions.flatMap((assertion) =>
          assertion.observations.map((observation) => observation.cellId)
        )
      );
    const swapAssertions = assertions.filter(
      (assertion) => assertion.kind === 'swap-interest'
    );
    if (swapAssertions.length)
      gap(
        'ELECTION_HISTORY_AND_WINDOW_ABSENT',
        'Controlling swap/election window, exercise and amendment history',
        'An option and possible or reported outcome do not supply its complete controlling election window/history.',
        'The agreement and dated exercise/waiver/amendment records for the specific option.',
        'swap-election',
        swapAssertions.flatMap((assertion) =>
          assertion.observations.map((observation) => observation.cellId)
        )
      );
    const dependencies = predecessors.filter(
      (link) =>
        assertionIds.includes(link.assertionId) &&
        link.status !== 'unique-dated-prior-claim'
    );
    for (const dependency of dependencies)
      gap(
        'PRIOR_OBLIGATION_LINK_REQUIRES_HISTORY',
        'Exact predecessor obligation identity and satisfaction/effective history',
        `The source-level predecessor search is ${dependency.status}; candidate links are retained without inventing equivalence.`,
        'The earlier controlling agreement and satisfaction/amendment record linked to this exact obligation.',
        dependency.id,
        dependency.evidence
      );
    const variants = assertions.filter(
      (assertion) =>
        assertion.eventIdentity === 'dated-claim-with-source-variants'
    );
    if (variants.length)
      gap(
        'DATED_ASSERTION_VARIANTS',
        'Whether differing narratives on a shared date/recipient describe the same governing event and terms',
        'Cross-page observations are grouped as a dated claim with preserved variants; this does not prove multiple transfers or silently reconcile differences.',
        'The controlling dated transaction/amendment record identifying the event and applicable branch.',
        'event-identity',
        variants.flatMap((assertion) =>
          assertion.observations.map((observation) => observation.cellId)
        )
      );
    // These required external facts are authority gaps independently of source
    // reconstruction status. Unknown future outcomes are explicitly deferred.
    gap(
      'OFFICIAL_SECOND_APRON_LIFECYCLE',
      'Official Second Apron freeze, unfreeze, penalty and no-penalty history for the affected original teams/seasons',
      'No official team/season determination or complete freeze/unfreeze/penalty history is supplied by this PST release.',
      'Official season determinations and resulting pick-level freeze/unfreeze/penalty records, including affirmative no-event coverage.',
      'global:first-round-authority',
      evidence,
      false
    );
    gap(
      'OFFICIAL_OUTCOME_AND_ORDER',
      asset.seasonYear === 2026
        ? 'Official corroboration of reported 2026 draft outcomes and order'
        : 'Official future outcome/order/tie determination when the branch resolves',
      asset.seasonYear === 2026
        ? 'PST-reported draft results are retained separately from official outcome authority.'
        : 'The future outcome is not yet known; this is not missing governing branch language.',
      'Official draft/order/tiebreak result for the affected season and branch.',
      'outcome-resolution',
      evidence,
      false
    );
    gap(
      'CONTROLLING_TRANSACTION_AUTHORITY',
      'Controlling transaction, amendment, relinquishment and election records applicable to this asset',
      'PST is a retained third-party observation, not a complete controlling transaction/amendment/election archive.',
      'Governing records linked to the reconstructed asset and event identifiers.',
      'global:controlling-history',
      evidence,
      false
    );
    if (!mapped)
      gap(
        'SOURCE_MAPPING_MISSING',
        'Source-native identity corresponding to the exposed ID',
        'No defensible source/right match was found; existing model hints were not accepted as fact authority.',
        'An explicit source-native right/pick definition linked to the old exposed ID.',
        'identity',
        []
      );
    const conflict = assertions.some((assertion) =>
      assertion.unresolved.includes(
        'Source observations disagree about assignment sender'
      )
    );
    if (conflict)
      gap(
        'SAME_CLAIM_SENDER_CONFLICT',
        'Resolution of incompatible senders on the same dated assignment claim',
        'The observations disagree and have not been proved mutually exclusive alternatives or different events.',
        'Controlling transaction/amendment evidence resolving the exact claim.'
      );
    register.push({
      entitlementId: asset.id,
      kind: asset.kind,
      year: asset.seasonYear,
      underlyingAssetIds,
      sourceMapping: !mapped
        ? 'unmapped'
        : asset.kind === 'pick_ownership'
          ? 'original-pick'
          : 'candidate-right-correspondence',
      primaryClass: primaryClass({
        mapped,
        conflict,
        partial: gaps.some((item) => item.affectsSourceCompleteness),
        recovered: recoveredFields.some(
          (field) => field.startsWith('scoped ') || field.startsWith('dated ')
        ),
      }),
      evidence,
      assertionIds,
      recoveredFields,
      gaps,
      positivePathAuthority: 'unavailable',
      reportedOutcomes: histories.flatMap((history) => history.outcomes),
      comparisonHolderTeam: asset.id.split(':')[1],
      latestDatedRecipients: dated
        .filter(
          (assertion) =>
            assertion.toTeam &&
            assertion.transactionDate ===
              dated
                .map((item) => item.transactionDate!)
                .sort(compareCodePoints)
                .at(-1)
        )
        .map((assertion) => ({
          team: assertion.toTeam!,
          transactionDate: assertion.transactionDate!,
          assertionId: assertion.id,
          conditional: assertion.status !== 'reported',
        })),
    });
  }
  register.sort((a, b) => compareCodePoints(a.entitlementId, b.entitlementId));
  const counts = Object.fromEntries(
    PRIMARY_CLASSES.map((category) => [
      category,
      register.filter((row) => row.primaryClass === category).length,
    ])
  );
  const byKindYear = assets.reduce<Record<string, Record<string, number>>>(
    (result, asset) => {
      const key = `${asset.seasonYear}/${asset.kind}`;
      result[key] ??= Object.fromEntries(
        PRIMARY_CLASSES.map((category) => [category, 0])
      );
      result[key][
        register.find((row) => row.entitlementId === asset.id)!.primaryClass
      ]++;
      return result;
    },
    {}
  );
  const externalFacts = register.flatMap((row) =>
    row.gaps.map((gap) => ({
      id: `gap:${digest({ entitlementId: row.entitlementId, code: gap.code, branch: gap.branch }).slice(0, 24)}`,
      entitlementId: row.entitlementId,
      assetIds: row.underlyingAssetIds,
      teams: sortedUnique(row.underlyingAssetIds.map((id) => id.split('_')[0])),
      season: row.year,
      ...gap,
    }))
  );
  return {
    register,
    counts,
    byKindYear,
    externalFacts,
    branchReferences,
    dependencyLinks: predecessors,
    nonComplete: register
      .filter(
        (row) =>
          ![PRIMARY_CLASSES[0], PRIMARY_CLASSES[1]].includes(
            row.primaryClass as
              | (typeof PRIMARY_CLASSES)[0]
              | (typeof PRIMARY_CLASSES)[1]
          )
      )
      .map((row) => row.entitlementId),
  };
}
