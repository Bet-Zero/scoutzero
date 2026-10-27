/** Complete protection programs shared by proposal review and draft transitions. */
import {
  DraftConditionalProgramsZ,
  type DraftConditionalProgram,
} from '@/schemas/draftConditionalProgram';
import type { DraftOriginalFirst } from '@/schemas/draftPickOperation';
import { resolveConveyanceForPick } from '../tradeMachine/utils/conveyanceResolution';

export function activeConditionalStage(program: DraftConditionalProgram) {
  return program.results.at(-1)?.outcome === 'conveyed'
    ? null
    : (program.stages[program.results.length] ?? null);
}

export function conditionalPrograms(
  input: unknown,
  originals: {
    entitlementId: string;
    originalPick?: DraftOriginalFirst | null;
  }[],
  holders: Record<string, { holderTeam?: unknown }>
) {
  const programs = DraftConditionalProgramsZ.parse(input);
  for (const program of programs) {
    const active = activeConditionalStage(program);
    for (const stage of program.stages) {
      const original = originals.find(
        (r) => r.entitlementId === stage.entitlementId
      )?.originalPick;
      if (
        !original ||
        original.originalTeam !== program.originalTeam ||
        original.draftYear !== stage.year
      )
        throw new Error(
          'Conditional terms do not match the retained original identity.'
        );
      if (
        active &&
        stage.year > active.year &&
        holders[stage.entitlementId]?.holderTeam !== program.originalTeam
      )
        throw new Error('A deferred first has a competing ownership claim.');
    }
  }
  return programs;
}

export function conditionalProtectionLadder(program: DraftConditionalProgram) {
  return program.stages.map((stage, i) => ({
    year: stage.year,
    condition: stage.protectedThrough
      ? `Top ${stage.protectedThrough}`
      : 'Unprotected',
    ifTriggered: 'roll' as const,
    ...(program.stages[i + 1]
      ? { rollToYear: program.stages[i + 1].year }
      : {}),
  }));
}

/** Cartesian outcomes; no favorable branch is selected to authorize a trade. */
export function conditionalPostTradeBranches(args: {
  programs: DraftConditionalProgram[];
  originals: {
    entitlementId: string;
    originalPick?: DraftOriginalFirst | null;
  }[];
  holders: Record<string, string>;
  team: string;
  firstYear: number;
  throughYear: number;
}) {
  let outcomes = [
    {
      id: 'complete',
      holders: { ...args.holders },
      conditionalOutcomes: {} as Record<string, number>,
    },
  ];
  for (const program of args.programs) {
    const active = activeConditionalStage(program);
    if (!active) continue;
    const beneficiary = args.holders[active.entitlementId];
    if (!beneficiary) throw new Error('Conditional beneficiary is missing.');
    outcomes = outcomes.flatMap((branch) =>
      program.stages
        .slice(program.results.length)
        .filter((s) => s.protectedThrough < 30)
        .map((conveys) => {
          const holders = { ...branch.holders };
          for (const stage of program.stages.slice(program.results.length))
            holders[stage.entitlementId] =
              stage.year === conveys.year ? beneficiary : program.originalTeam;
          return {
            id: `${branch.id}:${program.id}:${conveys.year}`,
            holders,
            conditionalOutcomes: {
              ...branch.conditionalOutcomes,
              [program.id]: conveys.year,
            },
          };
        })
    );
  }
  return outcomes.map((branch) => ({
    id: branch.id,
    conditionalOutcomes: branch.conditionalOutcomes,
    possible: true as const,
    unresolvedDependencyIds: [],
    drafts: Array.from(
      { length: args.throughYear - args.firstYear + 1 },
      (_, i) => ({
        draftYear: args.firstYear + i,
        inventoryComplete: false,
        retained: args.originals
          .filter(
            (r) =>
              r.originalPick?.draftYear === args.firstYear + i &&
              branch.holders[r.entitlementId] === args.team
          )
          .map((r) => r.originalPick!),
      })
    ),
  }));
}

/** Validate the domain before invoking the legacy resolver (which accepts incomplete ladders). */
export function resolveConditionalDraft(
  programInput: DraftConditionalProgram,
  position: number
) {
  const program = DraftConditionalProgramsZ.parse([programInput])[0];
  const stage = activeConditionalStage(program);
  if (!stage || !Number.isInteger(position) || position < 1 || position > 30)
    throw new Error(
      'An unresolved obligation and a complete draft position are required.'
    );
  const result = resolveConveyanceForPick(
    {
      id: stage.entitlementId,
      year: stage.year,
      round: 1,
      originalTeam: program.originalTeam,
      protectionLadder: conditionalProtectionLadder(program),
      conveyance: {
        currentYear: stage.year,
        finalYear: program.stages.at(-1)!.year,
        conditions: {
          protection: stage.protectedThrough
            ? `Top ${stage.protectedThrough}`
            : 'Unprotected',
        },
      },
    },
    { [program.originalTeam]: position },
    {
      draftYear: stage.year,
      method: 'governed-test-position',
      nowIso: `${stage.year}-06-30T00:00:00Z`,
    }
  );
  const outcome =
    result?.status === 'rolled' ? ('deferred' as const) : ('conveyed' as const);
  if (!result || !['rolled', 'conveyed'].includes(String(result.status)))
    throw new Error('Unsupported conveyance outcome.');
  return DraftConditionalProgramsZ.parse([
    {
      ...program,
      results: [...program.results, { year: stage.year, position, outcome }],
    },
  ])[0];
}
