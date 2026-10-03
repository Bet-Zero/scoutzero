/** Shared verification of server-owned lineage; custom records cannot opt in. */
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_TRANSITION_PROVENANCE_SUBCOLLECTION,
} from '@/constants/collections';
import {
  TransitionProvenanceHeadZ,
  TransitionProvenanceRecordZ,
} from '@/schemas/transitionProvenance';
import { sha256Digest } from './contractSource/deterministicDigest';
import { mutationSnapshotText } from './mutationPipeline.snapshotDigest';

export const provenanceHash = (value: unknown) =>
  sha256Digest(mutationSnapshotText(value));
export const provenanceRoot = (worldId: string) =>
  `${ARCHITECT_WORLDS_COLLECTION}/${worldId}/${ARCHITECT_WORLD_TRANSITION_PROVENANCE_SUBCOLLECTION}`;

export async function hashTransitionState(documents: Record<string, unknown>) {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(documents).map(async ([path, data]) => [
        path,
        await provenanceHash(data),
      ])
    )
  );
}

export async function readCertifiedLineage(args: {
  worldId: string;
  releaseId: string;
  releaseSha256: string;
  readDocument: (path: string) => Promise<unknown>;
}) {
  const root = provenanceRoot(args.worldId);
  const documents: Record<string, string> = {};
  const read = async (id: string) => {
    const path = `${root}/${id}`;
    const value = await args.readDocument(path);
    documents[path] = mutationSnapshotText(value ?? null);
    return value;
  };
  const head = TransitionProvenanceHeadZ.parse(await read('head'));
  if (head.worldId !== args.worldId)
    throw new Error('Certified history belongs to another world.');
  let cursor = { recordId: head.recordId, recordSha256: head.recordSha256 };
  const records = [];
  const visited = new Set<string>();
  while (true) {
    if (visited.has(cursor.recordId))
      throw new Error('Certified history lineage contains a cycle.');
    visited.add(cursor.recordId);
    const raw = await read(cursor.recordId);
    if ((await provenanceHash(raw)) !== cursor.recordSha256)
      throw new Error('Certified history lineage changed.');
    const record = TransitionProvenanceRecordZ.parse(raw);
    if (
      record.worldId !== args.worldId ||
      record.recordId !== cursor.recordId ||
      record.releaseId !== args.releaseId ||
      record.releaseSha256 !== args.releaseSha256
    )
      throw new Error(
        'Certified history has an unavailable baseline or release.'
      );
    records.push(record);
    if (record.kind === 'baseline') {
      if (record.recordId !== 'baseline' || record.predecessor !== null)
        throw new Error('Invalid certified baseline.');
      break;
    }
    if (!record.predecessor || record.recordId === 'baseline')
      throw new Error('Certified history has no trusted predecessor.');
    cursor = record.predecessor;
  }
  return { head, records, documents };
}
