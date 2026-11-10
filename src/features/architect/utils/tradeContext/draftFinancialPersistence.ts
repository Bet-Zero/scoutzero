/** Private preservation handoff. It grants no validation or write permission. */
import { mutationSnapshotText } from '../mutationPipeline.snapshotDigest';
import {
  assertDraftFinancialStateUnchanged,
  preserveDraftFinancialState,
} from './draftFinancialPreservation';

type RecordValue = Record<string, unknown>;
type Update = { teamCode?: string | null; team?: RecordValue | null };
type RetainedSource = { value: RecordValue; text: string };
const sources = new WeakMap<object, RetainedSource>();
const updates = new WeakMap<
  object,
  { text: string; raw: Record<string, RetainedSource> }
>();

export function retainDraftPersistenceSource(team: object, raw: RecordValue) {
  // Retain Firestore values as read (including Timestamp instances). Guard
  // against mutation instead of changing their types with a JSON/deep clone.
  sources.set(team, { value: raw, text: mutationSnapshotText(raw) });
}

export function retainPreservedDraftUpdates(
  result: Update[],
  before: { teamCode: string | null; team: RecordValue }[]
) {
  const raw: Record<string, RetainedSource> = {};
  for (const update of result) {
    const previous = before.find((t) => t.teamCode === update.teamCode);
    if (!previous || !update.team)
      throw new Error('Draft financial preservation lost a team.');
    assertDraftFinancialStateUnchanged(previous.team, update.team);
    const source = sources.get(previous.team);
    if (source) raw[String(update.teamCode)] = source;
  }
  updates.set(result, { text: mutationSnapshotText(result), raw });
}

export function hasPreservedDraftUpdates(result: object): boolean {
  const retained = updates.get(result);
  if (!retained) return false;
  if (retained.text !== mutationSnapshotText(result))
    throw new Error(
      'Preserved draft financial state changed after computation.'
    );
  return true;
}

export function committedPreservedDraftUpdates(result: Update[]) {
  if (!hasPreservedDraftUpdates(result)) return null;
  const retained = updates.get(result)!;
  return result.map((update) => {
    const source = retained.raw[String(update.teamCode)];
    if (!source || !update.team)
      throw new Error(
        'Draft preservation requires the exact persisted financial snapshot.'
      );
    if (source.text !== mutationSnapshotText(source.value))
      throw new Error('The retained draft financial snapshot changed.');
    const before = source.value;
    // Only membership changes. Preserve source/provenance and every financial
    // field; the atomic writer emits the same membership-only update.
    const team = preserveDraftFinancialState(before, {
      entitlementIds: update.team.entitlementIds,
    });
    assertDraftFinancialStateUnchanged(before, team);
    return { teamCode: update.teamCode, team };
  });
}
