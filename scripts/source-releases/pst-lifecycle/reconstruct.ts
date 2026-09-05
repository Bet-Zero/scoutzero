/** Evidence-backed lifecycle assertions. Sorting is serialization, not event precedence. */
import { createHash } from 'node:crypto';
import {
  PstReconstructionZ,
  type PstObservedPage,
  type PstObservedRow,
  type PstObservedCell,
  type Clause,
  type TransactionObservation,
  type LifecycleAssertion,
  type AssetHistory,
} from '@/schemas/pstLifecycle';
import { canonicalJson, compareCodePoints } from '../verify-pst-source-release';
import { normalizedText, teamCode } from './observe';
import { mentionedTeams, parseTerm, statedYears, type PstTerm } from './terms';

export const digest = (value: unknown): string =>
  createHash('sha256').update(canonicalJson(value)).digest('hex');
const unique = (values: string[]) =>
  [...new Set(values)].sort(compareCodePoints);
export type {
  Clause,
  TransactionObservation,
  LifecycleAssertion,
  AssetHistory,
} from '@/schemas/pstLifecycle';

/** Split at source bullet boundaries, keeping literal offsets and assignment side. */
export function narrativeClauses(text: string): Clause[] {
  const forOffset = text.lastIndexOf(' for ');
  const starts = [...text.matchAll(/•/g)].map((match) => match.index! + 1);
  if (!starts.length) starts.push(0);
  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] - 1 : text.length;
    const full = text.slice(start, end);
    // Transaction framing is outside the asset term. Do not let the trailing
    // transaction date become a protection year or a replacement draft year.
    const termText = full
      .replace(/\s+on \d{4}-\d{2}-\d{2}\s*$/i, '')
      .replace(/\s+(?:to [A-Za-z0-9 ]+ )?for\s*$/i, '')
      .replace(/\s+in a \d+-team trade[^•]*$/i, '');
    return {
      text: full,
      start,
      end,
      direction:
        forOffset < 0 ? 'unresolved' : start > forOffset ? 'received' : 'given',
      terms: /round|draft pick|swap|relinquish|option|cash/i.test(termText)
        ? parseTerm(termText, start)
        : null,
    };
  });
}

function targetsFor(
  row: PstObservedRow,
  cell: PstObservedCell,
  observation: TransactionObservation
): { texts: string[]; matching: string; unresolved: string[] } {
  if (observation.highlightedTexts.length)
    return {
      texts: observation.highlightedTexts,
      matching: 'source-highlight',
      unresolved: [],
    };
  if (row.outcome) {
    const slot = new RegExp(`#${row.outcome.overall}-`);
    const matches = observation.clauses.filter(
      (clause) =>
        clause.terms &&
        slot.test(clause.text) &&
        /first round|draft pick/i.test(clause.text) &&
        (statedYears(
          clause.text.replace(/\s+on \d{4}-\d{2}-\d{2}\s*$/, '')
        ).includes(row.year!) ||
          /swap/.test(clause.text))
    );
    const received = matches.filter(
      (clause) => clause.direction === 'received'
    );
    if (received.length === 1)
      return {
        texts: [received[0].terms!.text],
        matching: 'reported-draft-slot-and-received-clause',
        unresolved: [],
      };
    if (matches.length === 1)
      return {
        texts: [matches[0].terms!.text],
        matching: 'reported-draft-slot',
        unresolved: [],
      };
  }
  // A displayed assignment may be present without a narrative. Never promote
  // an unrelated bullet based solely on a shared year or page-local row number.
  return {
    texts: [],
    matching: 'unresolved-target',
    unresolved: [
      `No unique highlighted or reported-slot target in ${observation.id}`,
    ],
  };
}

function originalAssets(row: PstObservedRow, texts: string[]): string[] {
  if (row.assetId) return [row.assetId];
  if (row.role === 'pooled-allocation' && row.year && row.round)
    return unique(
      mentionedTeams(texts.join(' ')).map(
        (team) => `${team}_${row.year}_${row.round === 1 ? '1st' : '2nd'}`
      )
    );
  return [];
}

