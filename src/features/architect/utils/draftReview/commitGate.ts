import { mutationSnapshotText } from '@/features/architect/utils/mutationPipeline.snapshotDigest';

/** Each coordinator owns its own gate. A token from another gate grants nothing. */
export function createDraftReviewCommitGate() {
  const pending = new WeakMap<
    object,
    { authority: object; snapshot: string }
  >();
  return {
    seal(authority: object, result: unknown): object {
      const token = Object.freeze({});
      pending.set(token, { authority, snapshot: mutationSnapshotText(result) });
      return token;
    },
    consume(token: unknown, authority: object, result: unknown): () => void {
      const record =
        token && typeof token === 'object' ? pending.get(token) : undefined;
      // Even an unsuccessful consumption cannot be retried with modified data.
      if (token && typeof token === 'object') pending.delete(token);
      const assertUnchanged = () => {
        if (
          !record ||
          record.authority !== authority ||
          record.snapshot !== mutationSnapshotText(result)
        )
          throw new Error(
            'Draft review persistence requires the exact validated one-use result.'
          );
      };
      assertUnchanged();
      return assertUnchanged;
    },
  };
}
