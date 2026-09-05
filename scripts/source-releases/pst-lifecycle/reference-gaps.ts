/** Measured uncaptured history references. This module never retrieves a URL. */
import type {
  PstObservedPage,
  TransactionObservation,
} from '@/schemas/pstLifecycle';
import type { RegisterRow } from './account';
import { statedYears } from './terms';
import { compareCodePoints } from '../verify-pst-source-release';
import { digest } from './reconstruct';

export function uncapturedHistoryReferences(
  pages: PstObservedPage[],
  transactions: TransactionObservation[],
  register: RegisterRow[]
) {
  const canonicalUrls = new Set(pages.map((page) => page.url));
  const sourceLinks = new Set(
    pages.flatMap((page) =>
      page.nodes
        .filter((node) => node.tag === 'a' && node.attributes.href)
        .map((node) => new URL(node.attributes.href, page.url).href)
    )
  );
  const rowRounds = new Map(
    pages.flatMap((page) =>
      page.rows.map((row) => [row.id, row.round] as const)
    )
  );
  const byYear = new Map<number, Set<string>>();
  for (const transaction of transactions) {
    if (rowRounds.get(transaction.rowId) !== 1) continue;
    for (const clause of transaction.clauses) {
      if (
        !clause.terms ||
        !/first round|draft pick|swap/i.test(clause.terms.text)
      )
        continue;
      for (const year of statedYears(clause.terms.text).filter(
        (year) => year < 2026
      )) {
        const refs = byYear.get(year) ?? new Set<string>();
        refs.add(transaction.cellId);
        byYear.set(year, refs);
      }
    }
  }
  return [...byYear]
    .sort(([a], [b]) => a - b)
    .map(([year, cells]) => {
      const url = `https://www.prosportstransactions.com/basketball/DraftTrades/Years/${year}.htm`;
      const evidence = [...cells].sort(compareCodePoints);
      const affectedEntitlementIds = register
        .filter((row) =>
          row.evidence.some((ref) =>
            evidence.some((cell) => cell === ref || cell.startsWith(`${ref}/`))
          )
        )
        .map((row) => row.entitlementId)
        .sort(compareCodePoints);
      return {
        id: `uncaptured-history:${digest({ year, evidence }).slice(0, 24)}`,
        season: year,
        url,
        captured: canonicalUrls.has(url),
        linkedInCapturedIndex: sourceLinks.has(url),
        evidence,
        affectedEntitlementIds,
        applicability:
          'Earlier draft considerations referenced in retained first-round transaction context; relevance to each governing branch requires reconciliation, not automatic inheritance.',
        fact: 'Uncaptured predecessor-year histories/outcomes referenced by these transaction observations',
        neededEvidence:
          'The identified historical page and controlling records for the relevant predecessor branch, retained and governed in a later authorized lane.',
      };
    });
}
