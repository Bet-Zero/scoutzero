import type { DraftOverlappingPoolProgram } from '@/schemas/draftOverlappingPool';

export function OverlappingDraftChoices({
  program,
  positions,
  elections,
  onElection,
  due,
}: {
  program: DraftOverlappingPoolProgram;
  positions: Record<string, number>;
  elections: Record<string, boolean>;
  onElection: (id: string, selected: boolean) => void;
  due: boolean;
}) {
  const conditional = program.slots.find(
    (s) => s.entitlementId === program.conveyance.entitlementId
  )!;
  const position = positions[conditional.originalTeam];
  const name = (id: string) =>
    program.slots.find((s) => s.entitlementId === id)!.originalTeam;
  return (
    <div>
      <p>
        {conditional.originalTeam}'s first is top{' '}
        {program.conveyance.protectedThrough} protected. Outside that range, it
        conveys to {program.conveyance.recipientTeam} before the options below.
      </p>
      <p>
        {position
          ? position <= program.conveyance.protectedThrough
            ? `${conditional.originalTeam} retains its protected first. Its separate second-round/cash obligation is outside this first-round allocation.`
            : `${conditional.originalTeam}'s first is eligible for conveyance and the first option.`
          : 'Enter all original draft positions to determine eligibility.'}
      </p>
      <p>
        Each option uses the selections left by earlier claims. Final positions
        stay with the original picks.
      </p>
      <ol className="list-decimal pl-5">
        {program.claims.map((c, i) => (
          <li key={c.clauseId}>
            <span>
              {c.holderTeam}: exchange its less favorable eligible{' '}
              {c.eligibleReturnIds.map(name).join(' / ')} selection for{' '}
              {c.targetTeam}'s remaining selection when more favorable.
            </span>
            {due && (
              <label className="ml-2">
                Claim {i + 1} election
                <select
                  aria-label={`Claim ${i + 1} election`}
                  value={elections[c.clauseId] ? 'exercise' : ''}
                  onChange={(e) =>
                    onElection(c.clauseId, e.target.value === 'exercise')
                  }
                  className="ml-2 bg-cockpit-raised border border-cockpit-edge rounded"
                >
                  <option value="">Choose…</option>
                  <option value="exercise">Exercise</option>
                </select>
              </label>
            )}
          </li>
        ))}
      </ol>
      <p>
        All five elections are required. Waivers, ties and amended terms need
        additional governing information. Multiple retained records of the same
        option do not create additional choices.
      </p>
    </div>
  );
}