/** Cross-link assertions by explicit asset/date/recipient, retaining all term variants. */
export function reconstructPst(pages: PstObservedPage[]) {
  const transactions: TransactionObservation[] = [];
  const assertions = new Map<string, LifecycleAssertion>();
  const histories = new Map<string, AssetHistory>();
  const implementationConcerns: { evidence: string; reason: string }[] = [];
  function ensureHistory(assetId: string): AssetHistory {
    let record = histories.get(assetId);
    if (!record) {
      record = {
        assetId,
        rowIds: [],
        assertionIds: [],
        datedGroups: [],
        undatedAssertionIds: [],
        chronology: 'partial-order-by-explicit-transaction-date',
        outcomes: [],
      };
      histories.set(assetId, record);
    }
    return record;
  }
  for (const page of [...pages].sort((a, b) => compareCodePoints(a.id, b.id))) {
    for (const row of page.rows) {
      if (row.role === 'unresolved')
        implementationConcerns.push({
          evidence: row.id,
          reason: 'Unclassified source table row',
        });
      if (row.assetId) {
        const history = ensureHistory(row.assetId);
        history.rowIds.push(row.id);
        if (row.outcome)
          history.outcomes.push({ rowId: row.id, outcome: row.outcome });
      }
      for (const cell of row.cells) {
        const observations = cell.narratives
          .filter((n) => normalizedText(n.text))
          .map(
            (n, index): TransactionObservation => ({
              id: `${cell.id}/n${index}`,
              pageId: page.id,
              rowId: row.id,
              cellId: cell.id,
              nodeId: n.nodeId,
              text: n.text,
              transactionDate:
                n.text.match(/\bon (\d{4}-\d{2}-\d{2})\s*$/)?.[1] ?? null,
              effectiveDate: null,
              speakerTeam: cell.displayTeam,
              clauses: narrativeClauses(n.text),
              highlightedTexts: n.highlights.map((h) => h.text),
            })
          );
        transactions.push(...observations);
        if (
          !['asset', 'pooled-allocation'].includes(row.role) ||
          !cell.displayTeam
        )
          continue;
        // Empty transaction cells and source-reported original holding rows are
        // observations, not manufactured assignment events.
        const inputs: (TransactionObservation | null)[] = observations.length
          ? observations
          : [null];
        for (const observation of inputs) {
          const target = observation
            ? targetsFor(row, cell, observation)
            : {
                texts: [cell.displayText],
                matching: 'display-only',
                unresolved: [],
              };
          const assetIds = originalAssets(row, target.texts);
          if (!assetIds.length) continue;
          const kind = observation
            ? row.role === 'pooled-allocation'
              ? 'pool-allocation'
              : target.texts.some((text) => /option to swap/i.test(text))
                ? 'swap-interest'
                : 'assignment'
            : 'snapshot';
          const transactionDate = observation?.transactionDate ?? null;
          const explicitFrom = target.texts
            .map((text) => text.match(/\(from ([A-Za-z0-9 ]+)\)/)?.[1])
            .filter(Boolean);
          // In the site's first-person transaction narrative, the displayed
          // recipient receives the return consideration from the named "to"
          // counterparty. Multi-team transactions need an explicit from term.
          if (observation && !/\d+-team trade/i.test(observation.text)) {
            const directCounterparty = observation.text.match(
              /\bto ([A-Za-z0-9 ]+) for\s*•/
            );
            if (directCounterparty) explicitFrom.push(directCounterparty[1]);
          }
          const fromTeams = unique(
            explicitFrom
              .map((label) => teamCode(label!))
              .filter((team): team is string => Boolean(team))
          );
          const fromTeam = fromTeams.length === 1 ? fromTeams[0] : null;
          // Undated observations have no proven common event identity. Dated
          // assertions share one claim, with differing text kept as variants.
          const id = `assertion:${digest({ assetIds, kind, transactionDate, toTeam: cell.displayTeam, undatedEvidence: transactionDate ? null : cell.id }).slice(0, 24)}`;
          const status = cell.signals.some((signal) =>
            signal.classes.some((value) => /unsure/i.test(value))
          )
            ? 'uncertain'
            : cell.signals.length ||
                /may or may not|protected|option to swap|favorable/i.test(
                  cell.displayText
                )
              ? 'conditional'
              : 'reported';
          let assertion = assertions.get(id);
          if (!assertion) {
            assertion = {
              id,
              assetIds,
              kind,
              transactionDate,
              effectiveDate: null,
              fromTeam,
              toTeam: cell.displayTeam,
              status,
              observations: [],
              variants: [],
              unresolved: [],
              eventIdentity: transactionDate
                ? 'exact-observation-equivalence'
                : 'undated-observation',
            };
            assertions.set(id, assertion);
          }
          assertion.observations.push({
            rowId: row.id,
            cellId: cell.id,
            narrativeId: observation?.id ?? null,
            nodeId: observation?.nodeId ?? cell.nodeId,
            pageId: page.id,
            targetTexts: target.texts,
            matching: target.matching,
            fromTeam,
          });
          for (const text of target.texts)
            if (!assertion.variants.some((variant) => variant.text === text))
              assertion.variants.push({ text, terms: parseTerm(text) });
          assertion.unresolved.push(...target.unresolved);
          if (assertion.fromTeam !== fromTeam) {
            if (assertion.fromTeam && fromTeam)
              assertion.unresolved.push(
                assertion.kind === 'assignment' &&
                  assertion.status === 'reported' &&
                  status === 'reported'
                  ? 'Source observations disagree about assignment sender'
                  : 'Alternative or same-date sender identity unresolved'
              );
            else assertion.fromTeam ??= fromTeam;
          }
          if (observation && !transactionDate)
            assertion.unresolved.push(
              'Transaction date not stated in this observation'
            );
          if (observation && !target.texts.length && row.round === 1)
            implementationConcerns.push({
              evidence: observation.id,
              reason: 'Target binding requires source inspection',
            });
          for (const assetId of assetIds) {
            const history = ensureHistory(assetId);
            history.rowIds.push(row.id);
            history.assertionIds.push(id);
          }
        }
      }
    }
  }
  for (const assertion of assertions.values()) {
    assertion.unresolved = unique(assertion.unresolved);
    assertion.variants.sort((a, b) => compareCodePoints(a.text, b.text));
    assertion.observations.sort((a, b) =>
      compareCodePoints(canonicalJson(a), canonicalJson(b))
    );
    if (
      unique(
        assertion.observations
          .map((observation) => observation.fromTeam)
          .filter((team): team is string => Boolean(team))
      ).length > 1
    )
      assertion.fromTeam = null;
    const observedNarratives = unique(
      assertion.observations
        .filter((observation) => observation.narrativeId)
        .map((observation) =>
          normalizedText(
            transactions.find(
              (transaction) => transaction.id === observation.narrativeId
            )!.text
          )
        )
    );
    if (assertion.transactionDate && observedNarratives.length > 1)
      assertion.eventIdentity = 'dated-claim-with-source-variants';
  }
  for (const history of histories.values()) {
    history.rowIds = unique(history.rowIds);
    history.assertionIds = unique(history.assertionIds);
    const dates = new Map<string, string[]>();
    for (const id of history.assertionIds) {
      const assertion = assertions.get(id)!;
      if (assertion.transactionDate)
        dates.set(assertion.transactionDate, [
          ...(dates.get(assertion.transactionDate) ?? []),
          id,
        ]);
      else history.undatedAssertionIds.push(id);
    }
    history.datedGroups = [...dates]
      .sort(([a], [b]) => compareCodePoints(a, b))
      .map(([transactionDate, assertionIds]) => ({
        transactionDate,
        assertionIds: unique(assertionIds),
      }));
  }
  return PstReconstructionZ.parse({
    transactions: transactions.sort((a, b) => compareCodePoints(a.id, b.id)),
    assertions: [...assertions.values()].sort((a, b) =>
      compareCodePoints(a.id, b.id)
    ),
    histories: [...histories.values()].sort((a, b) =>
      compareCodePoints(a.assetId, b.assetId)
    ),
    implementationConcerns,
  });
}
