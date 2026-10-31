import {
  DraftPenaltyPlacementInputZ,
  DraftPenaltyPlacementReceiptZ,
  type DraftPenaltyPlacementInput,
} from '@/schemas/draftPenaltyPlacement';
import type { DraftApronInput } from '@/schemas/draftApron';
import { evaluateDraftApronLifecycle } from '../draftApronMechanisms';
import { orderDraftPenaltyMembers } from '../draftPenaltyOrder';
import { AUTHORITATIVE_WORLD_TEAM_CODES } from '../leagueTeams';
import { mutationSnapshotText } from '../mutationPipeline.snapshotDigest';

const same = (a: unknown, b: unknown) =>
  mutationSnapshotText(a) === mutationSnapshotText(b);
const codes = [...AUTHORITATIVE_WORLD_TEAM_CODES].sort();

/** Complete first round; penalties move selections, never ownership or rights. */
export function calculatePenaltyPlacement(
  input: unknown,
  restrictions: DraftApronInput[]
) {
  const draft = DraftPenaltyPlacementInputZ.parse(input);
  if (
    draft.ordering !== 'complete-including-lottery-and-ties' ||
    !draft.membershipComplete
  )
    throw new Error(
      'Complete draft ordering and penalty membership are required.'
    );
  if (
    !same(draft.selections.map((s) => s.originalTeam).sort(), codes) ||
    new Set(draft.selections.map((s) => s.entitlementId)).size !== 30 ||
    !same(restrictions.map((r) => r.team).sort(), codes)
  )
    throw new Error(
      'Every original first-round selection and restriction is required exactly once.'
    );
  if (
    !new RegExp(`^${draft.draftYear}-06-`).test(draft.date) ||
    !draft.regularSeasonCompletedOn.startsWith(`${draft.draftYear}-`) ||
    draft.regularSeasonCompletedOn >= draft.date
  )
    throw new Error(
      'The draft requires its completed regular season and governed draft date.'
    );
  const asOf = `${draft.date}T12:00:00-04:00`;
  const penaltyIds: string[] = [];
  for (const selection of draft.selections) {
    if (
      !codes.includes(selection.holderTeam as (typeof codes)[number]) ||
      !selection.claimsComplete ||
      !same(selection.claimEntitlementIds, [selection.entitlementId])
    )
      throw new Error(
        'Complete uncontested ownership is required for every selection.'
      );
    const input = restrictions.find((r) => r.team === selection.originalTeam)!;
    if (
      input.asOf !== asOf ||
      input.originalPick.draftYear !== draft.draftYear ||
      input.originalPick.originalTeam !== selection.originalTeam
    )
      throw new Error(
        'Restriction history must match the draft and original team.'
      );
    const result = evaluateDraftApronLifecycle(input);
    // No trigger (or an established release) cannot carry this penalty.
    if (result.frozen.status === 'known' && !result.frozen.value) continue;
    if (result.penalized.status !== 'known')
      throw new Error(
        'Every original team needs established penalty eligibility.'
      );
    if (result.penalized.value) penaltyIds.push(input.originalPick.id);
  }
  if (
    !same([...draft.penalizedPickIds].sort(), [...penaltyIds].sort()) ||
    !penaltyIds.length
  )
    throw new Error(
      'The complete penalty membership must match consumed season history.'
    );
  let orderedIds = penaltyIds;
  if (penaltyIds.length > 1) {
    const ordered = orderDraftPenaltyMembers(
      draft.selections
        .filter((s) =>
          penaltyIds.includes(`${s.originalTeam}_${draft.draftYear}_1st`)
        )
        .map((s) => ({
          pick: {
            kind: 'authenticated-original-pick' as const,
            id: `${s.originalTeam}_${draft.draftYear}_1st`,
            originalTeam: s.originalTeam,
            draftYear: draft.draftYear,
            round: 1 as const,
          },
          officialWinningPercentage: s.originalTeamWinningPercentage,
        }))
    );
    if (!ordered) throw new Error('governing-tie-procedure-not-established');
    orderedIds = ordered;
  }
  const originalId = (s: DraftPenaltyPlacementInput['selections'][number]) =>
    `${s.originalTeam}_${draft.draftYear}_1st`;
  const ordered = [
    ...draft.selections.filter((s) => !penaltyIds.includes(originalId(s))),
    ...orderedIds.map(
      (id) => draft.selections.find((s) => originalId(s) === id)!
    ),
  ];
  return ordered.map((s, index) => ({
    entitlementId: s.entitlementId,
    originalTeam: s.originalTeam,
    holderTeam: s.holderTeam,
    draftYear: draft.draftYear,
    beforePosition: draft.selections.indexOf(s) + 1,
    position: index + 1,
    penalized: penaltyIds.includes(originalId(s)),
  }));
}

/** Display consumers recompute placement; malformed/tampered receipts show no result. */
export function readPenaltyPlacementReceipt(value: unknown) {
  const parsed = DraftPenaltyPlacementReceiptZ.safeParse(value);
  if (!parsed.success) return null;
  try {
    return same(
      calculatePenaltyPlacement(parsed.data.input, parsed.data.restrictions),
      parsed.data.positions
    )
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}
export function placementLine(row: {
  originalTeam: string;
  draftYear: number;
  beforePosition: number;
  position: number;
  holderTeam: string;
  penalized: boolean;
}) {
  return `${row.originalTeam} ${row.draftYear} first: pick ${row.beforePosition} → ${row.position} · held by ${row.holderTeam}${row.penalized ? ' · draft-pick penalty' : ''}`;
}
