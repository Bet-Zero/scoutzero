import { auth } from '@/firebaseConfig';

export class WorldHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string
  ) {
    super(
      code === 'world-outside-lifecycle-scope'
        ? 'This world uses an older storage setup and cannot be deleted here.'
        : code === 'world-has-children'
        ? 'Delete the child worlds first.'
        : code === 'initialization-pending'
          ? 'Creation is still finishing. Wait a few minutes, then retry or discard it.'
          : code === 'world-already-saved'
            ? 'This world was saved. Retry creation to reopen it.'
            : status === 429
              ? 'The world service limit is reached. Try again after the daily budget resets.'
              : 'World creation could not be confirmed. Retry your pending creation.'
    );
  }
}

/** Fixed same-origin transport; Trade Machine and Firestore persistence stay shared. */
async function worldRequest(input: unknown): Promise<Record<string, unknown>> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be logged in to create worlds');
  const response = await fetch('/api/architect/world', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify(input),
  });
  const result: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    !result ||
    typeof result !== 'object' ||
    !('ok' in result) ||
    result.ok !== true
  ) {
    throw new WorldHttpError(
      response.ok ? 503 : response.status,
      result &&
      typeof result === 'object' &&
      'error' in result &&
      typeof result.error === 'string'
        ? result.error
        : undefined
    );
  }
  return result as Record<string, unknown>;
}

export async function initializeWorldOverHttp(input: unknown): Promise<void> {
  await worldRequest(input);
}

export async function removeWorldOverHttp(
  worldId: string,
  cleanup: boolean,
  expectedParentWorldId?: string
) {
  const uid = auth.currentUser?.uid;
  // One explicit action may drain six bounded chunks; uncertain replies stop immediately.
  for (let chunk = 0; chunk < 6; chunk += 1) {
    if (!uid || auth.currentUser?.uid !== uid)
      throw new Error('Sign in to the account that started this operation.');
    let result: Record<string, unknown>;
    try {
      result = await worldRequest({
        operation: cleanup ? 'cleanup' : 'delete',
        worldId,
        userId: uid,
        ...(expectedParentWorldId ? { expectedParentWorldId } : {}),
      });
    } catch (error) {
      if (error instanceof WorldHttpError && error.status >= 500)
        error.message =
          'Deletion could not be confirmed. Retry deleting this same world.';
      throw error;
    }
    if (result.worldId !== worldId || typeof result.done !== 'boolean')
      throw new WorldHttpError(503);
    if (result.done) return true;
    if (chunk < 5) await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  return false;
}
