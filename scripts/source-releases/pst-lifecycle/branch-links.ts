/** Link stated alternative years/replacements without inventing extra transfers. */
import type { LifecycleAssertion, PstTerm } from '@/schemas/pstLifecycle';
import { mentionedTeams } from './terms';
import { digest } from './reconstruct';
import { compareCodePoints } from '../verify-pst-source-release';

export type BranchAssetReference = {
  id: string;
  assertionId: string;
  variantIndex: number;
  role: 'protection-year-alternative' | 'replacement' | 'selection-member';
  assetId: string | null;
  originalTeam: string | null;
  year: number | null;
  round: number | null;
  termStart: number;
  termEnd: number;
  evidence: string[];
  unresolved: string[];
};

export function branchAssetReferences(
  assertions: LifecycleAssertion[]
): BranchAssetReference[] {
  const references: BranchAssetReference[] = [];
  for (const assertion of assertions.filter(
    (item) => item.kind !== 'snapshot'
  )) {
    assertion.variants.forEach((variant, variantIndex) => {
      const original =
        assertion.assetIds.length === 1
          ? assertion.assetIds[0].split('_')[0]
          : null;
      const primaryYear = Number(assertion.assetIds[0].split('_')[1]);
      const primaryRound = assertion.assetIds[0].endsWith('_1st') ? 1 : 2;
      const evidence = [
        ...new Set(assertion.observations.map((item) => item.cellId)),
      ].sort(compareCodePoints);
      function add(
        term: PstTerm,
        role: BranchAssetReference['role'],
        team: string | null,
        year: number | null,
        round: number | null
      ) {
        const assetId =
          team && year && round
            ? `${team}_${year}_${round === 1 ? '1st' : '2nd'}`
            : null;
        const material = {
          assertionId: assertion.id,
          variantIndex,
          role,
          originalTeam: team,
          year,
          round,
          termStart: term.start,
          termEnd: term.end,
        };
        references.push({
          id: `branch-ref:${digest(material).slice(0, 24)}`,
          ...material,
          assetId,
          evidence,
          unresolved: [
            ...(!team
              ? ['Original team not stated for this replacement/participant']
              : []),
            ...(!year ? ['Draft year not stated for this replacement'] : []),
            ...(!round ? ['Draft round not stated for this replacement'] : []),
          ],
        });
      }
      function visit(term: PstTerm, fallback = false): void {
        const years = Array.isArray(term.parameters.years)
          ? term.parameters.years.filter(
              (year): year is number => typeof year === 'number'
            )
          : [];
        if (
          term.kind === 'alternative' &&
          ['if-conveys-otherwise', 'if-explicit-transfer-otherwise'].includes(
            String(term.parameters.operator)
          )
        ) {
          term.children.forEach((child, index) =>
            visit(child, fallback || index === 1)
          );
          return;
        }
        if (fallback && term.kind === 'pick') {
          const teams = mentionedTeams(term.text);
          const round =
            typeof term.parameters.round === 'number'
              ? term.parameters.round
              : null;
          if (!term.parameters.cash || /round/i.test(term.text))
            for (const year of years.length ? years : [null])
              add(
                term,
                'replacement',
                teams.length === 1 ? teams[0] : null,
                year,
                round
              );
        } else if (term.kind === 'protection' && years.length) {
          const team =
            typeof term.parameters.subjectTeam === 'string'
              ? term.parameters.subjectTeam
              : original;
          for (const year of years)
            add(term, 'protection-year-alternative', team, year, primaryRound);
        } else if (term.kind === 'selection') {
          const teams = mentionedTeams(term.text);
          for (const team of teams)
            add(
              term,
              'selection-member',
              team,
              years.length === 1 ? years[0] : primaryYear,
              primaryRound
            );
        }
        term.children.forEach((child) => visit(child, fallback));
      }
      visit(variant.terms);
    });
  }
  return references.sort((a, b) => compareCodePoints(a.id, b.id));
}
