/** Offline release loading only; no network, file, world or adoption operation. */
import {
  DraftPickReleasePinZ,
  DraftPickReleaseUseZ,
  type DraftPickReleasePin,
  type DraftPickReleaseUse,
} from '@/schemas/draftPickRelease';
import {
  buildDraftPickFoundation,
  type DraftPickFoundation,
} from '@/features/architect/utils/draftPickFoundation';
import {
  canonicalStringify,
  sha256Digest,
} from '@/features/architect/utils/contractSource/deterministicDigest';

export type LoadedDraftPickRelease = Readonly<{
  foundation: DraftPickFoundation;
  payloadSha256: string;
  use: DraftPickReleaseUse;
  execution: 'disabled';
}>;

// Prevent unchecked/caller-fabricated models from bypassing the loader in comparisons.
const loaded = new WeakSet<object>();
export function requireLoadedDraftPickRelease(value: LoadedDraftPickRelease) {
  if (!loaded.has(value))
    throw new Error('Draft release was not verified by the loader');
}

/** Serialize retained inputs; derived read-model fields are rebuilt on every load. */
export function serializeDraftPickFoundation(foundation: DraftPickFoundation) {
  const { originalPicks, legacyRecords, execution, ...input } = foundation;
  return canonicalStringify(input);
}

/** A matching pin proves integrity against that pin, not the pin's authority. */
export async function loadDraftPickRelease(
  serializedInput: string,
  expectedPin: DraftPickReleasePin,
  intendedUse: DraftPickReleaseUse
): Promise<LoadedDraftPickRelease> {
  const pin = DraftPickReleasePinZ.parse(expectedPin);
  const use = DraftPickReleaseUseZ.parse(intendedUse);
  if (typeof serializedInput !== 'string')
    throw new Error('Expected serialized draft input');
  const digest = await sha256Digest(serializedInput);
  if (digest !== `sha256:${pin.payloadSha256}`)
    throw new Error('Draft release payload digest mismatch');
  const foundation = buildDraftPickFoundation(JSON.parse(serializedInput));
  if (
    canonicalStringify(foundation.release) !== canonicalStringify(pin.release)
  )
    throw new Error(
      'Draft release identity, date or review differs from expected pin'
    );
  if (
    use === 'retained-baseline' &&
    !['accepted', 'accepted-with-limitations'].includes(
      foundation.release.review.status
    )
  )
    throw new Error(
      'An unaccepted proposal cannot serve as the retained baseline'
    );
  const artifactIds = foundation.retainedArtifacts.map((a) => a.id);
  if (new Set(artifactIds).size !== artifactIds.length)
    throw new Error('Duplicate retained artifact identity');
  const result: LoadedDraftPickRelease = Object.freeze({
    foundation,
    payloadSha256: pin.payloadSha256,
    use,
    execution: 'disabled',
  });
  loaded.add(result);
  return result;
}
