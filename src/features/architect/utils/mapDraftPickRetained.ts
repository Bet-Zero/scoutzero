/** Map retained structured outputs only; never re-extract sources or evaluate clauses. */
import { z } from 'zod';
import {
  DraftFoundationReleaseZ,
  DraftRetainedArtifactZ,
} from '@/schemas/draftPickEvidence';
import {
  DraftReadinessOverlayZ,
  DraftRetainedReadinessZ,
} from '@/schemas/draftPickRetained';
import { buildDraftPickFoundation } from '@/features/architect/utils/draftPickFoundation';

const clauseZ = z.object({ sourceText: z.string().min(1) }).passthrough();
const detailZ = z
  .object({
    id: z.string().min(1),
    retainedDetail: z
      .object({ clauseLocators: z.array(clauseZ).optional() })
      .passthrough(),
  })
  .passthrough();
const inputZ = z
  .object({
    release: DraftFoundationReleaseZ,
    retained: DraftRetainedReadinessZ,
    overlay: DraftReadinessOverlayZ,
    branchDetails: z.array(detailZ),
    retainedArtifacts: z.array(DraftRetainedArtifactZ),
  })
  .strict();

// This bounded clarification names these two pools. It is not a general pool parser.
const pools = [
  { teams: ['BOS', 'MIL', 'POR'], names: ['Celtics', 'Bucks', 'Blazers'] },
  { teams: ['DAL', 'HOU', 'PHX'], names: ['Mavericks', 'Rockets', 'Suns'] },
];

export function mapDraftPickRetained(input: unknown) {
  const d = inputZ.parse(input);
  const deps = new Map(d.retained.dependencies.map((row) => [row.id, row]));
  const poolScopeNotes: {
    dependencyId: string;
    pool: string[];
    sourceNamedMembers: string[];
    clauseRef: string;
    relation: 'shared-pool-scope-only';
  }[] = [];
  const programs = d.branchDetails.map((row, index) => {
    const dependency = deps.get(row.id);
    if (!dependency)
      throw new Error('Branch detail without retained dependency');
    const clauses = (row.retainedDetail.clauseLocators ?? []).map(
      (clause, n) => ({
        text: clause.sourceText,
        sourceRef: `remaining-branch-detail.json#/${index}/retainedDetail/clauseLocators/${n}`,
        parsed: null,
      })
    );
    if (dependency.family === 'contractual-priority-ties') {
      for (const pool of pools) {
        const clause = clauses.find((c) =>
          pool.names.every((name) => new RegExp(`\\b${name}\\b`).test(c.text))
        );
        // Named pool plus explicit structural scope, never inherited-ID intersection.
        const inScope = d.overlay.some(
          (o) =>
            o.family === 'derivative-right-correspondence' &&
            o.category === 'A' &&
            o.structuralDependencyOrScope.some((s) =>
              s.includes(pool.teams.join('/'))
            )
        );
        if (clause && inScope)
          poolScopeNotes.push({
            dependencyId: row.id,
            pool: pool.teams,
            sourceNamedMembers: pool.teams,
            clauseRef: clause.sourceRef,
            relation: 'shared-pool-scope-only',
          });
      }
    }
    return {
      id: `retained-program:${row.id}`,
      dependencyId: row.id,
      clauses,
      completeness:
        dependency.authorityStatus === 'conflicting'
          ? 'conflicting'
          : 'unresolved',
      executable: false,
    };
  });
  return buildDraftPickFoundation({
    release: d.release,
    retained: d.retained,
    overlay: d.overlay,
    // No source-named economic right or executable assertion is inferred from a legacy ID.
    sourceRights: [],
    assertions: [],
    programs,
    poolScopeNotes,
    retainedArtifacts: d.retainedArtifacts,
    retainedBranchDetails: d.branchDetails,
  });
}
